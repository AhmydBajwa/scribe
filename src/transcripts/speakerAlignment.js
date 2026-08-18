function overlapMs(a, b) { return Math.max(0, Math.min(a.endMs, b.endMs) - Math.max(a.startMs, b.startMs)); }

function alignSpeakerSections(transcriptSegments = [], diarizationSegments = []) {
  return transcriptSegments.map((segment) => {
    const best = diarizationSegments.reduce((current, candidate) => {
      const overlap = overlapMs(segment, candidate);
      return overlap > current.overlap ? { candidate, overlap } : current;
    }, { candidate: null, overlap: 0 });
    return {
      speaker: best.candidate && best.overlap > 0 ? best.candidate.speaker : 'Unknown',
      startMs: segment.startMs, endMs: segment.endMs, text: String(segment.text || ''),
    };
  });
}

module.exports = { alignSpeakerSections, overlapMs };
