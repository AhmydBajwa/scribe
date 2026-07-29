const dotenv = require('dotenv');

dotenv.config();

const STATUS_MAP = {
  f: 'scheduled',
  o: 'scheduled',
  3: 'checked-in',
  2: 'completed',
  4: 'completed',
  x: 'cancelled',
};

const MOCK_PROVIDER_NAMES = new Map([
  ['1', 'Dr. Maya Patel'],
  ['2', 'Dr. Daniel Kim'],
]);
const MOCK_PATIENT_NAMES = new Map([
  ['9001', 'Alicia Nguyen'],
  ['9002', 'Elijah Brooks'],
  ['9003', 'Nina Alvarez'],
]);
const MOCK_DEPARTMENT_NAMES = new Map([
  ['1', 'Primary Care'],
  ['2', 'Cardiology'],
  ['3', 'Dermatology'],
]);

const athenaSeedAppointments = [
  {
    appointmentid: 'apt-1001',
    patientid: '9001',
    providerid: '1',
    departmentid: '1',
    date: '07/20/2026',
    starttime: '09:00',
    appointmentstatus: 'f',
    appointmenttype: 'Office Visit',
    appointmentnotes: [{ text: 'Annual wellness visit' }],
  },
  {
    appointmentid: 'apt-1002',
    patientid: '9002',
    providerid: '2',
    departmentid: '2',
    date: '07/20/2026',
    starttime: '11:30',
    appointmentstatus: '3',
    appointmenttype: 'Follow-up',
    appointmentnotes: [{ text: 'Follow-up for labs' }],
  },
  {
    appointmentid: 'apt-1003',
    patientid: '9003',
    providerid: '1',
    departmentid: '3',
    date: '07/21/2026',
    starttime: '08:15',
    appointmentstatus: '2',
    appointmenttype: 'Consult',
    appointmentnotes: [{ text: 'Dermatology consult' }],
  },
];

// Athena department/provider/patient IDs are only unique WITHIN a practice, so every
// cross-request cache below is keyed by `${practiceId}:${id}`, never by the bare id.
let tokenCache = null;
let departmentRecordCache = new Map(); // "practiceId:departmentId" -> department record
let providerRecordCache = new Map(); // "practiceId:providerId" -> provider record
let departmentsLoadedForPractice = new Set();
let providersLoadedForPractice = new Set();
let patientNameCache = new Map(); // "practiceId:patientId" -> name
let appointmentDayCache = new Map(); // "practiceId:departmentId" -> Map<isoDate, rawAppointment[]>
let mockAppointmentsCache = null;
let lastAthenaError = null;
let appointmentCache = new Map();
let lastSyncedLive = false;

function compositeKey(practiceId, id) {
  return `${practiceId}:${id}`;
}

function normalizeBaseUrl(baseUrl) {
  if (!baseUrl) {
    return '';
  }

  return baseUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function isoDateToAthenaDate(isoDate) {
  const [year, month, day] = isoDate.split('-');
  return `${month}/${day}/${year}`;
}

function athenaDateToIso(athenaDate) {
  const [month, day, year] = athenaDate.split('/');
  return `${year}-${month}-${day}`;
}

function enumerateIsoDates(startIso, endIso) {
  const dates = [];
  const cursor = new Date(`${startIso}T00:00:00Z`);
  const end = new Date(`${endIso}T00:00:00Z`);
  while (cursor.getTime() <= end.getTime()) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function getDefaultDateRange() {
  const now = new Date();
  const start = new Date(now.getFullYear() - 1, 0, 1);
  const end = new Date(now.getFullYear(), 11, 31);
  return {
    startDate: `${pad2(start.getMonth() + 1)}/${pad2(start.getDate())}/${start.getFullYear()}`,
    endDate: `${pad2(end.getMonth() + 1)}/${pad2(end.getDate())}/${end.getFullYear()}`,
  };
}

async function getAthenaAccessToken({ baseUrl, clientId, clientSecret, scope } = {}) {
  if (!baseUrl || !clientId || !clientSecret) {
    return null;
  }

  if (tokenCache && tokenCache.expiresAt > Date.now() + 5000) {
    return tokenCache.accessToken;
  }

  const cleanBaseUrl = normalizeBaseUrl(baseUrl);
  const tokenUrl = `https://${cleanBaseUrl}/oauth2/v1/token`;
  const formBody = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope,
  });

  const tryRequest = async (authorizationHeader) => {
    const headers = {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    };

    if (authorizationHeader) {
      headers.Authorization = authorizationHeader;
    }

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers,
      body: formBody,
    });

    if (!response.ok) {
      const payloadText = await response.text();
      throw new Error(`Athena token request failed with status ${response.status}: ${payloadText}`);
    }

    return response.json();
  };

  try {
    let payload;
    try {
      payload = await tryRequest();
    } catch (error) {
      const basicAuthHeader = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
      payload = await tryRequest(basicAuthHeader);
    }

    if (!payload.access_token) {
      return null;
    }

    tokenCache = {
      accessToken: payload.access_token,
      expiresAt: Date.now() + Number(payload.expires_in || 3600) * 1000,
    };
    return tokenCache.accessToken;
  } catch (error) {
    lastAthenaError = error.message;
    return null;
  }
}

