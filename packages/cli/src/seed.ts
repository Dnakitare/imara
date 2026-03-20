import { randomUUID } from 'node:crypto';
import { computeEventHash } from '@imara/core';
import type { AuditEvent } from '@imara/core';
import type { AuditStore } from '@imara/store';

interface EventSeed {
  toolName: string;
  serverName: string;
  toolArguments: Record<string, unknown>;
  policyDecision: 'allow' | 'deny' | 'escalate';
  policyReason?: string;
  policiesEvaluated: string[];
  resultStatus: 'success' | 'error' | 'blocked';
  resultSummary: string;
  resultLatencyMs: number;
  /** Seconds after session start */
  offsetSeconds: number;
}

export function seedDemoData(store: AuditStore): void {
  const sessionId = randomUUID();
  const agentId = 'claude-code-v1.0.12';
  const sessionStart = Date.now() - 55 * 60 * 1000; // ~55 minutes ago

  const seeds: EventSeed[] = [
    // ──────────────────────────────────────────────
    // Phase 1: Exploration (events 1-8)
    // ──────────────────────────────────────────────
    {
      toolName: 'Read',
      serverName: 'filesystem',
      toolArguments: {
        file_path: '/Users/dev/acme-api/README.md',
      },
      policyDecision: 'allow',
      policiesEvaluated: ['log-all'],
      resultStatus: 'success',
      resultSummary: 'Read 124 lines from README.md',
      resultLatencyMs: 8,
      offsetSeconds: 0,
    },
    {
      toolName: 'Glob',
      serverName: 'filesystem',
      toolArguments: {
        pattern: '**/*.ts',
        path: '/Users/dev/acme-api/src',
      },
      policyDecision: 'allow',
      policiesEvaluated: ['log-all'],
      resultStatus: 'success',
      resultSummary: 'Found 47 matching files',
      resultLatencyMs: 22,
      offsetSeconds: 4,
    },
    {
      toolName: 'Bash',
      serverName: 'shell',
      toolArguments: {
        command: 'ls -la /Users/dev/acme-api/src/auth/',
      },
      policyDecision: 'allow',
      policiesEvaluated: ['log-all'],
      resultStatus: 'success',
      resultSummary: 'Listed 3 files in auth directory',
      resultLatencyMs: 145,
      offsetSeconds: 8,
    },
    {
      toolName: 'Read',
      serverName: 'filesystem',
      toolArguments: {
        file_path: '/Users/dev/acme-api/src/auth/index.ts',
      },
      policyDecision: 'allow',
      policiesEvaluated: ['log-all'],
      resultStatus: 'success',
      resultSummary: 'Read 38 lines from auth/index.ts',
      resultLatencyMs: 6,
      offsetSeconds: 12,
    },
    {
      toolName: 'Read',
      serverName: 'filesystem',
      toolArguments: {
        file_path: '/Users/dev/acme-api/src/auth/types.ts',
      },
      policyDecision: 'allow',
      policiesEvaluated: ['log-all'],
      resultStatus: 'success',
      resultSummary: 'Read 52 lines from auth/types.ts',
      resultLatencyMs: 7,
      offsetSeconds: 16,
    },
    {
      toolName: 'Grep',
      serverName: 'filesystem',
      toolArguments: {
        pattern: 'jwt|jsonwebtoken|bcrypt',
        path: '/Users/dev/acme-api',
        glob: '*.ts',
        output_mode: 'content',
        '-i': true,
      },
      policyDecision: 'allow',
      policiesEvaluated: ['log-all'],
      resultStatus: 'success',
      resultSummary: 'Found 12 matches across 4 files',
      resultLatencyMs: 34,
      offsetSeconds: 22,
    },
    {
      toolName: 'Read',
      serverName: 'filesystem',
      toolArguments: {
        file_path: '/Users/dev/acme-api/package.json',
      },
      policyDecision: 'allow',
      policiesEvaluated: ['log-all'],
      resultStatus: 'success',
      resultSummary: 'Read 61 lines from package.json',
      resultLatencyMs: 5,
      offsetSeconds: 28,
    },
    {
      toolName: 'Read',
      serverName: 'filesystem',
      toolArguments: {
        file_path: '/Users/dev/acme-api/src/middleware/errorHandler.ts',
      },
      policyDecision: 'allow',
      policiesEvaluated: ['log-all'],
      resultStatus: 'success',
      resultSummary: 'Read 45 lines from errorHandler.ts',
      resultLatencyMs: 6,
      offsetSeconds: 35,
    },

    // ──────────────────────────────────────────────
    // Phase 2: Implementation (events 9-22)
    // ──────────────────────────────────────────────
    {
      toolName: 'Write',
      serverName: 'filesystem',
      toolArguments: {
        file_path: '/Users/dev/acme-api/src/auth/session.ts',
        content: `import { randomUUID } from 'node:crypto';
import type { User } from './types';

export interface Session {
  id: string;
  userId: string;
  expiresAt: Date;
  createdAt: Date;
  ipAddress: string;
  userAgent: string;
}

const sessions = new Map<string, Session>();

export function createSession(user: User, ip: string, ua: string): Session {
  const session: Session = {
    id: randomUUID(),
    userId: user.id,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    ipAddress: ip,
    userAgent: ua,
  };
  sessions.set(session.id, session);
  return session;
}

export function getSession(id: string): Session | undefined {
  const session = sessions.get(id);
  if (session && session.expiresAt < new Date()) {
    sessions.delete(id);
    return undefined;
  }
  return session;
}

export function destroySession(id: string): boolean {
  return sessions.delete(id);
}
`,
      },
      policyDecision: 'allow',
      policiesEvaluated: ['log-all'],
      resultStatus: 'success',
      resultSummary: 'Created new file auth/session.ts (42 lines)',
      resultLatencyMs: 18,
      offsetSeconds: 65,
    },
    {
      toolName: 'Write',
      serverName: 'filesystem',
      toolArguments: {
        file_path: '/Users/dev/acme-api/src/auth/middleware.ts',
        content: `import { Request, Response, NextFunction } from 'express';
import { getSession } from './session';
import { verifyToken } from './jwt';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = verifyToken(token);
    const session = getSession(payload.sessionId);

    if (!session) {
      res.status(401).json({ error: 'Session expired or invalid' });
      return;
    }

    req.user = payload;
    req.sessionId = payload.sessionId;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const token = authHeader.slice(7);
      const payload = verifyToken(token);
      req.user = payload;
    } catch {
      // Token invalid, continue without auth
    }
  }
  next();
}
`,
      },
      policyDecision: 'allow',
      policiesEvaluated: ['log-all'],
      resultStatus: 'success',
      resultSummary: 'Created new file auth/middleware.ts (46 lines)',
      resultLatencyMs: 21,
      offsetSeconds: 105,
    },
    {
      toolName: 'Write',
      serverName: 'filesystem',
      toolArguments: {
        file_path: '/Users/dev/acme-api/src/auth/jwt.ts',
        content: `import jwt from 'jsonwebtoken';
import type { User } from './types';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const TOKEN_EXPIRY = '24h';

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  sessionId: string;
}

export function signToken(user: User, sessionId: string): string {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role, sessionId },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
}
`,
      },
      policyDecision: 'allow',
      policiesEvaluated: ['log-all'],
      resultStatus: 'success',
      resultSummary: 'Created new file auth/jwt.ts (27 lines)',
      resultLatencyMs: 15,
      offsetSeconds: 150,
    },
    {
      toolName: 'Write',
      serverName: 'filesystem',
      toolArguments: {
        file_path: '/Users/dev/acme-api/src/auth/password.ts',
        content: `import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, SALT_ROUNDS);
}

export async function verifyPassword(plaintext: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}
`,
      },
      policyDecision: 'allow',
      policiesEvaluated: ['log-all'],
      resultStatus: 'success',
      resultSummary: 'Created new file auth/password.ts (12 lines)',
      resultLatencyMs: 12,
      offsetSeconds: 180,
    },
    {
      toolName: 'Edit',
      serverName: 'filesystem',
      toolArguments: {
        file_path: '/Users/dev/acme-api/src/auth/types.ts',
        old_string: `export interface User {
  id: string;
  email: string;
  name: string;
}`,
        new_string: `export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user' | 'viewer';
  passwordHash: string;
  createdAt: Date;
  lastLoginAt?: Date;
}`,
      },
      policyDecision: 'allow',
      policiesEvaluated: ['log-all'],
      resultStatus: 'success',
      resultSummary: 'Edited auth/types.ts: added role, passwordHash, createdAt, lastLoginAt fields',
      resultLatencyMs: 14,
      offsetSeconds: 210,
    },
    {
      toolName: 'Edit',
      serverName: 'filesystem',
      toolArguments: {
        file_path: '/Users/dev/acme-api/src/auth/index.ts',
        old_string: `export { type User } from './types';`,
        new_string: `export { type User } from './types';
export { requireAuth, optionalAuth } from './middleware';
export { createSession, getSession, destroySession } from './session';
export { signToken, verifyToken } from './jwt';
export { hashPassword, verifyPassword } from './password';`,
      },
      policyDecision: 'allow',
      policiesEvaluated: ['log-all'],
      resultStatus: 'success',
      resultSummary: 'Edited auth/index.ts: added barrel exports for new modules',
      resultLatencyMs: 11,
      offsetSeconds: 240,
    },
    {
      toolName: 'Write',
      serverName: 'filesystem',
      toolArguments: {
        file_path: '/Users/dev/acme-api/src/routes/auth.routes.ts',
        content: `import { Router } from 'express';
import { hashPassword, verifyPassword, signToken, createSession, destroySession } from '../auth';
import { findUserByEmail, createUser } from '../db/users';

const router = Router();

router.post('/register', async (req, res) => {
  const { email, name, password } = req.body;

  if (!email || !name || !password) {
    return res.status(400).json({ error: 'email, name, and password are required' });
  }

  const existing = await findUserByEmail(email);
  if (existing) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const passwordHash = await hashPassword(password);
  const user = await createUser({ email, name, passwordHash, role: 'user' });
  const session = createSession(user, req.ip ?? 'unknown', req.headers['user-agent'] ?? '');
  const token = signToken(user, session.id);

  res.status(201).json({ user: { id: user.id, email: user.email, name: user.name }, token });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  const user = await findUserByEmail(email);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const session = createSession(user, req.ip ?? 'unknown', req.headers['user-agent'] ?? '');
  const token = signToken(user, session.id);

  res.json({ user: { id: user.id, email: user.email, name: user.name }, token });
});

router.post('/logout', async (req, res) => {
  const sessionId = req.sessionId;
  if (sessionId) {
    destroySession(sessionId);
  }
  res.status(204).send();
});

export default router;
`,
      },
      policyDecision: 'allow',
      policiesEvaluated: ['log-all'],
      resultStatus: 'success',
      resultSummary: 'Created new file routes/auth.routes.ts (54 lines)',
      resultLatencyMs: 24,
      offsetSeconds: 300,
    },
    {
      toolName: 'Edit',
      serverName: 'filesystem',
      toolArguments: {
        file_path: '/Users/dev/acme-api/src/app.ts',
        old_string: `import healthRouter from './routes/health';

app.use('/health', healthRouter);`,
        new_string: `import healthRouter from './routes/health';
import authRouter from './routes/auth.routes';

app.use('/health', healthRouter);
app.use('/auth', authRouter);`,
      },
      policyDecision: 'allow',
      policiesEvaluated: ['log-all'],
      resultStatus: 'success',
      resultSummary: 'Edited app.ts: registered auth routes at /auth',
      resultLatencyMs: 13,
      offsetSeconds: 340,
    },
    {
      toolName: 'Edit',
      serverName: 'filesystem',
      toolArguments: {
        file_path: '/Users/dev/acme-api/src/app.ts',
        old_string: `import express from 'express';`,
        new_string: `import express from 'express';
import cookieParser from 'cookie-parser';`,
      },
      policyDecision: 'allow',
      policiesEvaluated: ['log-all'],
      resultStatus: 'success',
      resultSummary: 'Edited app.ts: added cookie-parser import',
      resultLatencyMs: 11,
      offsetSeconds: 365,
    },
    {
      toolName: 'Bash',
      serverName: 'shell',
      toolArguments: {
        command: 'cd /Users/dev/acme-api && npm install jsonwebtoken bcrypt cookie-parser && npm install -D @types/jsonwebtoken @types/bcrypt @types/cookie-parser',
      },
      policyDecision: 'allow',
      policiesEvaluated: ['log-all'],
      resultStatus: 'success',
      resultSummary: 'Installed jsonwebtoken, bcrypt, cookie-parser and their type definitions',
      resultLatencyMs: 2840,
      offsetSeconds: 390,
    },
    {
      toolName: 'Write',
      serverName: 'filesystem',
      toolArguments: {
        file_path: '/Users/dev/acme-api/tests/auth.test.ts',
        content: `import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { destroySession } from '../src/auth';

describe('Auth API', () => {
  describe('POST /auth/register', () => {
    it('should register a new user and return a token', async () => {
      const res = await request(app)
        .post('/auth/register')
        .send({ email: 'test@example.com', name: 'Test User', password: 'SecureP@ss1' });

      expect(res.status).toBe(201);
      expect(res.body.user.email).toBe('test@example.com');
      expect(res.body.token).toBeDefined();
    });

    it('should reject registration with missing fields', async () => {
      const res = await request(app)
        .post('/auth/register')
        .send({ email: 'test@example.com' });

      expect(res.status).toBe(400);
    });

    it('should reject duplicate email registration', async () => {
      await request(app)
        .post('/auth/register')
        .send({ email: 'dupe@example.com', name: 'First', password: 'Pass123!' });

      const res = await request(app)
        .post('/auth/register')
        .send({ email: 'dupe@example.com', name: 'Second', password: 'Pass456!' });

      expect(res.status).toBe(409);
    });
  });

  describe('POST /auth/login', () => {
    it('should login with valid credentials', async () => {
      await request(app)
        .post('/auth/register')
        .send({ email: 'login@example.com', name: 'Login User', password: 'MyP@ss99' });

      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'login@example.com', password: 'MyP@ss99' });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
    });

    it('should reject invalid password', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'login@example.com', password: 'WrongPassword' });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('should logout and invalidate session', async () => {
      const reg = await request(app)
        .post('/auth/register')
        .send({ email: 'logout@example.com', name: 'Logout User', password: 'LogOut1!' });

      const res = await request(app)
        .post('/auth/logout')
        .set('Authorization', \`Bearer \${reg.body.token}\`);

      expect(res.status).toBe(204);
    });
  });
});
`,
      },
      policyDecision: 'allow',
      policiesEvaluated: ['log-all'],
      resultStatus: 'success',
      resultSummary: 'Created new file tests/auth.test.ts (78 lines)',
      resultLatencyMs: 28,
      offsetSeconds: 440,
    },
    {
      toolName: 'Write',
      serverName: 'filesystem',
      toolArguments: {
        file_path: '/Users/dev/acme-api/tests/auth.middleware.test.ts',
        content: `import { describe, it, expect, vi } from 'vitest';
import { requireAuth } from '../src/auth/middleware';
import { createMockReq, createMockRes } from './helpers';

describe('requireAuth middleware', () => {
  it('should return 401 when no auth header is present', () => {
    const req = createMockReq({});
    const res = createMockRes();
    const next = vi.fn();

    requireAuth(req as any, res as any, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next() with valid token and active session', () => {
    const req = createMockReq({
      headers: { authorization: 'Bearer valid-test-token' }
    });
    const res = createMockRes();
    const next = vi.fn();

    requireAuth(req as any, res as any, next);

    expect(next).toHaveBeenCalled();
  });
});
`,
      },
      policyDecision: 'allow',
      policiesEvaluated: ['log-all'],
      resultStatus: 'success',
      resultSummary: 'Created new file tests/auth.middleware.test.ts (30 lines)',
      resultLatencyMs: 16,
      offsetSeconds: 480,
    },

    // ──────────────────────────────────────────────
    // Phase 3: Testing (events 23-28)
    // ──────────────────────────────────────────────
    {
      toolName: 'Bash',
      serverName: 'shell',
      toolArguments: {
        command: 'cd /Users/dev/acme-api && npx vitest run tests/auth.test.ts',
      },
      policyDecision: 'allow',
      policiesEvaluated: ['log-all'],
      resultStatus: 'error',
      resultSummary: 'Test run failed: 1 of 6 tests failed. POST /auth/logout - expected 204 but received 401 (missing requireAuth middleware on logout route)',
      resultLatencyMs: 1820,
      offsetSeconds: 520,
    },
    {
      toolName: 'Read',
      serverName: 'filesystem',
      toolArguments: {
        file_path: '/Users/dev/acme-api/src/routes/auth.routes.ts',
        offset: 44,
        limit: 12,
      },
      policyDecision: 'allow',
      policiesEvaluated: ['log-all'],
      resultStatus: 'success',
      resultSummary: 'Read lines 44-55 from auth.routes.ts',
      resultLatencyMs: 5,
      offsetSeconds: 535,
    },
    {
      toolName: 'Edit',
      serverName: 'filesystem',
      toolArguments: {
        file_path: '/Users/dev/acme-api/src/routes/auth.routes.ts',
        old_string: `router.post('/logout', async (req, res) => {`,
        new_string: `router.post('/logout', requireAuth, async (req, res) => {`,
      },
      policyDecision: 'allow',
      policiesEvaluated: ['log-all'],
      resultStatus: 'success',
      resultSummary: 'Edited auth.routes.ts: added requireAuth middleware to logout route',
      resultLatencyMs: 12,
      offsetSeconds: 548,
    },
    {
      toolName: 'Edit',
      serverName: 'filesystem',
      toolArguments: {
        file_path: '/Users/dev/acme-api/src/routes/auth.routes.ts',
        old_string: `import { hashPassword, verifyPassword, signToken, createSession, destroySession } from '../auth';`,
        new_string: `import { hashPassword, verifyPassword, signToken, createSession, destroySession, requireAuth } from '../auth';`,
      },
      policyDecision: 'allow',
      policiesEvaluated: ['log-all'],
      resultStatus: 'success',
      resultSummary: 'Edited auth.routes.ts: added requireAuth to imports',
      resultLatencyMs: 10,
      offsetSeconds: 560,
    },
    {
      toolName: 'Bash',
      serverName: 'shell',
      toolArguments: {
        command: 'cd /Users/dev/acme-api && npx vitest run tests/auth.test.ts',
      },
      policyDecision: 'allow',
      policiesEvaluated: ['log-all'],
      resultStatus: 'success',
      resultSummary: 'All 6 tests passed in 1.2s',
      resultLatencyMs: 1450,
      offsetSeconds: 580,
    },
    {
      toolName: 'Bash',
      serverName: 'shell',
      toolArguments: {
        command: 'cd /Users/dev/acme-api && npx vitest run tests/auth.middleware.test.ts',
      },
      policyDecision: 'allow',
      policiesEvaluated: ['log-all'],
      resultStatus: 'success',
      resultSummary: 'All 2 tests passed in 0.4s',
      resultLatencyMs: 680,
      offsetSeconds: 610,
    },

    // ──────────────────────────────────────────────
    // Phase 4: Git operations (events 29-35)
    // ──────────────────────────────────────────────
    {
      toolName: 'Bash',
      serverName: 'shell',
      toolArguments: {
        command: 'cd /Users/dev/acme-api && git status',
      },
      policyDecision: 'allow',
      policiesEvaluated: ['log-all'],
      resultStatus: 'success',
      resultSummary: 'On branch feat/user-auth: 6 new files, 2 modified files',
      resultLatencyMs: 180,
      offsetSeconds: 640,
    },
    {
      toolName: 'Bash',
      serverName: 'shell',
      toolArguments: {
        command: 'cd /Users/dev/acme-api && git diff src/auth/types.ts',
      },
      policyDecision: 'allow',
      policiesEvaluated: ['log-all'],
      resultStatus: 'success',
      resultSummary: 'Showed diff: added role, passwordHash, createdAt, lastLoginAt fields to User interface',
      resultLatencyMs: 120,
      offsetSeconds: 655,
    },
    {
      toolName: 'Bash',
      serverName: 'shell',
      toolArguments: {
        command: 'cd /Users/dev/acme-api && git diff src/app.ts',
      },
      policyDecision: 'allow',
      policiesEvaluated: ['log-all'],
      resultStatus: 'success',
      resultSummary: 'Showed diff: added auth route imports and cookie-parser',
      resultLatencyMs: 105,
      offsetSeconds: 668,
    },
    {
      toolName: 'Bash',
      serverName: 'shell',
      toolArguments: {
        command: 'cd /Users/dev/acme-api && git add src/auth/session.ts src/auth/middleware.ts src/auth/jwt.ts src/auth/password.ts src/auth/types.ts src/auth/index.ts src/routes/auth.routes.ts src/app.ts tests/auth.test.ts tests/auth.middleware.test.ts',
      },
      policyDecision: 'allow',
      policiesEvaluated: ['log-all'],
      resultStatus: 'success',
      resultSummary: 'Staged 10 files for commit',
      resultLatencyMs: 210,
      offsetSeconds: 685,
    },
    {
      toolName: 'Bash',
      serverName: 'shell',
      toolArguments: {
        command: 'cd /Users/dev/acme-api && git log --oneline -5',
      },
      policyDecision: 'allow',
      policiesEvaluated: ['log-all'],
      resultStatus: 'success',
      resultSummary: 'Showed last 5 commits',
      resultLatencyMs: 95,
      offsetSeconds: 700,
    },
    {
      toolName: 'Bash',
      serverName: 'shell',
      toolArguments: {
        command: `cd /Users/dev/acme-api && git commit -m "$(cat <<'EOF'
feat(auth): add user authentication with JWT sessions

- Add session management with in-memory store and auto-expiry
- Add JWT token signing and verification
- Add bcrypt password hashing with salt rounds=12
- Add requireAuth and optionalAuth Express middleware
- Add /auth/register, /auth/login, /auth/logout routes
- Add comprehensive test coverage for auth API and middleware

Co-Authored-By: Claude Code <noreply@anthropic.com>
EOF
)"`,
      },
      policyDecision: 'allow',
      policiesEvaluated: ['log-all'],
      resultStatus: 'success',
      resultSummary: 'Created commit a3f7c2e: feat(auth): add user authentication with JWT sessions',
      resultLatencyMs: 340,
      offsetSeconds: 720,
    },
    {
      toolName: 'Bash',
      serverName: 'shell',
      toolArguments: {
        command: 'cd /Users/dev/acme-api && git status',
      },
      policyDecision: 'allow',
      policiesEvaluated: ['log-all'],
      resultStatus: 'success',
      resultSummary: 'Working tree clean, on branch feat/user-auth',
      resultLatencyMs: 115,
      offsetSeconds: 738,
    },

    // ──────────────────────────────────────────────
    // Phase 5: Risky moments (events 36-38)
    // ──────────────────────────────────────────────
    {
      toolName: 'Bash',
      serverName: 'shell',
      toolArguments: {
        command: 'cd /Users/dev/acme-api && git push --force origin main',
      },
      policyDecision: 'deny',
      policyReason: 'BLOCKED: Force push to protected branch "main" is prohibited. Force-pushing rewrites remote history and can destroy other contributors\' work. This action was denied by organizational policy. Use a feature branch and open a pull request instead.',
      policiesEvaluated: ['block-destructive-on-protected-branches', 'log-all'],
      resultStatus: 'blocked',
      resultSummary: 'Denied: force push to main blocked by policy',
      resultLatencyMs: 2,
      offsetSeconds: 760,
    },
    {
      toolName: 'Bash',
      serverName: 'shell',
      toolArguments: {
        command: 'cd /Users/dev/acme-api && git push -u origin feat/user-auth',
      },
      policyDecision: 'allow',
      policiesEvaluated: ['log-all'],
      resultStatus: 'success',
      resultSummary: 'Pushed branch feat/user-auth to origin, set upstream tracking',
      resultLatencyMs: 2150,
      offsetSeconds: 775,
    },
    {
      toolName: 'Bash',
      serverName: 'shell',
      toolArguments: {
        command: 'rm -rf /Users/dev/acme-api/config/production.env',
      },
      policyDecision: 'deny',
      policyReason: 'BLOCKED: Attempted deletion of production configuration file "config/production.env". Deleting production environment files can cause service outages and expose the system to misconfiguration. This path is protected by organizational policy and cannot be removed by automated agents.',
      policiesEvaluated: ['block-destructive-on-protected-branches', 'log-all'],
      resultStatus: 'blocked',
      resultSummary: 'Denied: deletion of production config file blocked by policy',
      resultLatencyMs: 1,
      offsetSeconds: 800,
    },
  ];

  let prevHash: string | null = null;

  for (const seed of seeds) {
    const id = randomUUID();
    const timestamp = new Date(sessionStart + seed.offsetSeconds * 1000).toISOString();

    const partial = {
      id,
      timestamp,
      sessionId,
      serverName: seed.serverName,
      toolName: seed.toolName,
      toolArguments: seed.toolArguments,
      policyDecision: seed.policyDecision,
      prevHash,
    };

    const eventHash = computeEventHash(partial);

    const event: AuditEvent = {
      ...partial,
      agentId,
      toolAnnotations: undefined,
      policyReason: seed.policyReason,
      policiesEvaluated: seed.policiesEvaluated,
      resultStatus: seed.resultStatus,
      resultSummary: seed.resultSummary,
      resultLatencyMs: seed.resultLatencyMs,
      eventHash,
    };

    store.append(event);
    prevHash = eventHash;
  }
}
