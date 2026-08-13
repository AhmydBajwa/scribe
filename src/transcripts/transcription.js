const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const IS_TEST = Boolean(process.env.NODE_TEST_CONTEXT) || process.argv.includes('--test');
const LOCAL_TRANSCRIBER = path.join(__dirname, '..', '..', 'scripts', 'transcribe_local.py');

function runLocalPython(scriptPath, input) {
  return new Promise((resolve, reject) => {
    const python = process.env.PYTHON_EXECUTABLE || 'python';
    const child = spawn(python, [scriptPath], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error) => reject(error));
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(stderr.trim() || `Local transcription process exited with code ${code}.`));
      try { resolve(JSON.parse(stdout)); } catch { reject(new Error('Local transcription process returned invalid JSON.')); }
    });
    child.stdin.end(JSON.stringify(input));
  });
}

function normalizeSegments(segments) {
  if (!Array.isArray(segments)) return [];
  return segments.map((segment) => ({
    startMs: Number.isFinite(segment.startMs) ? segment.startMs : Math.round(Number(segment.start || 0) * 1000),
    endMs: Number.isFinite(segment.endMs) ? segment.endMs : Math.round(Number(segment.end || 0) * 1000),
    text: String(segment.text || ''),
  }));
}

// The sole transcription-provider boundary. Production uses the open-source
// faster-whisper model locally; no OpenAI key or hosted transcription is used.
async function transcribeAudio({ audioPath, mimeType, language = 'en' } = {}) {
  if (!audioPath || !fs.existsSync(audioPath)) throw new Error('The audio file is unavailable for transcription.');
  const configuredProvider = String(process.env.TRANSCRIPTION_PROVIDER || (IS_TEST ? 'mock' : 'local-whisper')).trim().toLowerCase();
  // A developer's production .env must not cause test fixtures to download or
  // load a real Whisper model. Tests can opt in explicitly when required.
  const provider = IS_TEST && process.env.ALLOW_REAL_LOCAL_MODELS_IN_TESTS !== 'true'
    && (configuredProvider === 'local-whisper' || configuredProvider === 'faster-whisper')
    ? 'mock' : configuredProvider;
  if (provider === 'mock' || provider === 'local-mock') {
    const text = process.env.TRANSCRIPTION_MOCK_TEXT || 'Transcript ready for clinical review.';
    return { text, segments: [], speakerSections: [], confidence: null, provider: 'local-mock', language };
  }
  if (provider !== 'local-whisper' && provider !== 'faster-whisper') throw new Error('The configured transcription provider is unsupported.');

  const payload = await runLocalPython(LOCAL_TRANSCRIBER, {
    audioPath, mimeType, language,
    model: process.env.WHISPER_MODEL || 'base',
    device: 'cpu', computeType: process.env.WHISPER_COMPUTE_TYPE || 'int8',
  });
  const text = String(payload.text || '');
  if (!text.trim()) throw new Error('Local Whisper returned no transcript text.');
  return {
    text,
    segments: normalizeSegments(payload.segments),
    speakerSections: [], confidence: null,
    provider: 'local-faster-whisper', language: payload.language || language,
  };
}

module.exports = { transcribeAudio, runLocalPython };
