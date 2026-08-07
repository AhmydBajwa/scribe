const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createCase, getCase, updateAthenaLifecycleStatus, updateClinicalData,
  listCaseActivity, resetCasesForTests,
} = require('../src/cases/cases');

test.beforeEach(() => resetCasesForTests());

test('keeps workflow stage separate from Athena lifecycle state', () => {
  const created = createCase({ patientName: 'Case Patient' });
  assert.equal(created.case.workflowStage, 'New');
  assert.equal(created.case.athenaLifecycleStatus, 'REVIEW');
  const result = updateAthenaLifecycleStatus(created.case.id, 'CLOSED', 'Admin', 'Resolved in Athena');
  assert.equal(result.ok, true);
  const loaded = getCase(created.case.id);
  assert.equal(loaded.workflowStage, 'New');
  assert.equal(loaded.athenaLifecycleStatus, 'CLOSED');
  assert.ok(listCaseActivity(created.case.id).some((entry) => entry.action === 'athena:closed'));
});

test('stores orders and diagnoses independently from appointment context', () => {
  const created = createCase({ patientName: 'Clinical Patient' });
  const result = updateClinicalData(created.case.id, { orders: ['CBC'], diagnoses: ['R50.9'] }, 'Admin');
  assert.equal(result.ok, true);
  assert.deepEqual(getCase(created.case.id).orders, ['CBC']);
  assert.deepEqual(getCase(created.case.id).diagnoses, ['R50.9']);
});
