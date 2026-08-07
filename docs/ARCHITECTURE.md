# ScribeKit architecture rulebook

This repository is an Express application. Routes may coordinate work but may not
contain persistence or Athena protocol details. `src/auth` owns identity and
practice membership; `src/appointments` owns Athena requests and normalization;
`src/cases` owns encounter/case state, activity, feed state, and audio metadata.
The browser only calls HTTP endpoints and never calls Athena directly.

Dependency direction is one way: routes -> domain modules -> integrations/storage.
`cases` may read the appointment cache to create an encounter from an appointment;
Athena integrations must not import route or browser code. Audio is currently a
local-disk adapter behind the case module; replacing it with S3 belongs in that
module without changing routes or the UI contract.

## Case model

An **Encounter** is the local appointment-derived clinical workspace. An Athena
**patient case** is a separate staff-review object. The link is optional because
Athena may create either record first.

Encounters hold two intentionally distinct state fields:

- `workflowStage`: the ScribeKit display workflow (New through Failed).
- `athenaLifecycleStatus`: only `REVIEW` or `CLOSED`, the source-of-truth-facing
  lifecycle. Closing/reopening is audited independently of transcript workflow.

Admin notes are submitted through the Athena patient-case action-note integration;
the local activity log records that submission for audit/display.

## Operational seams

- `src/cases/feed.js` is the sole change-feed boundary. Set
  `ATHENAHEALTH_PATIENT_CASE_FEED_URL` to enable live drain; its health endpoint
  deliberately shows configuration, cursor, queued events, last success, and error.
- `src/auth/practiceRoles.js` persists membership roles per practice. It seeds the
  demo users at first login, but a production deployment should replace this adapter
  with Athena/provider identity claims or a database.
- JSON files are suitable for this demo only. Concurrent multi-process production
  use requires transactional database storage.
