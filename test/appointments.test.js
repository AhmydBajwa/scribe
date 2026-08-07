const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getAppointments,
  getDashboardAppointments,
  normalizeAthenaAppointment,
  filterAppointments,
  fetchAthenaAppointments,
  getAthenaAccessToken,
  listDepartments,
  listProviders,
  resetAthenaCachesForTests,
} = require('../src/appointments/athena');
const { requireAuth } = require('../src/auth/saml');
const { app } = require('../server');

function createMockRes() {
  return {
    statusCode: 200,
    body: null,
    redirectUrl: null,
    cookies: [],
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    redirect(url) {
      this.redirectUrl = url;
      return this;
    },
    cookie(name, value) {
      this.cookies.push({ name, value });
      return this;
    },
  };
}

function withMockAthena(fn) {
  return async () => {
    const original = process.env.USE_MOCK_ATHENA;
    process.env.USE_MOCK_ATHENA = 'true';
    try {
      await fn();
    } finally {
      process.env.USE_MOCK_ATHENA = original;
    }
  };
}

test('normalizes a raw Athena appointment using provider/patient/department lookups', () => {
  const raw = {
    appointmentid: '169',
    patientid: '24583',
    providerid: '1',
    departmentid: '1',
    date: '01/20/2026',
    starttime: '09:00',
    appointmentstatus: 'f',
    appointmenttype: 'FOLLOW UP 45',
    appointmentnotes: [{ text: '6 mo CVID f/u' }],
  };

  const normalized = normalizeAthenaAppointment(raw, {
    providerNameById: new Map([['1', 'Donald McNeil, MD']]),
    patientNameById: new Map([['24583', 'Emelie Monahan']]),
    departmentNameById: new Map([['1', 'Optimed Immunology']]),
  });

  assert.equal(normalized.patient, 'Emelie Monahan');
  assert.equal(normalized.provider, 'Donald McNeil, MD');
  assert.equal(normalized.department, 'Optimed Immunology');
  assert.equal(normalized.date, '2026-01-20');
  assert.equal(normalized.startTime, '2026-01-20T09:00:00');
  assert.equal(normalized.status, 'scheduled');
  assert.equal(normalized.reason, '6 mo CVID f/u');
});

test('maps Athena status codes to dashboard statuses', () => {
  const base = { appointmentid: '1', patientid: '1', providerid: '1', departmentid: '1', date: '01/01/2026', starttime: '09:00' };
  assert.equal(normalizeAthenaAppointment({ ...base, appointmentstatus: 'f' }).status, 'scheduled');
  assert.equal(normalizeAthenaAppointment({ ...base, appointmentstatus: '3' }).status, 'checked-in');
  assert.equal(normalizeAthenaAppointment({ ...base, appointmentstatus: '2' }).status, 'completed');
  assert.equal(normalizeAthenaAppointment({ ...base, appointmentstatus: 'x' }).status, 'cancelled');
});

test('falls back to a placeholder name when a lookup is missing', () => {
  const raw = { appointmentid: '1', patientid: '55', providerid: '9', departmentid: '2', date: '01/01/2026', starttime: '09:00', appointmentstatus: 'f' };
  const normalized = normalizeAthenaAppointment(raw);
  assert.equal(normalized.patientId, '55');
  assert.equal(normalized.patient, 'Patient 55');
  assert.equal(normalized.provider, 'Provider 9');
  assert.equal(normalized.department, 'Department 2');
});

test('reports patientId as null and falls back to "Unknown patient" when Athena omits it', () => {
  const raw = { appointmentid: '1', providerid: '9', departmentid: '2', date: '01/01/2026', starttime: '09:00', appointmentstatus: 'f' };
  const normalized = normalizeAthenaAppointment(raw);
  assert.equal(normalized.patientId, null);
  assert.equal(normalized.patient, 'Unknown patient');
});

