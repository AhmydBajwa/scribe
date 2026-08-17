const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { dataDirectory } = require('../config/runtime');

const IS_TEST = Boolean(process.env.NODE_TEST_CONTEXT) || process.argv.includes('--test');
const SESSION_PATH = path.join(dataDirectory(), 'sessions.json');
const SESSION_TTL_MS = Math.max(60_000, Number(process.env.SESSION_TTL_MS || 8 * 60 * 60 * 1000));
let memorySessions = new Map();

function readSessions() {
  if (IS_TEST) return memorySessions;
  try {
    const rows = JSON.parse(fs.readFileSync(SESSION_PATH, 'utf8')).sessions || [];
    return new Map(rows.map((row) => [row.id, row]));
  } catch (error) {
    if (error.code !== 'ENOENT') console.error('Unable to read session store:', error.message);
    return new Map();
  }
}

function writeSessions(sessions) {
  if (IS_TEST) { memorySessions = sessions; return; }
  fs.mkdirSync(path.dirname(SESSION_PATH), { recursive: true });
  const temporary = `${SESSION_PATH}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify({ sessions: [...sessions.values()] }), { mode: 0o600 });
  fs.renameSync(temporary, SESSION_PATH);
}

function pruneExpired(sessions, now = Date.now()) {
  for (const [id, session] of sessions) if (!session.expiresAt || session.expiresAt <= now) sessions.delete(id);
}

function createSession(user) {
  const sessions = readSessions();
  pruneExpired(sessions);
  const now = Date.now();
  const id = crypto.randomBytes(32).toString('base64url');
  sessions.set(id, { id, user, createdAt: now, expiresAt: now + SESSION_TTL_MS });
  writeSessions(sessions);
  return id;
}

function getSession(id) {
  if (!id || typeof id !== 'string') return null;
  const sessions = readSessions();
  const session = sessions.get(id);
  if (!session || session.expiresAt <= Date.now()) {
    if (session) { sessions.delete(id); writeSessions(sessions); }
    return null;
  }
  return session;
}

function destroySession(id) {
  const sessions = readSessions();
  if (!sessions.delete(id)) return false;
  writeSessions(sessions);
  return true;
}

module.exports = { SESSION_TTL_MS, createSession, getSession, destroySession };
