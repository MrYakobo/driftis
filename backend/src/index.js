import express from 'express';
import cors from 'cors';
import { readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { KiroClient } from './kiro.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const DB_PATH = join(ROOT, 'database.json');

const app = express();
app.use(cors());
app.use(express.json());

const SYSTEM_PROMPT_PATH = join(__dirname, 'system_prompt.md');

async function getSystemPrompt() {
  return await readFile(SYSTEM_PROMPT_PATH, 'utf-8');
}

const kiro = new KiroClient();
let kiroReady = false;

(async () => {
  try {
    await kiro.start();
    kiroReady = true;
  } catch (e) {
    console.error('Kiro ACP init failed:', e.message);
  }
})();

async function readDB() {
  return JSON.parse(await readFile(DB_PATH, 'utf-8'));
}

async function writeDB(db) {
  await writeFile(DB_PATH, JSON.stringify(db, null, 2));
}

async function getRelevantDocs(query, db) {
  const words = query.toLowerCase().split(/\s+/);
  const scored = db.documents.map(doc => {
    const score = words.filter(w =>
      doc.tags.includes(w) || doc.title.toLowerCase().includes(w)
    ).length;
    return { ...doc, score };
  }).filter(d => d.score > 0).sort((a, b) => b.score - a.score);

  const docs = [];
  for (const doc of scored.slice(0, 3)) {
    const content = await readFile(join(ROOT, doc.path), 'utf-8');
    docs.push({ id: doc.id, title: doc.title, content });
  }
  return docs;
}

// Map incident IDs to Kiro session IDs
const sessionMap = new Map();

app.post('/api/incident', async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'query required' });

  const db = await readDB();
  const relevantDocs = await getRelevantDocs(query, db);

  let context = '';
  if (relevantDocs.length) {
    context = relevantDocs.map(d => `--- ${d.title} ---\n${d.content}`).join('\n\n');
  }

  const systemPrompt = await getSystemPrompt();
  const fullPrompt = `${systemPrompt}\n\n${context ? `Dokumentation:\n${context}\n\n` : ''}Användarens problem: ${query}`;

  const id = String(Date.now());
  const title = query.length > 40 ? query.slice(0, 40) + '…' : query;

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Send metadata first
  res.write(`data: ${JSON.stringify({ type: 'meta', id, matchedDocs: relevantDocs.map(d => ({ id: d.id, title: d.title })) })}\n\n`);

  let response = '';
  let sessionId = null;

  if (kiroReady) {
    try {
      sessionId = await kiro.createSession(ROOT);
      response = await kiro.streamPrompt(sessionId, fullPrompt, (chunk) => {
        res.write(`data: ${JSON.stringify({ type: 'chunk', text: chunk })}\n\n`);
      });
    } catch (e) {
      console.error('Kiro prompt error:', e.message);
    }
  }

  if (!response) {
    response = relevantDocs.length
      ? `Baserat på dokumentationen, prova dessa steg:\n\n${relevantDocs[0].content}`
      : 'Ingen matchande dokumentation hittades. Kontakta teknikansvarig.';
    res.write(`data: ${JSON.stringify({ type: 'chunk', text: response })}\n\n`);
  }

  if (sessionId) sessionMap.set(id, sessionId);
  db.incidents.push({ id, query, title, matchedDocs: relevantDocs.map(d => d.id), status: 'pending', response, timestamp: new Date().toISOString() });
  await writeDB(db);

  res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
  res.end();
});

