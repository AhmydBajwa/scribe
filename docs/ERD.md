# ScribeKit data model (Chen-style reading guide)

```text
[Practice] 1 ── has ── N [PracticeMember]
[PracticeMember] N ── identifies ── 1 [User]

[Practice] 1 ── contains ── N [Encounter]
[Appointment] 0..1 ── originates ── 1 [Encounter]
[Patient] 1 ── belongs to ── N [Encounter]
[Provider] 0..1 ── attends ── N [Encounter]
[Encounter] 0..1 ── links ── 0..1 [AthenaPatientCase]
[Encounter] 1 ── records ── N [Activity]
[Encounter] 1 ── owns ── N [AudioRecording]
[Encounter] 1 ── carries ── N [Order]
[Encounter] 1 ── carries ── N [Diagnosis]
```

`Encounter` stores both `workflowStage` and `athenaLifecycleStatus`. `Activity`
is append-only and carries actor, action, details, and timestamp. Athena patient
cases are linked by Athena IDs and remain distinct from the local encounter.