test(
  'filters appointments by provider and status using seeded mock data',
  withMockAthena(async () => {
    const filtered = await getAppointments({ provider: 'maya', status: 'scheduled' });
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].provider, 'Dr. Maya Patel');
  })
);

test(
  'builds dashboard summary counts from seeded mock data',
  withMockAthena(async () => {
    const dashboard = await getDashboardAppointments();
    assert.equal(dashboard.count, 3);
    assert.equal(dashboard.summary.scheduled, 1);
    assert.equal(dashboard.summary.checkedIn, 1);
    assert.equal(dashboard.summary.completed, 1);
    assert.equal(dashboard.source, 'sample');
  })
);

test('requires authentication before access', () => {
  const req = { cookies: {} };
  const res = createMockRes();
  let nextCalled = false;
  const next = () => {
    nextCalled = true;
  };

  requireAuth(req, res, next);
  assert.equal(res.statusCode, 401);
  assert.equal(nextCalled, false);
});

test('fetches booked appointments across departments from a configured Athena sandbox endpoint', async () => {
  resetAthenaCachesForTests();
  const originalFetch = global.fetch;
  const requestedUrls = [];
  global.fetch = async (url) => {
    const target = url.toString();
    requestedUrls.push(target);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        appointments: [
          {
            appointmentid: '1',
            patientid: '1',
            providerid: '1',
            departmentid: target.includes('departmentid=2') ? '2' : '1',
            date: '01/20/2026',
            starttime: '09:00',
            appointmentstatus: 'f',
          },
        ],
        totalcount: 1,
      }),
    };
  };

  try {
    const appointments = await fetchAthenaAppointments({
      baseUrl: 'https://sandbox.athenahealth.com',
      accessToken: 'demo-token',
      practiceId: '123',
      startDateIso: '2026-01-01',
      endDateIso: '2026-12-31',
      departmentIds: ['1', '2'],
    });

    assert.equal(appointments.length, 2);
    assert.equal(requestedUrls.length, 2);
    assert.match(requestedUrls[0], /\/v1\/123\/appointments\/booked\?startdate=01%2F01%2F2026&enddate=12%2F31%2F2026&departmentid=1/);
  } finally {
    global.fetch = originalFetch;
    resetAthenaCachesForTests();
  }
});

test('skips a department entirely when its whole requested range is already cached', async () => {
  resetAthenaCachesForTests();
  const originalFetch = global.fetch;
  let requestCount = 0;
  global.fetch = async () => {
    requestCount += 1;
    return {
      ok: true,
      status: 200,
      json: async () => ({
        appointments: [
          { appointmentid: '1', patientid: '1', providerid: '1', departmentid: '1', date: '01/20/2026', starttime: '09:00', appointmentstatus: 'f' },
        ],
        totalcount: 1,
      }),
    };
  };

  try {
    const args = {
      baseUrl: 'https://sandbox.athenahealth.com',
      accessToken: 'demo-token',
      practiceId: '123',
      startDateIso: '2026-01-18',
      endDateIso: '2026-01-24',
      departmentIds: ['1'],
    };
    const first = await fetchAthenaAppointments(args);
    const second = await fetchAthenaAppointments(args);

    assert.equal(requestCount, 1, 'second call for the same range should be served entirely from the day cache');
    assert.equal(first.length, second.length);
  } finally {
    global.fetch = originalFetch;
    resetAthenaCachesForTests();
  }
});

