const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { transcribeAudio } = require('../src/transcripts/transcription');
const { diarizeAudio } = require('../src/transcripts/diarization');
const { alignSpeakerSections } = require('../src/transcripts/speakerAlignment');
const { cleanTranscript } = require('../src/transcripts/cleaning');
const { createCase, attachCaseAudio, getTranscript, resetCasesForTests } = require('../src/cases/cases');
const { processTranscript } = require('../server');

function withEnv(values, run) {
  const original = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  Object.entries(values).forEach(([key, value]) => {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  });
  return Promise.resolve().then(run).finally(() => Object.entries(original).forEach(([key, value]) => {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }));
}

function temporaryAudio() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'scribel-transcription-'));
  const audioPath = path.join(directory, 'capture.webm');
  fs.writeFileSync(audioPath, Buffer.from('test-audio'));
  return { audioPath, directory };
}

test('uses the local mock provider when no real provider is configured', async () => {
  const { audioPath, directory } = temporaryAudio();
  try {
    await withEnv({ TRANSCRIPTION_PROVIDER: 'local-mock', OPENAI_API_KEY: undefined, TRANSCRIPTION_API_URL: undefined, TRANSCRIPTION_MOCK_TEXT: 'Mock clinical transcript.' }, async () => {
      const result = await transcribeAudio({ audioPath, mimeType: 'audio/webm', language: 'en' });
      assert.equal(result.provider, 'local-mock');
      assert.equal(result.text, 'Mock clinical transcript.');
      assert.deepEqual(result.speakerSections, []);
    });
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('keeps mock transcription and diarization available without loading local models', async () => {
  const { audioPath, directory } = temporaryAudio();
  try {
    await withEnv({ TRANSCRIPTION_PROVIDER: 'mock', DIARIZATION_PROVIDER: 'mock', DIARIZATION_MOCK_SEGMENTS: '[{"speaker":"SPEAKER_00","startMs":0,"endMs":1500}]' }, async () => {
      const transcript = await transcribeAudio({ audioPath, mimeType: 'audio/webm', language: 'en' });
      const speakers = await diarizeAudio({ audioPath });
      assert.equal(transcript.provider, 'local-mock');
      assert.deepEqual(speakers, [{ speaker: 'SPEAKER_00', startMs: 0, endMs: 1500 }]);
    });
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('aligns transcript timestamps to the speaker with the greatest overlap without fabricating labels', () => {
  const sections = alignSpeakerSections(
    [{ startMs: 0, endMs: 1000, text: 'How are you feeling?' }, { startMs: 1100, endMs: 2000, text: 'I am feeling okay.' }, { startMs: 2500, endMs: 2600, text: 'Unassigned.' }],
    [{ speaker: 'SPEAKER_00', startMs: 0, endMs: 1050 }, { speaker: 'SPEAKER_01', startMs: 1000, endMs: 2100 }],
  );
  assert.deepEqual(sections, [
    { speaker: 'SPEAKER_00', startMs: 0, endMs: 1000, text: 'How are you feeling?' },
    { speaker: 'SPEAKER_01', startMs: 1100, endMs: 2000, text: 'I am feeling okay.' },
    { speaker: 'Unknown', startMs: 2500, endMs: 2600, text: 'Unassigned.' },
  ]);
});

test('cleans only safe artifacts while preserving clinical wording, medication, dosage, negation, and uncertainty', () => {
  const raw = 'Um, um, the the patient may have pneumonia [background noise] and denies fever. Metformin 5 milligrams twice daily.';
  const cleaned = cleanTranscript(raw);
  assert.equal(cleaned.cleanedText, 'the patient may have pneumonia and denies fever. Metformin 5 milligrams twice daily.');
  assert.deepEqual(cleaned.rulesApplied, ['remove-recording-artifacts', 'remove-filler', 'collapse-repeated-word', 'normalize-whitespace']);
  assert.equal(raw, 'Um, um, the the patient may have pneumonia [background noise] and denies fever. Metformin 5 milligrams twice daily.');
  assert.equal(cleaned.cleanerVersion, 'v2');
});

test('marks failed local transcription safely and permits a retry through the same job path', async () => {
  resetCasesForTests();
  const originalFetch = global.fetch;
  try {
    const caseRecord = createCase({ patientName: 'Retry Patient' }).case;
    const upload = attachCaseAudio(caseRecord.id, {
      audioData: Buffer.from('audio').toString('base64'), mimeType: 'audio/webm', source: 'dashboard', durationMs: 1000,
    }, 'Provider');
    const transcript = getTranscript(caseRecord.id, upload.case.transcripts[0].id);
    await withEnv({ TRANSCRIPTION_PROVIDER: 'unsupported-provider', DIARIZATION_PROVIDER: 'mock' }, async () => {
      const failed = await processTranscript(caseRecord.id, transcript.id, 'Provider');
      assert.equal(failed.ok, false);
      assert.equal(getTranscript(caseRecord.id, transcript.id).status, 'failed');
      assert.equal(getTranscript(caseRecord.id, transcript.id).failureMessage, 'The local transcription provider could not process this audio. Please retry.');
    });

    await withEnv({ TRANSCRIPTION_PROVIDER: 'local-mock', OPENAI_API_KEY: undefined, TRANSCRIPTION_MOCK_TEXT: 'Retry transcript.' }, async () => {
      const retried = await processTranscript(caseRecord.id, transcript.id, 'Provider');
      assert.equal(retried.ok, true);
      assert.equal(getTranscript(caseRecord.id, transcript.id).status, 'review-required');
    });
  } finally {
    global.fetch = originalFetch;
    resetCasesForTests();
  }
});

test('cleaning preserves aligned speaker identities and timestamps', () => {
  const source = [{ speaker: 'SPEAKER_00', startMs: 0, endMs: 900, text: 'Um, um, the the patient denies fever.' }];
  const cleaned = source.map((section) => ({ ...section, text: cleanTranscript(section.text).cleanedText }));
  assert.deepEqual(cleaned, [{ speaker: 'SPEAKER_00', startMs: 0, endMs: 900, text: 'the patient denies fever.' }]);
});