async function getAthenaContext() {
  const baseUrl = process.env.ATHENAHEALTH_BASE_URL;
  const clientId = process.env.ATHENAHEALTH_CLIENT_ID;
  const clientSecret = process.env.ATHENAHEALTH_CLIENT_SECRET;
  const scope = process.env.ATHENAHEALTH_SCOPE;
  const practiceId = process.env.ATHENAHEALTH_PRACTICE_ID;

  if (!baseUrl || !clientId || !clientSecret || !practiceId) {
    lastAthenaError = 'Athena credentials are not fully configured.';
    return null;
  }

  const accessToken = await getAthenaAccessToken({ baseUrl, clientId, clientSecret, scope });
  if (!accessToken) {
    return null;
  }

  return { baseUrl, accessToken, practiceId };
}

// Provider/department "identity" records, not just id->name strings. Athena's provider
// record exposes `homedepartment` as a NAME string (not an id) - a real sandbox quirk,
// see EDGE_CASES.md - so colleague matching below is done by name, not id.
async function ensureDepartmentsLoaded({ baseUrl, accessToken, practiceId }) {
  if (departmentsLoadedForPractice.has(practiceId)) {
    return;
  }

  const cleanBaseUrl = normalizeBaseUrl(baseUrl);
  const response = await fetch(`https://${cleanBaseUrl}/v1/${practiceId}/departments?limit=200`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Athena departments request failed with status ${response.status}`);
  }

  const payload = await response.json();
  (payload.departments || []).forEach((dept) => {
    departmentRecordCache.set(compositeKey(practiceId, dept.departmentid), {
      id: String(dept.departmentid),
      practiceId: String(practiceId),
      name: dept.name,
      address: dept.address || null,
      phone: dept.phone || null,
    });
  });
  departmentsLoadedForPractice.add(practiceId);
}

async function ensureProvidersLoaded({ baseUrl, accessToken, practiceId }) {
  if (providersLoadedForPractice.has(practiceId)) {
    return;
  }

  const cleanBaseUrl = normalizeBaseUrl(baseUrl);
  const response = await fetch(`https://${cleanBaseUrl}/v1/${practiceId}/providers?limit=200`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Athena providers request failed with status ${response.status}`);
  }

  const payload = await response.json();
  (payload.providers || []).forEach((provider) => {
    providerRecordCache.set(compositeKey(practiceId, provider.providerid), {
      id: String(provider.providerid),
      practiceId: String(practiceId),
      displayName: provider.displayname || `${provider.firstname || ''} ${provider.lastname || ''}`.trim(),
      firstName: provider.firstname || null,
      lastName: provider.lastname || null,
      specialty: provider.specialty || null,
      npi: provider.npi || null,
      homeDepartmentName: provider.homedepartment || null,
      entityType: provider.entitytype || null,
    });
  });
  providersLoadedForPractice.add(practiceId);
}

