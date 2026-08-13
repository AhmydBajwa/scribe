const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createCase, attachCaseAudio, getTranscript, markTranscriptTranscribing,
  storeRawTranscript, cleanCaseTranscript, editCleanedTranscript, approveTranscript,
  getCasePromptInput, listCaseActivity, resetCasesForTests,
} = require('../src/cases/cases');
const { createSession } = require('../src/auth/saml');
const { app } = require('../server');

test.beforeEach(() => resetCasesForTests());

function queueCaseTranscript() {
  const caseRecord = createCase({ patientName: 'Transcript Patient', patientId: 'p-1', diagnoses: ['R50.9'], orders: ['CBC'] }).case;
  const audio = attachCaseAudio(caseRecord.id, { audioData: Buffer.from('audio').toString('base64'), mimeType: 'audio/webm', source: 'dashboard', durationMs: 1000 }, 'Provider');
  return { caseRecord, transcript: getTranscript(caseRecord.id, audio.recording ? null : null) };
}

test('preserves raw text, produces cleaned review text, and builds approved prompt input', () => {
  const { caseRecord, transcript } = queueCaseTranscript();
  markTranscriptTranscribing(caseRecord.id, transcript.id, 'Provider');
  storeRawTranscript(caseRecord.id, transcript.id, { text: 'Um, um, the the patient reports [background noise] fever.', segments: [{ speaker: 'Clinician', startMs: 0, endMs: 3000, text: 'Um, um, the the patient reports fever.' }], provider: 'test', language: 'en' }, 'Provider');
  const cleaned = cleanCaseTranscript(caseRecord.id, transcript.id, 'Provider');
  assert.equal(cleaned.ok, true);
  assert.equal(getTranscript(caseRecord.id, transcript.id).rawText, 'Um, um, the the patient reports [background noise] fever.');
  assert.equal(storeRawTranscript(caseRecord.id, transcript.id, { text: 'Replacement text' }, 'Provider').status, 409);
  assert.equal(getTranscript(caseRecord.id, transcript.id).cleanedText, 'the patient reports fever.');
  assert.equal(getCasePromptInput(caseRecord.id, transcript.id).ok, false);
  editCleanedTranscript(caseRecord.id, transcript.id, 'The patient reports fever.', 'Provider');
  approveTranscript(caseRecord.id, transcript.id, 'Provider');
  const prompt = getCasePromptInput(caseRecord.id, transcript.id);
  assert.equal(prompt.ok, true);
  assert.equal(prompt.input.transcript.text, 'The patient reports fever.');
  assert.deepEqual(prompt.input.clinicalContext.orders, ['CBC']);
  assert.ok(listCaseActivity(caseRecord.id).some((entry) => entry.action === 'transcript:approved'));
});

test('does not permit cleaned-text editing before raw transcription exists', () => {
  const { caseRecord, transcript } = queueCaseTranscript();
  const result = editCleanedTranscript(caseRecord.id, transcript.id, 'Invented text', 'Provider');
  assert.equal(result.status, 409);
});

test('processes, reviews, and approves a transcript through the HTTP API', async () => {
  const server = app.listen(0);
  const { port } = server.address();
  const cookie = `sessionId=${createSession({ name: 'Provider User', role: 'Care Coordinator' })}`;
  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    const caseRecord = createCase({ patientName: 'API Transcript Patient' }).case;
    const audio = await fetch(`${baseUrl}/api/cases/${caseRecord.id}/audio`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ audioData: Buffer.from('audio').toString('base64'), mimeType: 'audio/webm', source: 'mobile', durationMs: 500 }),
    });
    const uploaded = await audio.json();
    assert.equal(audio.status, 201);
    const processed = await fetch(`${baseUrl}/api/cases/${caseRecord.id}/transcripts`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify({ transcriptId: uploaded.transcript.id }),
    });
    const transcript = await processed.json();
    assert.ok([202, 409].includes(processed.status));
    let latest = transcript.transcript;
    for (let attempt = 0; attempt < 20 && latest?.status !== 'review-required'; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      const latestResponse = await fetch(`${baseUrl}/api/cases/${caseRecord.id}/transcripts/latest`, { headers: { Cookie: cookie } });
      latest = (await latestResponse.json()).transcript;
    }
    assert.equal(latest.status, 'review-required');
    const approved = await fetch(`${baseUrl}/api/cases/${caseRecord.id}/transcripts/${uploaded.transcript.id}/approve`, { method: 'POST', headers: { Cookie: cookie } });
    assert.equal(approved.status, 200);
    const prompt = await fetch(`${baseUrl}/api/cases/${caseRecord.id}/prompt-input?transcriptId=${uploaded.transcript.id}`, { headers: { Cookie: cookie } });
    assert.equal(prompt.status, 200);
  } finally { server.close(); }
});