app.post('/api/incident/:id/message', async (req, res) => {
  const { message } = req.body;
  const db = await readDB();
  const incident = db.incidents.find(i => i.id === req.params.id);
  if (!incident) return res.status(404).json({ error: 'not found' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  let reply = '';
  let sessionId = sessionMap.get(req.params.id);

  if (kiroReady) {
    try {
      if (!sessionId) {
        sessionId = await kiro.createSession(ROOT);
        sessionMap.set(req.params.id, sessionId);
        const relevantDocs = await getRelevantDocs(incident.query, db);
        const context = relevantDocs.map(d => `--- ${d.title} ---\n${d.content}`).join('\n\n');
        const systemPrompt = await getSystemPrompt();
        const recap = `${systemPrompt}\n\nDokumentation:\n${context}\n\nTidigare i konversationen frågade användaren: "${incident.query}"\nDu svarade: ${incident.response}\n\nNu säger användaren:`;
        reply = await kiro.streamPrompt(sessionId, `${recap}\n\n${message}`, (chunk) => {
          res.write(`data: ${JSON.stringify({ type: 'chunk', text: chunk })}\n\n`);
        });
      } else {
        reply = await kiro.streamPrompt(sessionId, message, (chunk) => {
          res.write(`data: ${JSON.stringify({ type: 'chunk', text: chunk })}\n\n`);
        });
      }
    } catch (e) {
      console.error('Kiro follow-up error:', e.message);
    }
  }

  if (!reply) {
    reply = 'Jag kunde inte generera ett svar. Kontakta teknikansvarig.';
    res.write(`data: ${JSON.stringify({ type: 'chunk', text: reply })}\n\n`);
  }

  if (!incident.messages) incident.messages = [];
  incident.messages.push({ role: 'user', content: message });
  incident.messages.push({ role: 'assistant', content: reply });
  await writeDB(db);

  res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
  res.end();
});

app.post('/api/feedback', async (req, res) => {
  const { id, status, resolution } = req.body;
  const db = await readDB();
  const incident = db.incidents.find(i => i.id === id);
  if (!incident) return res.status(404).json({ error: 'incident not found' });

  incident.status = status;
  if (resolution) incident.resolution = resolution;
  await writeDB(db);
  res.json({ success: true });
});

app.get('/api/docs', async (req, res) => {
  const db = await readDB();
  res.json(db.documents);
});

app.get('/api/doc/:id', async (req, res) => {
  const db = await readDB();
  const doc = db.documents.find(d => d.id === req.params.id);
  if (!doc) return res.status(404).json({ error: 'doc not found' });

  const content = await readFile(join(ROOT, doc.path), 'utf-8');
  res.json({ ...doc, content });
});

app.put('/api/doc/:id', async (req, res) => {
  const db = await readDB();
  const doc = db.documents.find(d => d.id === req.params.id);
  if (!doc) return res.status(404).json({ error: 'doc not found' });

  await writeFile(join(ROOT, doc.path), req.body.content);
  doc.updatedAt = new Date().toISOString().split('T')[0];
  await writeDB(db);
  res.json({ success: true });
});

app.get('/api/incidents', async (req, res) => {
  const db = await readDB();
  res.json(db.incidents);
});

app.get('/api/incident/:id', async (req, res) => {
  const db = await readDB();
  const incident = db.incidents.find(i => i.id === req.params.id);
  if (!incident) return res.status(404).json({ error: 'not found' });
  res.json(incident);
});

app.patch('/api/incident/:id', async (req, res) => {
  const db = await readDB();
  const incident = db.incidents.find(i => i.id === req.params.id);
  if (!incident) return res.status(404).json({ error: 'not found' });
  if (req.body.title) incident.title = req.body.title;
  await writeDB(db);
  res.json({ success: true });
});

app.delete('/api/incident/:id', async (req, res) => {
  const db = await readDB();
  db.incidents = db.incidents.filter(i => i.id !== req.params.id);
  await writeDB(db);
  res.json({ success: true });
});

const SETTINGS_PATH = join(ROOT, 'settings.json');

async function readSettings() {
  try {
    return JSON.parse(await readFile(SETTINGS_PATH, 'utf-8'));
  } catch {
    return { appName: 'Driftassistent', orgName: 'AI Church Ops' };
  }
}

async function writeSettings(s) {
  await writeFile(SETTINGS_PATH, JSON.stringify(s, null, 2));
}

app.get('/api/status', async (req, res) => {
  const settings = await readSettings();
  res.json({ kiroReady, contextUsage: kiro.contextUsage, settings });
});

app.get('/api/settings', async (req, res) => {
  res.json(await readSettings());
});

app.put('/api/settings', async (req, res) => {
  const settings = await readSettings();
  Object.assign(settings, req.body);
  await writeSettings(settings);
  res.json(settings);
});

app.listen(3001, () => console.log('Backend running on http://localhost:3001'));
