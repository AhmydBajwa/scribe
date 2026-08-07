const fs = require('fs');

// Provider boundary. Set TRANSCRIPTION_API_URL to connect a service accepting
// JSON { audioBase64, mimeType, language }; otherwise local/mock mode returns
// deterministic text that lets the review pipeline be exercised safely.
async function transcribeAudio({ audioPath, mimeType, language = 'en' } = {}) {
  if (!audioPath || !fs.existsSync(audioPath)) throw new Error('The audio file is unavailable for transcription.');
  const configuredUrl = process.env.TRANSCRIPTION_API_URL;
  if (!configuredUrl) {
    const text = process.env.TRANSCRIPTION_MOCK_TEXT || 'Transcript ready for clinical review.';
    return { text, segments: [{ speaker: 'Unknown', startMs: null, endMs: null, text }], confidence: null, provider: 'local-mock', language };
  }
  const audioBase64 = fs.readFileSync(audioPath).toString('base64');
  const response = await fetch(configuredUrl, {
    method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ audioBase64, mimeType, language }),
  });
  if (!response.ok) throw new Error(`Transcription request failed with status ${response.status}.`);
  const payload = await response.json();
  const text = payload.text || payload.transcript || '';
  if (!String(text).trim()) throw new Error('Transcription provider returned no text.');
  const segments = Array.isArray(payload.segments) ? payload.segments.map((segment) => ({ speaker: segment.speaker || segment.speakerLabel || 'Unknown', startMs: segment.startMs ?? segment.start ?? null, endMs: segment.endMs ?? segment.end ?? null, text: segment.text || '' })) : [{ speaker: 'Unknown', startMs: null, endMs: null, text }];
  return { text, segments, confidence: payload.confidence ?? null, provider: payload.provider || 'configured-service', language: payload.language || language };
}

module.exports = { transcribeAudio };
