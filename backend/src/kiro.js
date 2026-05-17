import { spawn } from 'node:child_process';
import { Writable, Readable } from 'node:stream';
import { ClientSideConnection, ndJsonStream, PROTOCOL_VERSION } from '@agentclientprotocol/sdk';

const KIRO_PATH = process.env.KIRO_PATH || `${process.env.HOME}/.local/bin/kiro-cli`;

export class KiroClient {
  constructor() {
    this.connection = null;
    this.proc = null;
    this.collectedText = new Map(); // sessionId -> text chunks
    this._chunkCallbacks = new Map(); // sessionId -> onChunk fn
  }

  async start() {
    this.proc = spawn(KIRO_PATH, ['acp', '--trust-all-tools'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.proc.stderr.on('data', chunk => {
      console.error('[kiro stderr]', chunk.toString().trim());
    });

    const input = Writable.toWeb(this.proc.stdin);
    const output = Readable.toWeb(this.proc.stdout);
    const stream = ndJsonStream(input, output);

    const self = this;
    this.connection = new ClientSideConnection((_agent) => ({
      async requestPermission(params) {
        // Auto-approve all
        return { outcome: { outcome: 'selected', optionId: params.options[0].optionId } };
      },
      async sessionUpdate(params) {
        const update = params.update;
        if (update.sessionUpdate === 'agent_message_chunk' && update.content?.type === 'text') {
          const sid = params.sessionId;
          const existing = self.collectedText.get(sid) || '';
          self.collectedText.set(sid, existing + update.content.text);
          const cb = self._chunkCallbacks.get(sid);
          if (cb) cb(update.content.text);
        }
      },
      async readTextFile(params) {
        const { readFile } = await import('fs/promises');
        try {
          const content = await readFile(params.path, 'utf-8');
          return { content };
        } catch {
          return { content: '' };
        }
      },
      async writeTextFile() { return {}; },
      async extNotification() {},
      async extMethod() { return {}; },
    }), stream);

    const result = await this.connection.initialize({
      protocolVersion: PROTOCOL_VERSION,
      clientCapabilities: { fs: { readTextFile: true, writeTextFile: true } },
    });
    console.log(`Kiro ACP connected (protocol v${result.protocolVersion})`);
    return result;
  }

  async createSession(cwd) {
    const result = await this.connection.newSession({ cwd, mcpServers: [] });
    return result.sessionId;
  }

  async prompt(sessionId, text) {
    this.collectedText.set(sessionId, '');
    await this.connection.prompt({
      sessionId,
      prompt: [{ type: 'text', text }],
    });
    const response = this.collectedText.get(sessionId) || '';
    this.collectedText.delete(sessionId);
    return response;
  }

  streamPrompt(sessionId, text, onChunk) {
    return new Promise((resolve, reject) => {
      this.collectedText.set(sessionId, '');
      const originalUpdate = this._onChunk;
      this._chunkCallbacks.set(sessionId, onChunk);
      this.connection.prompt({
        sessionId,
        prompt: [{ type: 'text', text }],
      }).then(() => {
        this._chunkCallbacks.delete(sessionId);
        const full = this.collectedText.get(sessionId) || '';
        this.collectedText.delete(sessionId);
        resolve(full);
      }).catch(reject);
    });
  }

  stop() {
    if (this.proc) {
      this.proc.kill();
      this.proc = null;
    }
  }
}