test('only re-fetches the departments/days that are not already cached', async () => {
  resetAthenaCachesForTests();
  const originalFetch = global.fetch;
  const requestedUrls = [];
  global.fetch = async (url) => {
    requestedUrls.push(url.toString());
    return { ok: true, status: 200, json: async () => ({ appointments: [], totalcount: 0 }) };
  };

  try {
    await fetchAthenaAppointments({
      baseUrl: 'https://sandbox.athenahealth.com',
      accessToken: 'demo-token',
      practiceId: '123',
      startDateIso: '2026-01-18',
      endDateIso: '2026-01-24',
      departmentIds: ['1', '2'],
    });
    assert.equal(requestedUrls.length, 2);

    requestedUrls.length = 0;
    await fetchAthenaAppointments({
      baseUrl: 'https://sandbox.athenahealth.com',
      accessToken: 'demo-token',
      practiceId: '123',
      startDateIso: '2026-01-18',
      endDateIso: '2026-01-31',
      departmentIds: ['1', '2'],
    });
    assert.equal(requestedUrls.length, 2, 'a range extending past what is cached should re-fetch, but only for the requested departments');
  } finally {
    global.fetch = originalFetch;
    resetAthenaCachesForTests();
  }
});

test('requests a token from the oauth2 endpoint and falls back to Basic auth', async () => {
  resetAthenaCachesForTests();
  const originalFetch = global.fetch;
  const requestedUrls = [];
  let attempt = 0;
  global.fetch = async (url) => {
    requestedUrls.push(url.toString());
    attempt += 1;
    if (attempt === 1) {
      return { ok: false, status: 400, json: async () => ({ error: 'invalid_client' }) };
    }
    return { ok: true, status: 200, json: async () => ({ access_token: 'fallback-token', expires_in: 3600 }) };
  };

  try {
    const token = await getAthenaAccessToken({
      baseUrl: 'sandbox.athenahealth.com',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      scope: 'scope',
    });

    assert.equal(token, 'fallback-token');
    assert.equal(attempt, 2);
    assert.match(requestedUrls[0], /\/oauth2\/v1\/token$/);
  } finally {
    global.fetch = originalFetch;
    resetAthenaCachesForTests();
  }
});

test('caches the access token instead of requesting a new one on every call', async () => {
  resetAthenaCachesForTests();
  const originalFetch = global.fetch;
  let requestCount = 0;
  global.fetch = async () => {
    requestCount += 1;
    return { ok: true, status: 200, json: async () => ({ access_token: 'cached-token', expires_in: 3600 }) };
  };

  try {
    const options = { baseUrl: 'sandbox.athenahealth.com', clientId: 'id', clientSecret: 'secret', scope: 'scope' };
    const first = await getAthenaAccessToken(options);
    const second = await getAthenaAccessToken(options);
    assert.equal(first, 'cached-token');
    assert.equal(second, 'cached-token');
    assert.equal(requestCount, 1);
  } finally {
    global.fetch = originalFetch;
    resetAthenaCachesForTests();
  }
});

test('shares one in-flight Athena token request across concurrent callers', async () => {
  resetAthenaCachesForTests();
  const originalFetch = global.fetch;
  let requestCount = 0;
  global.fetch = async () => {
    requestCount += 1;
    return { ok: true, status: 200, json: async () => ({ access_token: 'shared-token', expires_in: 3600 }) };
  };

  try {
    const options = { baseUrl: 'sandbox.athenahealth.com', clientId: 'id', clientSecret: 'secret', scope: 'scope' };
    const [first, second, third] = await Promise.all([
      getAthenaAccessToken(options),
      getAthenaAccessToken(options),
      getAthenaAccessToken(options),
    ]);
    assert.deepEqual([first, second, third], ['shared-token', 'shared-token', 'shared-token']);
    assert.equal(requestCount, 1);
  } finally {
    global.fetch = originalFetch;
    resetAthenaCachesForTests();
  }
});

