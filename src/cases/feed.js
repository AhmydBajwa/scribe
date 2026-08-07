// Athena does not expose a practice-wide patient-case listing. This module is
// deliberately the single boundary for a change-feed subscription and drain.
// A deployment supplies ATHENAHEALTH_PATIENT_CASE_FEED_URL; tests and local
// development can submit normalized events to drainChangeFeed directly.
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const STORE_PATH = path.join(DATA_DIR, 'patient_case_feed.json');

function readStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STORE_PATH)) return { cursor: null, events: [], lastSuccessAt: null, lastError: null };
  try { return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')); } catch { return { cursor: null, events: [], lastSuccessAt: null, lastError: 'Feed state could not be read.' }; }
}
function writeStore(store) { fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2)); }
function getFeedHealth() {
  const store = readStore();
  return { configured: Boolean(process.env.ATHENAHEALTH_PATIENT_CASE_FEED_URL), cursor: store.cursor || null, queuedEvents: (store.events || []).length, lastSuccessAt: store.lastSuccessAt || null, lastError: store.lastError || null };
}
async function drainChangeFeed() {
  const url = process.env.ATHENAHEALTH_PATIENT_CASE_FEED_URL;
  if (!url) return { ok: false, status: 501, message: 'ATHENAHEALTH_PATIENT_CASE_FEED_URL is not configured.', events: [] };
  const store = readStore();
  try {
    const target = new URL(url);
    if (store.cursor) target.searchParams.set('cursor', store.cursor);
    const response = await fetch(target, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Feed request failed with status ${response.status}`);
    const payload = await response.json();
    const events = Array.isArray(payload.events) ? payload.events : [];
    store.events.push(...events);
    store.cursor = payload.cursor || payload.nextCursor || store.cursor;
    store.lastSuccessAt = new Date().toISOString(); store.lastError = null; writeStore(store);
    return { ok: true, status: 200, events, cursor: store.cursor };
  } catch (error) {
    store.lastError = error.message; writeStore(store);
    return { ok: false, status: 502, message: error.message, events: [] };
  }
}
function consumeEvents() { const store = readStore(); const events = store.events || []; store.events = []; writeStore(store); return events; }
module.exports = { getFeedHealth, drainChangeFeed, consumeEvents };
