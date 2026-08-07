# Codebase report

## Runtime path

`server.js` builds the Express application, serves `public/index.html`, and
mounts authentication, appointments, intake, case, audio, practice-settings,
and feed routes. The browser is deliberately framework-free; its `window.App`
object is the public UI boundary.

## Modules

- `src/auth/saml.js`, `idp.js`, and `samlEntities.js` implement the local
  SP-initiated SAML flow. `practiceRoles.js` enriches a signed-in identity with
  the role for the active practice.
- `src/appointments/athena.js` obtains OAuth tokens, normalizes Athena data,
  performs patient/case requests, and caches appointment ranges.
- `src/cases/cases.js` is the local encounter aggregate: workflow/lifecycle,
  clinical data, activity, audio metadata, and Athena links. `feed.js` is the
  only change-feed integration boundary.
- `src/patients/patientRefs.js` records an intake-created Athena-patient link.

## Technical debt to address next

1. Replace JSON files and memory sessions with database-backed repositories and
   durable session storage before multi-instance deployment.
2. Supply the confirmed Athena change-feed URL and authenticated subscription
   credentials in the deployment environment; the UI reports this configuration
   explicitly instead of pretending a practice-wide list is current.
3. Replace demo users and locally generated SAML credentials with the real IdP
   and secret manager. Do not commit credentials or private keys.
4. Move the large `public/index.html` script into tested modules/components when
   the UI grows further.