async function getDepartmentRecords({ baseUrl, accessToken, practiceId }) {
  await ensureDepartmentsLoaded({ baseUrl, accessToken, practiceId });
  return [...departmentRecordCache.values()].filter((dept) => dept.practiceId === String(practiceId));
}

async function getProviderRecords({ baseUrl, accessToken, practiceId }) {
  await ensureProvidersLoaded({ baseUrl, accessToken, practiceId });
  return [...providerRecordCache.values()].filter((provider) => provider.practiceId === String(practiceId));
}

async function getDepartmentNameMap(context) {
  const records = await getDepartmentRecords(context);
  return new Map(records.map((dept) => [dept.id, dept.name]));
}

async function getProviderNameMap(context) {
  const records = await getProviderRecords(context);
  return new Map(records.map((provider) => [provider.id, provider.displayName]));
}

async function listDepartments() {
  const context = await getAthenaContext();
  if (!context) {
    return [];
  }
  try {
    const records = await getDepartmentRecords(context);
    lastAthenaError = null;
    return records;
  } catch (error) {
    lastAthenaError = error.message;
    return [];
  }
}

// Colleagues = other providers whose homeDepartmentName matches the given department.
// This is the department-scoped view: every provider in a department, not just one.
async function listProviders({ departmentId } = {}) {
  const context = await getAthenaContext();
  if (!context) {
    return [];
  }
  try {
    const providers = await getProviderRecords(context);
    lastAthenaError = null;
    if (!departmentId) {
      return providers;
    }
    const departments = await getDepartmentRecords(context);
    const department = departments.find((dept) => dept.id === String(departmentId));
    if (!department) {
      return [];
    }
    return providers.filter((provider) => provider.homeDepartmentName === department.name);
  } catch (error) {
    lastAthenaError = error.message;
    return [];
  }
}

function extractAthenaDocumentRows(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!payload || typeof payload !== 'object') {
    return [];
  }

  return payload.patientcases || payload.documents || payload.items || payload.results || payload.data || [];
}

function normalizeAthenaPatientCase(raw) {
  const patientCaseId = raw.patientcaseid != null ? String(raw.patientcaseid) : raw.documentid != null ? String(raw.documentid) : raw.id != null ? String(raw.id) : null;
  return {
    id: patientCaseId,
    patientCaseId,
    patientId: raw.patientid != null ? String(raw.patientid) : null,
    appointmentId: raw.appointmentid != null ? String(raw.appointmentid) : null,
    encounterId: raw.encounterid != null ? String(raw.encounterid) : null,
    departmentId: raw.departmentid != null ? String(raw.departmentid) : null,
    status: raw.status || null,
    subject: raw.subject || '',
    description: raw.description || '',
    documentClass: raw.documentclass || 'PATIENTCASE',
    documentSubclass: raw.documentsubclass || null,
    documentSource: raw.documentsource || null,
    assignedTo: raw.assignedto || null,
    createdDate: raw.createddate || raw.createddatetime || null,
    raw,
  };
}

async function fetchAthenaPatientCases({ baseUrl, accessToken, practiceId, patientId, departmentId }) {
  if (!baseUrl || !accessToken || !practiceId || patientId == null || departmentId == null) {
    return [];
  }

  const cleanBaseUrl = normalizeBaseUrl(baseUrl);
  const candidateUrls = [
    `https://${cleanBaseUrl}/v1/${practiceId}/patients/${patientId}/documents/patientcase?departmentid=${encodeURIComponent(departmentId)}`,
    `https://${cleanBaseUrl}/v1/${practiceId}/patients/${patientId}/documents?departmentid=${encodeURIComponent(departmentId)}&documentclass=PATIENTCASE`,
  ];

  for (const candidateUrl of candidateUrls) {
    try {
      const response = await fetch(candidateUrl, {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
      });

      if (!response.ok) {
        continue;
      }

      const payload = await response.json();
      return extractAthenaDocumentRows(payload).map(normalizeAthenaPatientCase);
    } catch (error) {
      continue;
    }
  }

  return [];
}