test('backs off after a network failure instead of retrying every dashboard request', async () => {
  resetAthenaCachesForTests();
  const originalFetch = global.fetch;
  const originalMock = process.env.USE_MOCK_ATHENA;
  const originalCooldown = process.env.ATHENA_FAILURE_COOLDOWN_MS;
  let requestCount = 0;
  process.env.USE_MOCK_ATHENA = 'false';
  process.env.ATHENA_FAILURE_COOLDOWN_MS = '60000';
  global.fetch = async () => {
    requestCount += 1;
    throw new TypeError('fetch failed');
  };

  try {
    const first = await getDashboardAppointments();
    const second = await getDashboardAppointments();
    assert.equal(first.source, 'sample');
    assert.equal(second.source, 'sample');
    assert.equal(requestCount, 1);
    assert.match(second.message, /temporarily paused/i);
  } finally {
    global.fetch = originalFetch;
    if (originalMock === undefined) delete process.env.USE_MOCK_ATHENA;
    else process.env.USE_MOCK_ATHENA = originalMock;
    if (originalCooldown === undefined) delete process.env.ATHENA_FAILURE_COOLDOWN_MS;
    else process.env.ATHENA_FAILURE_COOLDOWN_MS = originalCooldown;
    resetAthenaCachesForTests();
  }
});

test(
  'reports when the dashboard is using seeded fallback data',
  withMockAthena(async () => {
    const dashboard = await getDashboardAppointments();
    assert.equal(dashboard.source, 'sample');
    assert.equal(typeof dashboard.message, 'string');
    assert.match(dashboard.message, /sample|fallback/i);
  })
);

test('reports live source and resolves names when Athena requests succeed', async () => {
  resetAthenaCachesForTests();
  const originalUseMock = process.env.USE_MOCK_ATHENA;
  const originalFetch = global.fetch;
  process.env.USE_MOCK_ATHENA = 'false';

  global.fetch = async (url) => {
    const target = url.toString();
    if (target.includes('/oauth2/v1/token')) {
      return { ok: true, status: 200, json: async () => ({ access_token: 'token', expires_in: 3600 }) };
    }
    if (target.includes('/departments')) {
      return { ok: true, status: 200, json: async () => ({ departments: [{ departmentid: '1', name: 'Test Department' }] }) };
    }
    if (target.includes('/providers')) {
      return { ok: true, status: 200, json: async () => ({ providers: [{ providerid: '1', displayname: 'Dr. Test' }] }) };
    }
    if (target.includes('/appointments/booked')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          appointments: [
            {
              appointmentid: '1',
              patientid: '1',
              providerid: '1',
              departmentid: '1',
              date: '01/20/2026',
              starttime: '09:00',
              appointmentstatus: 'f',
            },
          ],
          totalcount: 1,
        }),
      };
    }
    if (target.includes('/patients/')) {
      return { ok: true, status: 200, json: async () => [{ firstname: 'Test', lastname: 'Patient' }] };
    }
    throw new Error(`Unexpected fetch to ${target}`);
  };

  try {
    const dashboard = await getDashboardAppointments();
    assert.equal(dashboard.source, 'athena');
    assert.equal(dashboard.count, 1);
    assert.equal(dashboard.appointments[0].patient, 'Test Patient');
    assert.equal(dashboard.appointments[0].provider, 'Dr. Test');
  } finally {
    global.fetch = originalFetch;
    process.env.USE_MOCK_ATHENA = originalUseMock;
    resetAthenaCachesForTests();
  }
});

test('filterAppointments respects a dateFrom/dateTo range', () => {
  const appointments = [
    { date: '2026-01-10', provider: 'Dr. A', patient: 'Pat A', status: 'scheduled' },
    { date: '2026-01-20', provider: 'Dr. A', patient: 'Pat B', status: 'scheduled' },
    { date: '2026-02-05', provider: 'Dr. A', patient: 'Pat C', status: 'scheduled' },
  ];
  const inRange = filterAppointments(appointments, { dateFrom: '2026-01-15', dateTo: '2026-01-31' });
  assert.equal(inRange.length, 1);
  assert.equal(inRange[0].patient, 'Pat B');
});

test('filterAppointments respects departmentId', () => {
  const appointments = [
    { date: '2026-01-10', provider: 'Dr. A', patient: 'Pat A', status: 'scheduled', departmentId: '1' },
    { date: '2026-01-10', provider: 'Dr. A', patient: 'Pat B', status: 'scheduled', departmentId: '2' },
  ];
  const filtered = filterAppointments(appointments, { departmentId: '2' });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].patient, 'Pat B');
});

