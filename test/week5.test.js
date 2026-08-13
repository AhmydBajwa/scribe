const test = require('node:test');
const assert = require('node:assert/strict');
const { createCase, attachCaseAudio, getLatestCaseAudio, listCaseActivity, resetCasesForTests } = require('../src/cases/cases');

test.beforeEach(() => resetCasesForTests());

function upload(caseId, source) {
  return attachCaseAudio(caseId, {
    audioData: Buffer.from('voice').toString('base64'),
    mimeType: 'audio/webm', durationMs: 1250, recordedAt: '2026-08-04T12:00:00.000Z',
    source, fileName: 'capture.webm',
  }, 'Voice User');
}

test('attaches dashboard audio with complete Week 5 metadata', () => {
  const caseRecord = createCase({ patientName: 'Dashboard Patient' }).case;
  const result = upload(caseRecord.id, 'dashboard');
  assert.equal(result.ok, true);
  assert.equal(result.recording.caseId, caseRecord.id);
  assert.equal(result.recording.source, 'dashboard');
  assert.equal(result.recording.uploadedBy, 'Voice User');
  assert.equal(result.recording.durationMs, 1250);
  assert.equal(getLatestCaseAudio(caseRecord.id).id, result.recording.id);
  assert.ok(listCaseActivity(caseRecord.id).some((entry) => entry.action === 'audio:captured' && entry.details.source === 'dashboard'));
});

test('attaches mobile audio and rejects missing or invalid source metadata', () => {
  const caseRecord = createCase({ patientName: 'Mobile Patient' }).case;
  const mobile = upload(caseRecord.id, 'mobile');
  assert.equal(mobile.ok, true);
  assert.equal(mobile.recording.source, 'mobile');
  const invalid = attachCaseAudio(caseRecord.id, { audioData: Buffer.from('voice').toString('base64'), mimeType: 'audio/webm', source: 'tablet' });
  assert.equal(invalid.status, 400);
  const unsupported = attachCaseAudio(caseRecord.id, { audioData: Buffer.from('voice').toString('base64'), mimeType: 'text/plain', source: 'mobile' });
  assert.equal(unsupported.status, 415);
});

test('accepts MP3 uploads and supports longer imported audio', () => {
  const caseRecord = createCase({ patientName: 'Imported Audio Patient' }).case;
  const result = attachCaseAudio(caseRecord.id, {
    audioData: Buffer.from('mp3 audio').toString('base64'), mimeType: 'audio/mpeg', source: 'dashboard', durationMs: 20 * 60 * 1000, fileName: 'visit.mp3',
  }, 'Provider');
  assert.equal(result.ok, true);
  assert.match(result.recording.storedFileName, /\.mp3$/);
  assert.equal(result.recording.durationMs, 20 * 60 * 1000);
});

test('accepts a valid MP3 filename when a browser reports generic MIME metadata', () => {
  const caseRecord = createCase({ patientName: 'Browser MP3 Patient' }).case;
  const result = attachCaseAudio(caseRecord.id, {
    audioData: Buffer.from('mp3 audio').toString('base64'), mimeType: 'application/octet-stream', source: 'dashboard', durationMs: 1000, fileName: 'audio_to_test.mp3',
  }, 'Provider');
  assert.equal(result.ok, true);
  assert.match(result.recording.storedFileName, /\.mp3$/);
});
