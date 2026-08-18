// Idempotent migration for stores created before workflowStage and Athena
// lifecycle were split. Run: node scripts/migrate_case_model.js
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'data', 'cases.json');
const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
let changed = 0;
payload.cases = (payload.cases || []).map((entry) => {
  const next = { ...entry };
  if (!next.practiceId) { next.practiceId = String(process.env.ATHENAHEALTH_PRACTICE_ID || 'default'); changed += 1; }
  if (!next.workflowStage) { next.workflowStage = next.status || 'New'; changed += 1; }
  if (!next.athenaLifecycleStatus) { next.athenaLifecycleStatus = 'REVIEW'; changed += 1; }
  if (!Array.isArray(next.athenaLifecycleHistory)) { next.athenaLifecycleHistory = [{ status: next.athenaLifecycleStatus, at: next.createdAt || new Date().toISOString() }]; changed += 1; }
  if (!Array.isArray(next.orders)) { next.orders = []; changed += 1; }
  if (!Array.isArray(next.diagnoses)) { next.diagnoses = []; changed += 1; }
  return next;
});
fs.writeFileSync(file, JSON.stringify(payload, null, 2));
console.log(`Migrated ${changed} field(s) in ${file}`);