test('restricts the live department loop to a single department when departmentId is given', async () => {
  resetAthenaCachesForTests();
  const originalUseMock = process.env.USE_MOCK_ATHENA;
  const originalFetch = global.fetch;
  process.env.USE_MOCK_ATHENA = 'false';
  const bookedRequests = [];

  global.fetch = async (url) => {
    const target = url.toString();
    if (target.includes('/oauth2/v1/token')) {
      return { ok: true, status: 200, json: async () => ({ access_token: 'token', expires_in: 3600 }) };
    }
    if (target.includes('/departments')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          departments: [
            { departmentid: '1', name: 'Immunology' },
            { departmentid: '2', name: 'Cardiology' },
          ],
        }),
      };
    }
    if (target.includes('/providers')) {
      return { ok: true, status: 200, json: async () => ({ providers: [] }) };
    }
    if (target.includes('/appointments/booked')) {
      bookedRequests.push(target);
      return { ok: true, status: 200, json: async () => ({ appointments: [], totalcount: 0 }) };
    }
    throw new Error(`Unexpected fetch to ${target}`);
  };

  try {
    await getDashboardAppointments({ dateFrom: '2026-01-01', dateTo: '2026-01-07', departmentId: '2' });
    assert.equal(bookedRequests.length, 1);
    assert.match(bookedRequests[0], /departmentid=2/);
  } finally {
    global.fetch = originalFetch;
    process.env.USE_MOCK_ATHENA = originalUseMock;
    resetAthenaCachesForTests();
  }
});

test('reports syncedLive:false when a request is served entirely from the day cache', async () => {
  resetAthenaCachesForTests();
  const originalUseMock = process.env.USE_MOCK_ATHENA;
  const originalFetch = global.fetch;
  process.env.USE_MOCK_ATHENA = 'false';

  global.fetch = async (url) => {
    const target = url.toString();
    if (target.includes('/oauth2/v1/token')) {
      return { ok: true, status: 200, json: async () => ({ access_token: 'token', expires_in: 3600 }) };
    }
    if (target.includes('/departments')) {
      return { ok: true, status: 200, json: async () => ({ departments: [{ departmentid: '1', name: 'Immunology' }] }) };
    }
    if (target.includes('/providers')) {
      return { ok: true, status: 200, json: async () => ({ providers: [] }) };
    }
    if (target.includes('/appointments/booked')) {
      return { ok: true, status: 200, json: async () => ({ appointments: [], totalcount: 0 }) };
    }
    throw new Error(`Unexpected fetch to ${target}`);
  };

  try {
    const first = await getDashboardAppointments({ dateFrom: '2026-01-01', dateTo: '2026-01-07' });
    assert.equal(first.syncedLive, true);

    const second = await getDashboardAppointments({ dateFrom: '2026-01-01', dateTo: '2026-01-07' });
    assert.equal(second.syncedLive, false);
    assert.match(second.message, /sync cache/i);
  } finally {
    global.fetch = originalFetch;
    process.env.USE_MOCK_ATHENA = originalUseMock;
    resetAthenaCachesForTests();
  }
});

test('listDepartments returns practice-namespaced department records', async () => {
  resetAthenaCachesForTests();
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    const target = url.toString();
    if (target.includes('/oauth2/v1/token')) {
      return { ok: true, status: 200, json: async () => ({ access_token: 'token', expires_in: 3600 }) };
    }
    if (target.includes('/departments')) {
      return { ok: true, status: 200, json: async () => ({ departments: [{ departmentid: '1', name: 'Immunology' }] }) };
    }
    throw new Error(`Unexpected fetch to ${target}`);
  };

  try {
    const departments = await listDepartments();
    assert.equal(departments.length, 1);
    assert.equal(departments[0].id, '1');
    assert.equal(departments[0].name, 'Immunology');
    assert.equal(departments[0].practiceId, process.env.ATHENAHEALTH_PRACTICE_ID);
  } finally {
    global.fetch = originalFetch;
    resetAthenaCachesForTests();
  }
});

