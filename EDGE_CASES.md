# Athena Sandbox — Edge Cases & Quirks

Notes from building against the real athenahealth Preview sandbox (practice `3338002`,
base URL `https://api.preview.platform.athenahealth.com`). Everything here was found by
hitting the live API, not read off documentation — several of these directly contradict
what a first read of the docs (or the endpoint naming) would suggest.

## Auth

- **Token endpoint is `/oauth2/v1/token`, not `/oauth/token`.** The latter 404s. Easy
  mistake — `/oauth/token` is what a lot of athenahealth v1 API examples reference for a
  different (practice-credential) grant flow; the client-credentials flow used here lives
  under `/oauth2/v1/token`.
- Both credential-delivery styles work against this token endpoint: `client_id`/
  `client_secret` in the POST body, or an `Authorization: Basic <base64>` header. We try
  body-first and fall back to Basic on failure — belt and suspenders, since which one a
  given sandbox/practice accepts isn't guaranteed.
- Tokens expire in ~3600s (`expires_in` in the response). We cache and reuse until ~5s
  before expiry rather than re-authenticating on every request.

## Departments & providers

- **`GET /v1/{practiceId}/departments` and `GET /v1/{practiceId}/providers` are not
  paginated in any way we could detect** for this practice size — no `next` token,
  `totalcount` matches the returned array length. We still pass `?limit=200` defensively,
  but for a larger practice this may need real pagination handling.
- **A provider's `homedepartment` field is a department NAME string, not a department
  ID.** e.g. `"homedepartment": "Optimed Immunology"` — there is no `homedepartmentid`.
  Any code that groups "colleague" providers by department has to resolve the target
  department's `id` → `name` first and match on name, not id. This bit us once already
  while building the department-scoped provider list.
- **Department/provider/patient IDs are only unique within a practice.** `providerid: 1`
  in one practice has no relation to `providerid: 1` in another. We namespace every
  in-memory cache entry as `` `${practiceId}:${id}` `` for this reason, even though these
  credentials only expose one practice.
