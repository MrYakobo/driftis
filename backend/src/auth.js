import { readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const AUTH_PATH = join(ROOT, 'auth.json');

const RP_NAME = 'Driftassistent';
const RP_ID = process.env.RP_ID || 'localhost';
const ORIGIN = process.env.ORIGIN || `http://localhost:5173`;

async function readAuth() {
  try {
    return JSON.parse(await readFile(AUTH_PATH, 'utf-8'));
  } catch {
    return { users: [], pendingRequests: [], pendingRegistrations: {}, sessions: {} };
  }
}

async function writeAuth(data) {
  await writeFile(AUTH_PATH, JSON.stringify(data, null, 2));
}

// Session tokens
function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  return { token, userId, createdAt: Date.now() };
}

export function authMiddleware(req, res, next) {
  const publicPaths = ['/api/auth/'];
  if (publicPaths.some(p => req.path.startsWith(p))) return next();

  const token = req.cookies?.session || req.headers['x-session'];
  if (!token) return res.status(401).json({ error: 'unauthorized' });

  readAuth().then(auth => {
    const session = auth.sessions[token];
    if (!session) return res.status(401).json({ error: 'unauthorized' });
    const user = auth.users.find(u => u.id === session.userId);
    if (!user || !user.approved) return res.status(403).json({ error: 'not approved' });
    req.user = user;
    next();
  });
}

export function authRoutes(app) {
  // Check if setup is needed (no users yet)
  app.get('/api/auth/status', async (req, res) => {
    const auth = await readAuth();
    const token = req.cookies?.session || req.headers['x-session'];
    const session = token && auth.sessions[token];
    const user = session && auth.users.find(u => u.id === session.userId);
    res.json({
      needsSetup: auth.users.length === 0,
      authenticated: !!user?.approved,
      isAdmin: !!user?.admin,
      pending: !!user && !user.approved,
      name: user?.name || null,
    });
  });

  // Register - generate options
  app.post('/api/auth/register/options', async (req, res) => {
    const { name } = req.body;
    const auth = await readAuth();
    const isFirst = auth.users.length === 0;
    const userId = crypto.randomUUID();

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userID: new TextEncoder().encode(userId),
      userName: name || (isFirst ? 'Admin' : `User-${auth.users.length + 1}`),
      attestationType: 'none',
      authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
    });

    // Store challenge temporarily
    auth.pendingRegistrations = auth.pendingRegistrations || {};
    auth.pendingRegistrations[userId] = { challenge: options.challenge, name: name || (isFirst ? 'Admin' : `User-${auth.users.length + 1}`), isFirst };
    await writeAuth(auth);

    res.json({ options, userId });
  });

  // Register - verify
  app.post('/api/auth/register/verify', async (req, res) => {
    const { userId, response } = req.body;
    const auth = await readAuth();
    const pending = auth.pendingRegistrations?.[userId];
    if (!pending) return res.status(400).json({ error: 'no pending registration' });

    try {
      const verification = await verifyRegistrationResponse({
        response,
        expectedChallenge: pending.challenge,
        expectedOrigin: ORIGIN,
        expectedRPID: RP_ID,
        requireUserVerification: false,
      });

      if (!verification.verified) return res.status(400).json({ error: 'verification failed' });

      const user = {
        id: userId,
        name: pending.name,
        admin: pending.isFirst,
        approved: pending.isFirst, // First user auto-approved
        credential: {
          id: verification.registrationInfo.credential.id,
          publicKey: Buffer.from(verification.registrationInfo.credential.publicKey).toString('base64'),
          counter: verification.registrationInfo.credential.counter,
        },
        createdAt: new Date().toISOString(),
      };

      auth.users.push(user);
      delete auth.pendingRegistrations[userId];

      if (user.approved) {
        const session = createSession(userId);
        auth.sessions[session.token] = { userId: session.userId, createdAt: session.createdAt };
        await writeAuth(auth);
        res.json({ verified: true, approved: true, token: session.token });
      } else {
        await writeAuth(auth);
        res.json({ verified: true, approved: false });
      }
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // Login - generate options
  app.post('/api/auth/login/options', async (req, res) => {
    const auth = await readAuth();
    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      userVerification: 'preferred',
    });

    auth.currentChallenge = options.challenge;
    await writeAuth(auth);
    res.json(options);
  });

  // Login - verify
  app.post('/api/auth/login/verify', async (req, res) => {
    const { response } = req.body;
    const auth = await readAuth();

    const user = auth.users.find(u => u.credential.id === response.id);
    if (!user) return res.status(400).json({ error: 'unknown credential' });
    if (!user.approved) return res.status(403).json({ error: 'not approved' });

    try {
      const verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: auth.currentChallenge,
        expectedOrigin: ORIGIN,
        expectedRPID: RP_ID,
        requireUserVerification: false,
        credential: {
          id: user.credential.id,
          publicKey: Buffer.from(user.credential.publicKey, 'base64'),
          counter: user.credential.counter,
        },
      });

      if (!verification.verified) return res.status(400).json({ error: 'verification failed' });

      user.credential.counter = verification.authenticationInfo.newCounter;
      const session = createSession(user.id);
      auth.sessions[session.token] = { userId: session.userId, createdAt: session.createdAt };
      await writeAuth(auth);

      res.json({ verified: true, token: session.token, isAdmin: user.admin });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // Admin: list pending requests
  app.get('/api/auth/requests', async (req, res) => {
    const auth = await readAuth();
    const pending = auth.users.filter(u => !u.approved);
    res.json(pending.map(u => ({ id: u.id, name: u.name, createdAt: u.createdAt })));
  });

  // Admin: approve user
  app.post('/api/auth/approve', async (req, res) => {
    const auth = await readAuth();
    const user = auth.users.find(u => u.id === req.body.userId);
    if (!user) return res.status(404).json({ error: 'user not found' });
    user.approved = true;
    await writeAuth(auth);
    res.json({ success: true });
  });

  // Admin: reject user
  app.post('/api/auth/reject', async (req, res) => {
    const auth = await readAuth();
    auth.users = auth.users.filter(u => u.id !== req.body.userId);
    await writeAuth(auth);
    res.json({ success: true });
  });

  // Admin: list all approved users
  app.get('/api/auth/users', async (req, res) => {
    const auth = await readAuth();
    const users = auth.users.filter(u => u.approved).map(u => ({ id: u.id, name: u.name, admin: u.admin, createdAt: u.createdAt }));
    res.json(users);
  });

  // Admin: revoke user
  app.post('/api/auth/revoke', async (req, res) => {
    const auth = await readAuth();
    const token = req.cookies?.session || req.headers['x-session'];
    const session = token && auth.sessions[token];
    if (session && session.userId === req.body.userId) {
      return res.status(400).json({ error: 'cannot revoke yourself' });
    }
    auth.users = auth.users.filter(u => u.id !== req.body.userId);
    // Remove their sessions
    for (const [t, s] of Object.entries(auth.sessions)) {
      if (s.userId === req.body.userId) delete auth.sessions[t];
    }
    await writeAuth(auth);
    res.json({ success: true });
  });

  // Logout
  app.post('/api/auth/logout', async (req, res) => {
    const token = req.cookies?.session || req.headers['x-session'];
    if (token) {
      const auth = await readAuth();
      delete auth.sessions[token];
      await writeAuth(auth);
    }
    res.json({ success: true });
  });
}