async function findAthenaPatientCaseForAppointment({ appointmentId, patientId, departmentId } = {}) {
  if (!appointmentId || patientId == null || departmentId == null) {
    return null;
  }

  if (process.env.USE_MOCK_ATHENA === 'true') {
    return null;
  }

  const context = await getAthenaContext();
  if (!context) {
    return null;
  }

  try {
    const patientCases = await fetchAthenaPatientCases({
      ...context,
      patientId,
      departmentId,
    });

    const matchingCase = patientCases
      .filter((item) => item.appointmentId === String(appointmentId))
      .sort((left, right) => {
        const leftTime = left.createdDate ? new Date(left.createdDate).getTime() : 0;
        const rightTime = right.createdDate ? new Date(right.createdDate).getTime() : 0;
        return rightTime - leftTime;
      })[0];

    return matchingCase || null;
  } catch (error) {
    lastAthenaError = error.message;
    return null;
  }
}

async function syncAthenaPatientCaseForAppointment(caseRecord) {
  if (!caseRecord) {
    return { status: 'skipped', athenaPatientCase: null };
  }

  if (process.env.USE_MOCK_ATHENA === 'true') {
    return { status: 'skipped', athenaPatientCase: null };
  }

  const athenaPatientCase = await findAthenaPatientCaseForAppointment({
    appointmentId: caseRecord.appointmentId,
    patientId: caseRecord.patientId,
    departmentId: caseRecord.departmentId,
  });

  if (!athenaPatientCase) {
    return { status: 'not-found', athenaPatientCase: null };
  }

  return { status: 'linked', athenaPatientCase };
}

async function resolvePatientNames({ baseUrl, accessToken, practiceId, patientIds }) {
  const cleanBaseUrl = normalizeBaseUrl(baseUrl);
  const idsToFetch = patientIds.filter((id) => !patientNameCache.has(compositeKey(practiceId, id)));
  const concurrency = 5;

  for (let i = 0; i < idsToFetch.length; i += concurrency) {
    const batch = idsToFetch.slice(i, i + concurrency);
    await Promise.all(
      batch.map(async (patientId) => {
        const cacheKey = compositeKey(practiceId, patientId);
        try {
          const response = await fetch(`https://${cleanBaseUrl}/v1/${practiceId}/patients/${patientId}`, {
            headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
          });

          if (!response.ok) {
            patientNameCache.set(cacheKey, `Patient ${patientId}`);
            return;
          }

          const payload = await response.json();
          const record = Array.isArray(payload) ? payload[0] : payload;
          const name = [record?.firstname, record?.lastname].filter(Boolean).join(' ');
          patientNameCache.set(cacheKey, name || `Patient ${patientId}`);
        } catch (error) {
          patientNameCache.set(cacheKey, `Patient ${patientId}`);
        }
      })
    );
  }

  const result = new Map();
  patientIds.forEach((id) => {
    result.set(id, patientNameCache.get(compositeKey(practiceId, id)));
  });
  return result;
}

function getDeptDayCache(practiceId, departmentId) {
  const key = compositeKey(practiceId, departmentId);
  if (!appointmentDayCache.has(key)) {
    appointmentDayCache.set(key, new Map());
  }
  return appointmentDayCache.get(key);
}

// Range-sync: for each department, only calls Athena for days not already cached.
// If every requested day is already cached, this department is served entirely from
// memory and no network request is made at all.
async function fetchAthenaAppointments({ baseUrl, accessToken, practiceId, startDateIso, endDateIso, departmentIds }) {
  const cleanBaseUrl = normalizeBaseUrl(baseUrl);
  const isoDates = enumerateIsoDates(startDateIso, endDateIso);
  const results = [];
  let syncedLive = false;

  for (const departmentId of departmentIds) {
    const dayCache = getDeptDayCache(practiceId, departmentId);
    const missingDates = isoDates.filter((date) => !dayCache.has(date));

    if (missingDates.length === 0) {
      isoDates.forEach((date) => results.push(...dayCache.get(date)));
      continue;
    }

    syncedLive = true;
    const startDate = isoDateToAthenaDate(startDateIso);
    const endDate = isoDateToAthenaDate(endDateIso);
    const query = new URLSearchParams({ startdate: startDate, enddate: endDate, departmentid: departmentId });
    const response = await fetch(`https://${cleanBaseUrl}/v1/${practiceId}/appointments/booked?${query}`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    });

    if (!response.ok) {
      const payloadText = await response.text();
      throw new Error(`Athena appointments request failed with status ${response.status}: ${payloadText}`);
    }

    const payload = await response.json();
    const fetchedByDate = new Map(isoDates.map((date) => [date, []]));
    (payload.appointments || []).forEach((raw) => {
      const isoDate = athenaDateToIso(raw.date);
      if (!fetchedByDate.has(isoDate)) {
        fetchedByDate.set(isoDate, []);
      }
      fetchedByDate.get(isoDate).push(raw);
    });
    fetchedByDate.forEach((appts, date) => dayCache.set(date, appts));

    isoDates.forEach((date) => results.push(...dayCache.get(date)));
  }

  lastSyncedLive = syncedLive;
  return results;
}

