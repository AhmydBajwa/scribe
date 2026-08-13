const SAFE_REPEATED_WORDS = new Set([
  'a', 'an', 'and', 'as', 'at', 'but', 'for', 'from', 'in', 'is', 'it', 'of', 'on', 'or', 'the', 'that', 'this', 'to', 'with',
]);

function collapseSafeRepeatedWords(text) {
  return text.replace(/\b([A-Za-z][A-Za-z'-]*)\s+\1\b/gi, (whole, word) => (
    SAFE_REPEATED_WORDS.has(String(word).toLowerCase()) ? word : whole
  ));
}

// Deterministic, deliberately conservative cleanup. This function never
// diagnoses, corrects terminology, changes doses, or rewrites clinical meaning.
function cleanTranscript(rawText) {
  const source = String(rawText || '');
  const rulesApplied = [];
  let text = source.replace(/\s+/g, ' ').trim();
  if (text !== source.trim()) rulesApplied.push('normalize-whitespace');

  const withoutArtifacts = text.replace(/\[(?:background noise|inaudible|music|crosstalk)\]/gi, '');
  if (withoutArtifacts !== text) {
    text = withoutArtifacts;
    rulesApplied.push('remove-recording-artifacts');
  }

  // Only remove conventional, standalone hesitation tokens. We intentionally
  // leave medical terms, names, numbers, negations, and uncertainty untouched.
  const withoutFillers = text
    .replace(/(?:\b(?:um+|uh+|erm)\b\s*,?\s*){1,}(?=(?:\b(?:the|a|an|patient|i|we|he|she|they)\b))/gi, '')
    .replace(/^\s*(?:um+|uh+|erm)\b\s*,?\s*/i, '');
  if (withoutFillers !== text) {
    text = withoutFillers;
    rulesApplied.push('remove-filler');
  }

  // Restrict repetition collapsing to non-clinical function words; repeated
  // medication names or terms may be meaningful and must be retained.
  const collapsed = collapseSafeRepeatedWords(text);
  if (collapsed !== text) {
    text = collapsed;
    rulesApplied.push('collapse-repeated-word');
  }

  const normalizedPunctuation = text.replace(/^\s*,\s*/, '').replace(/\s+([,.!?;:])/g, '$1').replace(/\s{2,}/g, ' ').trim();
  if (normalizedPunctuation !== text && !rulesApplied.includes('normalize-whitespace')) rulesApplied.push('normalize-whitespace');
  return { cleanedText: normalizedPunctuation, rulesApplied, cleanerVersion: 'v2' };
}

module.exports = { cleanTranscript };
