const path = require('path');
const { runLocalPython } = require('./transcription');

const IS_TEST = Boolean(process.env.NODE_TEST_CONTEXT) || process.argv.includes('--test');
const LOCAL_DIARIZER = path.join(__dirname, '..', '..', 'scripts', 'diarize_local.py');

function normalizeDiarizationSegments(segments) {
  return Array.isArray(segments) ? segments.map((segment) => ({
    speaker: String(segment.speaker || 'Unknown'),
    startMs: Number(segment.startMs), endMs: Number(segment.endMs),
  })).filter((segment) => Number.isFinite(segment.startMs) && Number.isFinite(segment.endMs) && segment.endMs > segment.startMs) : [];
}

// Provider-neutral diarization boundary. pyannote performs inference locally on
// CPU; its model download/access token is only used to obtain the model weights.
async function diarizeAudio({ audioPath } = {}) {
  // Keep automated tests independent of a developer's .env and local model
  // installation. Production always uses the configured local pyannote model.
  const provider = IS_TEST && process.env.ALLOW_REAL_LOCAL_MODELS_IN_TESTS !== 'true'
    ? 'mock'
    : String(process.env.DIARIZATION_PROVIDER || 'pyannote').trim().toLowerCase();
  if (provider === 'mock' || provider === 'local-mock') return normalizeDiarizationSegments(JSON.parse(process.env.DIARIZATION_MOCK_SEGMENTS || '[]'));
  if (provider !== 'pyannote' && provider !== 'local-pyannote') throw new Error('The configured diarization provider is unsupported.');
  const payload = await runLocalPython(LOCAL_DIARIZER, {
    audioPath, model: process.env.PYANNOTE_DIARIZATION_MODEL || 'pyannote/speaker-diarization-community-1',
    token: process.env.HF_TOKEN || process.env.HUGGINGFACE_TOKEN || null,
    // Optional: set DIARIZATION_NUM_SPEAKERS only when the encounter's exact
    // number of speakers is known; otherwise pyannote detects it automatically.
    numSpeakers: Number.isInteger(Number(process.env.DIARIZATION_NUM_SPEAKERS)) && Number(process.env.DIARIZATION_NUM_SPEAKERS) > 0
      ? Number(process.env.DIARIZATION_NUM_SPEAKERS) : null,
    device: 'cpu',
  });
  return normalizeDiarizationSegments(payload.segments);
}

module.exports = { diarizeAudio, normalizeDiarizationSegments };