- **There is no endpoint to enumerate the practices a credential set can access** — we
  checked `GET /v1/practices` and it 404s ("An unknown API path was called"). The practice
  ID has to be supplied out of band (it's in `.env` as `ATHENAHEALTH_PRACTICE_ID`); there
  is no way to discover or validate it from the API itself, and no way to test true
  multi-practice behavior with only one practice ID in hand.

## This specific sandbox's data shape

- Practice `3338002` has **3 departments** (`Optimed Immunology`, `IP OHIOHEALTH
  CORPORATION`, `OP OHIOHEALTH CORPORATION`) but **only department 1 (Optimed Immunology)
  has any appointment data** — the other two return `{"appointments":[],"totalcount":0}`
  at every date we tried, including a 40-year sweep (2000–2040). This isn't a bug in our
  fetch logic; it's genuinely empty data.
- Practice `3338002` has **exactly 1 provider** (`Donald McNeil, MD`, Allergy/Immunology).
  Every appointment in the sandbox belongs to this one provider. This means:
  - "Colleague provider" grouping logic is implemented and unit-tested (see
    `test/appointments.test.js`), but **cannot be exercised end-to-end against real data**
    — there's nobody to be a colleague of.
  - Real appointment data never double-books this provider — no two appointments share
    the same department+hour anywhere in the sandbox. The overlap-aware "+N more"
    calendar UI is implemented and works, but was verified by injecting synthetic
    overlapping appointments into a live page and re-rendering, not by finding real
    double-bookings (there aren't any).

## Booked appointments endpoint

- `GET /v1/{practiceId}/appointments/booked` requires **both** a date range
  (`startdate`/`enddate`, `MM/DD/YYYY`) **and** at least one of `departmentid` /
  `providerid` — omitting either returns a `400` with a `missingfields`/`detailedmessage`
  explaining exactly what's missing. There's no way to query "everything, no filter."
- **Appointment data is not confined to "this year."** In this sandbox it spans roughly
  June 2025 – July 2026. An earlier version of this app defaulted to a Jan 1–Dec 31
  (current year) window and silently dropped ~70% of real appointments (209 total vs. 61
  visible) — nothing errored, it just looked like less data existed than actually did. The
  default window is now a rolling two-year range (last year through this year); explicit
  `date` / `dateFrom`+`dateTo` params always take priority.
- `appointmentstatus` codes observed in real data and how we map them (not exhaustively
  documented by Athena as far as we found — inferred from behavior):
  | code | meaning we assume | our internal status |
  |---|---|---|
  | `f` | filled/booked | `scheduled` |
  | `o` | open slot | `scheduled` (shouldn't appear from `/booked`) |
  | `3` | checked-in | `checked-in` |
  | `2` | checked-out | `completed` |
  | `4` | checked-out (alt) | `completed` |
  | `x` | cancelled | `cancelled` |

## Patient lookups

- There is **no batch/multi-ID patient lookup endpoint.** `GET
  /v1/{practiceId}/patients?patientid=1,2,3` returns a 400 asking for a search field
  (name, dob, phone, etc.), not a way to fetch several known IDs at once. Resolving names
  for N unique patients costs N individual `GET /patients/{id}` calls.
  - Real-world cost: a 2-year range in this sandbox touches ~150+ unique patients. Cold,
    with 5-way concurrency, that's ~15–20 seconds on first load.
  - Mitigated by caching resolved patient names in memory indefinitely (practice-namespaced)
    and, more importantly, by the day-level appointment range cache (see below) so repeat
    navigation to an already-seen range costs nothing.

## Range-sync cache

- Appointment data for a given department is cached per calendar day (not per arbitrary
  range) — `${practiceId}:${departmentId} -> Map<isoDate, rawAppointments[]>`. A request
  is served entirely from cache only if *every* day in the requested range is already
  present (including days confirmed to have zero appointments — those are cached as empty
  arrays so they aren't refetched forever). If even one day is missing, the **whole**
  requested range is re-fetched for that department and the cache is refreshed — we don't
  attempt sub-range diffing/merging, just whole-range fetch-or-skip at day granularity.
  Simpler to reason about; slightly more re-fetching than a fully general interval-merge
  cache would do, but in practice week/day navigation re-visits the same ranges often
  enough that this still eliminates the vast majority of redundant Athena calls (confirmed
  live: repeat identical request dropped from ~4.1s to ~0.14s).

## Real SAML SSO (samlify + a self-contained local IdP)

Not an Athena quirk, but the same "found by actually running it, not by reading docs"
spirit applies to adding real SAML. Notes for whoever touches `src/auth/` next:

- **`samlify`'s schema (XSD) validator is not optional — it throws if you don't set one.**
  `SamlLib.isValidXml` rejects with "potentially vulnerable... no validation function
  found" unless `samlify.setSchemaValidator(...)` has been called. We stub it to always
  resolve `'SUCCESS'` (see `src/auth/samlEntities.js`) rather than pull in an `xmllint`
  binary dependency. This skips *structural* XML linting only — the actual
  security-relevant check, XML-DSig signature verification, is separate and is not
  stubbed; it's exercised for real in `test/sso.test.js` (a genuinely invalid/forged
  `SAMLResponse` is rejected with 401).
- **`signingCert` must be the bare base64 cert body, not a full PEM block.** Passing the
  full `-----BEGIN CERTIFICATE-----...-----END-----` string in `IdentityProviderSettings`
  causes `getX509Certificate('signing')` to come back `null` at response-signing time (it
  round-trips the settings through generated metadata XML, and a `<X509Certificate>`
  element isn't supposed to contain PEM armor). Strip headers/footers/newlines before
  passing it in — see `stripPemArmor()` in `src/auth/certs.js`.
- **`selfsigned@5.x`'s `generate()` is `async`**, unlike older versions which were
  sync-with-optional-callback. Easy to miss if you've used this package before; forgetting
  `await` gives a confusing "Cannot read properties of undefined" deep inside samlify
  rather than an obvious error at the call site.
- **First-run certificate generation is a real race condition**, not a theoretical one —
  it reproduced on the very first attempt at running the full test suite (multiple test
  files spin up their own server instances; all of them called
  `loadOrCreateIdpCertificate()` concurrently before `certs/idp-*.pem` existed on disk,
  and some processes ended up reading a partially-written file). Fixed with an
  exclusive-create (`{ flag: 'wx' }`) lock file: the process that wins the race generates
  and writes both files, everyone else polls briefly and reads the finished result rather
  than also generating. Verified stable across 3 consecutive cold-start (`rm -rf certs/`)
  full-suite runs after the fix.
- **Only the IdP needs a keypair.** `authnRequestsSigned: false` on the SP side means no
  SP certificate/private key is needed at all - matches how most real-world SPs behave
  (they trust the IdP's signature on the response; they don't bother signing the request).
  Simplifies setup meaningfully: one certificate to generate and manage, not two.
- **SAML attribute statements (`loginResponseTemplate.attributes`) were not used.** The
  library's attribute-templating path expects the caller to pre-populate
  `attr<CapitalizedValueTag>` keys on the `user` object passed to `createLoginResponse`
  rather than filling them in automatically from arbitrary `user.xxx` fields - workable,
  but under-documented enough that we decided not to depend on it. Instead only `NameID`
  (the user's email) is carried in the assertion, and the SP looks up the rest of the
  profile (name, role, organization) from the same local user directory
  (`src/auth/users.js`) by that NameID. Standard, realistic pattern - real SPs commonly
  enrich a bare NameID/email against their own user store rather than relying on the IdP
  to release every attribute.