function normalizeAthenaAppointment(raw, { providerNameById = new Map(), patientNameById = new Map(), departmentNameById = new Map() } = {}) {
  const isoDate = athenaDateToIso(raw.date);
  const patientId = raw.patientid != null ? String(raw.patientid) : null;
  const providerId = raw.providerid != null ? String(raw.providerid) : null;
  const departmentId = raw.departmentid != null ? String(raw.departmentid) : null;

  return {
    id: String(raw.appointmentid),
    patientId,
    patient: (patientId && patientNameById.get(patientId)) || (patientId ? `Patient ${patientId}` : 'Unknown patient'),
    providerId,
    provider: (providerId && providerNameById.get(providerId)) || (providerId ? `Provider ${providerId}` : 'Unknown provider'),
    departmentId,
    department: (departmentId && departmentNameById.get(departmentId)) || (departmentId ? `Department ${departmentId}` : 'Unknown department'),
    date: isoDate,
    startTime: raw.starttime ? `${isoDate}T${raw.starttime}:00` : null,
    status: STATUS_MAP[raw.appointmentstatus] || 'scheduled',
    reason: raw.appointmentnotes?.[0]?.text || raw.appointmenttype || raw.patientappointmenttypename || '',
    visitType: raw.appointmenttype || raw.patientappointmenttypename || '',
  };
}

function cacheAppointments(appointments) {
  appointments.forEach((appointment) => {
    if (appointment?.id) {
      appointmentCache.set(String(appointment.id), appointment);
    }
  });
  return appointments;
}

function getCachedAppointmentById(appointmentId) {
  return appointmentCache.get(String(appointmentId)) || null;
}

function getMockAppointments() {
  if (!mockAppointmentsCache) {
    mockAppointmentsCache = athenaSeedAppointments.map((raw) =>
      normalizeAthenaAppointment(raw, {
        providerNameById: MOCK_PROVIDER_NAMES,
        patientNameById: MOCK_PATIENT_NAMES,
        departmentNameById: MOCK_DEPARTMENT_NAMES,
      })
    );
  }
  return mockAppointmentsCache;
}

function filterAppointments(appointments, { date, dateFrom, dateTo, provider, patient, status, departmentId } = {}) {
  return appointments.filter((appointment) => {
    const matchesDate = !date || appointment.date === date;
    const matchesDateFrom = !dateFrom || appointment.date >= dateFrom;
    const matchesDateTo = !dateTo || appointment.date <= dateTo;
    const matchesProvider = !provider || appointment.provider.toLowerCase().includes(provider.toLowerCase());
    const matchesPatient = !patient || appointment.patient.toLowerCase().includes(patient.toLowerCase());
    const matchesStatus = !status || appointment.status === status;
    const matchesDepartment = !departmentId || appointment.departmentId === String(departmentId);
    return matchesDate && matchesDateFrom && matchesDateTo && matchesProvider && matchesPatient && matchesStatus && matchesDepartment;
  });
}

