function cleanTranscript(rawText) {
  const source = String(rawText || '');
  const rulesApplied = [];
  let text = source.replace(/\s+/g, ' ').trim();
  if (text !== source.trim()) rulesApplied.push('normalize-whitespace');

  const withoutArtifacts = text.replace(/\[(?:background noise|inaudible|crosstalk)\]/gi, '');
  if (withoutArtifacts !== text) { text = withoutArtifacts; rulesApplied.push('remove-recording-artifacts'); }

  const withoutFillers = text.replace(/\b(?:um+|uh+|erm|ah)\b(?:\s*,\s*\b(?:um+|uh+|erm|ah)\b)+/gi, '').replace(/\b(?:um+|uh+|erm)\s*,\s*/gi, '');
  if (withoutFillers !== text) { text = withoutFillers; rulesApplied.push('remove-repeated-fillers'); }

  const collapsed = text.replace(/\b([A-Za-z][A-Za-z'-]*)\s+\1\b/gi, '$1');
  if (collapsed !== text) { text = collapsed; rulesApplied.push('collapse-immediate-repetition'); }

  text = text.replace(/^\s*,\s*/, '').replace(/\s+([,.!?;:])/g, '$1').replace(/\s{2,}/g, ' ').trim();
  return { cleanedText: text, rulesApplied, cleanerVersion: 'v1' };
}

module.exports = { cleanTranscript };
