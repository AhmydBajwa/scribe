function buildPromptInput(caseRecord, transcript) {
  if (!caseRecord || !transcript || transcript.status !== 'approved') throw new Error('An approved transcript is required to build prompt input.');
  return {
    caseId: caseRecord.id,
    patient: { id: caseRecord.patientId || null, name: caseRecord.patientName || null },
    appointment: { id: caseRecord.appointmentId || null, date: caseRecord.appointmentDate || null, provider: caseRecord.providerName || null, department: caseRecord.department || null, reason: caseRecord.reason || null, visitType: caseRecord.visitType || null },
    transcript: { id: transcript.id, text: transcript.cleanedText, speakers: transcript.speakerSections || [], reviewedBy: transcript.reviewedBy || null, reviewedAt: transcript.reviewedAt || null },
    clinicalContext: { diagnoses: caseRecord.diagnoses || [], orders: caseRecord.orders || [] },
  };
}

module.exports = { buildPromptInput };