async function getLiveAppointments(options) {
  const context = await getAthenaContext();
  if (!context) {
    return null;
  }
  const { baseUrl, accessToken, practiceId } = context;

  try {
    const departmentNameById = await getDepartmentNameMap(context);
    const providerNameById = await getProviderNameMap(context);

    let startDateIso;
    let endDateIso;
    if (options.dateFrom && options.dateTo) {
      startDateIso = options.dateFrom;
      endDateIso = options.dateTo;
    } else if (options.date) {
      startDateIso = options.date;
      endDateIso = options.date;
    } else {
      const defaults = getDefaultDateRange();
      startDateIso = athenaDateToIso(defaults.startDate);
      endDateIso = athenaDateToIso(defaults.endDate);
    }

    const departmentIds = options.departmentId
      ? [...departmentNameById.keys()].filter((id) => id === String(options.departmentId))
      : [...departmentNameById.keys()];

    const rawAppointments = await fetchAthenaAppointments({
      baseUrl,
      accessToken,
      practiceId,
      startDateIso,
      endDateIso,
      departmentIds,
    });

    const uniquePatientIds = [...new Set(rawAppointments.map((appointment) => String(appointment.patientid)))];
    const patientNameById = await resolvePatientNames({ baseUrl, accessToken, practiceId, patientIds: uniquePatientIds });

    lastAthenaError = null;
    return rawAppointments.map((raw) => normalizeAthenaAppointment(raw, { providerNameById, patientNameById, departmentNameById }));
  } catch (error) {
    lastAthenaError = error.message;
    return null;
  }
}

async function getAppointmentsWithSource(options = {}) {
  if (process.env.USE_MOCK_ATHENA === 'true') {
    cacheAppointments(getMockAppointments());
    return { appointments: filterAppointments(getMockAppointments(), options), source: 'sample', syncedLive: false };
  }

  const liveAppointments = await getLiveAppointments(options);
  if (liveAppointments) {
    cacheAppointments(liveAppointments);
    return { appointments: filterAppointments(liveAppointments, options), source: 'athena', syncedLive: lastSyncedLive };
  }

  cacheAppointments(getMockAppointments());
  return { appointments: filterAppointments(getMockAppointments(), options), source: 'sample', syncedLive: false };
}

async function getAppointments(options = {}) {
  const { appointments } = await getAppointmentsWithSource(options);
  return appointments;
}

async function getDashboardAppointments(options = {}) {
  const { appointments, source, syncedLive } = await getAppointmentsWithSource(options);
  const usingSampleData = source === 'sample';

  return {
    count: appointments.length,
    appointments,
    source,
    syncedLive,
    message: usingSampleData
      ? `Showing seeded sample appointments because the live Athena sandbox endpoint is unavailable.${lastAthenaError ? ` Reason: ${lastAthenaError}` : ''}`
      : syncedLive
      ? 'Showing live Athena appointments (freshly synced from the sandbox).'
      : 'Showing live Athena appointments (served from the in-memory sync cache).',
    summary: {
      scheduled: appointments.filter((item) => item.status === 'scheduled').length,
      checkedIn: appointments.filter((item) => item.status === 'checked-in').length,
      completed: appointments.filter((item) => item.status === 'completed').length,
    },
  };
}

function resetAthenaCachesForTests() {
  tokenCache = null;
  departmentRecordCache = new Map();
  providerRecordCache = new Map();
  departmentsLoadedForPractice = new Set();
  providersLoadedForPractice = new Set();
  patientNameCache = new Map();
  appointmentDayCache = new Map();
  mockAppointmentsCache = null;
  lastAthenaError = null;
  appointmentCache = new Map();
  lastSyncedLive = false;
}

module.exports = {
  athenaSeedAppointments,
  normalizeAthenaAppointment,
  filterAppointments,
  fetchAthenaAppointments,
  getAthenaAccessToken,
  getAthenaContext,
  getDepartmentNameMap,
  getProviderNameMap,
  getDepartmentRecords,
  getProviderRecords,
  listDepartments,
  listProviders,
  extractAthenaDocumentRows,
  normalizeAthenaPatientCase,
  fetchAthenaPatientCases,
  findAthenaPatientCaseForAppointment,
  syncAthenaPatientCaseForAppointment,
  resolvePatientNames,
  getAppointments,
  getAppointmentsWithSource,
  getDashboardAppointments,
  getMockAppointments,
  getCachedAppointmentById,
  resetAthenaCachesForTests,
};
