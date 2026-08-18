// Storage seam for case recordings. Routes and case workflow never need to
// know whether bytes are on local disk, S3, or another object store.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { dataDirectory } = require('../config/runtime');

const IS_TEST = Boolean(process.env.NODE_TEST_CONTEXT) || process.env.NODE_TEST === '1' || process.env.npm_lifecycle_event === 'test' || process.argv.includes('--test');
// Test recordings must never share the production data directory: resetting a
// test case must not erase a clinician's local recording.
const AUDIO_DIR = IS_TEST
  ? path.join(os.tmpdir(), 'scribel-test-case-audio', String(process.pid))
  : path.join(dataDirectory(), 'case_audio');

function ensureDirectory(directory) {
  if (!fs.existsSync(directory)) fs.mkdirSync(directory, { recursive: true });
}

function save({ caseId, recordingId, extension, buffer }) {
  const directory = path.join(AUDIO_DIR, String(caseId));
  ensureDirectory(directory);
  const storedFileName = `${recordingId}${extension}`;
  const storedFilePath = path.join(directory, storedFileName);
  fs.writeFileSync(storedFilePath, buffer);
  return { storageKey: path.relative(AUDIO_DIR, storedFilePath), storedFileName, storedFilePath };
}

function remove(recording) {
  const filePath = recording?.storedFilePath || (recording?.storageKey ? path.join(AUDIO_DIR, recording.storageKey) : null);
  if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

function resolve(recording) {
  return recording?.storedFilePath || (recording?.storageKey ? path.join(AUDIO_DIR, recording.storageKey) : null);
}

module.exports = { AUDIO_DIR, ensureDirectory, save, remove, resolve };