test('listProviders filters colleagues by matching Athena\'s homedepartment NAME field, not an id', async () => {
  resetAthenaCachesForTests();
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    const target = url.toString();
    if (target.includes('/oauth2/v1/token')) {
      return { ok: true, status: 200, json: async () => ({ access_token: 'token', expires_in: 3600 }) };
    }
    if (target.includes('/departments')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          departments: [
            { departmentid: '1', name: 'Immunology' },
            { departmentid: '2', name: 'Cardiology' },
          ],
        }),
      };
    }
    if (target.includes('/providers')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          providers: [
            { providerid: '1', displayname: 'Dr. A', homedepartment: 'Immunology' },
            { providerid: '2', displayname: 'Dr. B', homedepartment: 'Immunology' },
            { providerid: '3', displayname: 'Dr. C', homedepartment: 'Cardiology' },
          ],
        }),
      };
    }
    throw new Error(`Unexpected fetch to ${target}`);
  };

  try {
    const immunologyProviders = await listProviders({ departmentId: '1' });
    assert.equal(immunologyProviders.length, 2);
    assert.deepEqual(immunologyProviders.map((p) => p.id).sort(), ['1', '2']);

    const cardiologyProviders = await listProviders({ departmentId: '2' });
    assert.equal(cardiologyProviders.length, 1);
    assert.equal(cardiologyProviders[0].id, '3');
  } finally {
    global.fetch = originalFetch;
    resetAthenaCachesForTests();
  }
});

test('queries Athena with dateFrom/dateTo instead of the default range when provided', async () => {
  resetAthenaCachesForTests();
  const originalUseMock = process.env.USE_MOCK_ATHENA;
  const originalFetch = global.fetch;
  process.env.USE_MOCK_ATHENA = 'false';
  const requestedUrls = [];

  global.fetch = async (url) => {
    const target = url.toString();
    requestedUrls.push(target);
    if (target.includes('/oauth2/v1/token')) {
      return { ok: true, status: 200, json: async () => ({ access_token: 'token', expires_in: 3600 }) };
    }
    if (target.includes('/departments')) {
      return { ok: true, status: 200, json: async () => ({ departments: [{ departmentid: '1', name: 'Test Department' }] }) };
    }
    if (target.includes('/providers')) {
      return { ok: true, status: 200, json: async () => ({ providers: [] }) };
    }
    if (target.includes('/appointments/booked')) {
      return { ok: true, status: 200, json: async () => ({ appointments: [], totalcount: 0 }) };
    }
    throw new Error(`Unexpected fetch to ${target}`);
  };

  try {
    await getDashboardAppointments({ dateFrom: '2026-03-01', dateTo: '2026-03-07' });
    const bookedRequest = requestedUrls.find((url) => url.includes('/appointments/booked'));
    assert.match(bookedRequest, /startdate=03%2F01%2F2026/);
    assert.match(bookedRequest, /enddate=03%2F07%2F2026/);
  } finally {
    global.fetch = originalFetch;
    process.env.USE_MOCK_ATHENA = originalUseMock;
    resetAthenaCachesForTests();
  }
});

test('falls back to seeded sample data and surfaces the reason when Athena is unreachable', async () => {
  resetAthenaCachesForTests();
  const originalUseMock = process.env.USE_MOCK_ATHENA;
  const originalFetch = global.fetch;
  process.env.USE_MOCK_ATHENA = 'false';
  global.fetch = async () => {
    throw new Error('network unreachable');
  };

  try {
    const dashboard = await getDashboardAppointments();
    assert.equal(dashboard.source, 'sample');
    assert.match(dashboard.message, /Reason:/);
  } finally {
    global.fetch = originalFetch;
    process.env.USE_MOCK_ATHENA = originalUseMock;
    resetAthenaCachesForTests();
  }
});
