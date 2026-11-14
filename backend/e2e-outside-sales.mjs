const BASE = "http://localhost:5000";
let adminToken = null;
let outsideToken = null;
let results = { pass: 0, fail: 0, errors: [] };

function assert(cond, msg) {
  cond ? results.pass++ : (results.fail++, results.errors.push(msg));
  console.log(cond ? `  ✅ ${msg}` : `  ❌ ${msg}`);
}

async function req(path, opts = {}) {
  const h = { "Content-Type": "application/json", ...opts.headers };
  if (opts.token) h.Authorization = `Bearer ${opts.token}`;
  const b = opts.body !== undefined ? JSON.stringify(opts.body) : undefined;
  const r = await fetch(`${BASE}${path}`, { method: opts.method ?? "GET", headers: h, body: b });
  let d = null; try { d = await r.json(); } catch {}
  return { status: r.status, data: d?.data ?? d };
}

async function login(email, pass, label) {
  const { status, data } = await req("/api/auth/login", { method: "POST", body: { email, password: pass } });
  assert(status === 200, `${label}: login 200`);
  assert(data?.token, `${label}: token returned`);
  return data?.token || null;
}

console.log("\n=== OUTSIDE SALES WORKFLOW ===");

adminToken = await login("admin@example.com", "admin@123", "Admin");

const ts = Date.now();
const osEmail = `qa.os.${ts}@test.local`;

// Create outside sales employee
const { status: sEmp, data: dEmp } = await req("/api/admin/employees", {
  method: "POST", token: adminToken,
  body: { fullName: "OS Test User", email: osEmail, password: "TestPass123!", role: "OUTSIDE_SALES" },
});
assert(sEmp === 201, `Create OS employee -> 201 (got ${sEmp})`);
const osEmpId = dEmp?.employee?.id;

outsideToken = await login(osEmail, "TestPass123!", "Outside Sales");

// List assigned visit schedules
const { status: s1, data: d1 } = await req("/api/outside-sales/visit-schedules", { token: outsideToken });
assert(s1 === 200, "OS list visit schedules -> 200");

// Create a property for testing
const { status: sProp, data: dProp } = await req("/api/admin/properties", {
  method: "POST", token: adminToken,
  body: {
    title: "QA OS Property",
    location: "456 Test Ave",
    latitude: 40.7128,
    longitude: -74.006,
    verificationRadiusMeters: 200,
    price: 300000.00,
    status: "AVAILABLE",
  },
});
assert(sProp === 201, `Create property -> 201 (got ${sProp})`);
const propId = dProp?.property?.id || dProp?.id;

// Create a customer for OS
const { status: sCust, data: dCust } = await req("/api/admin/customers", {
  method: "POST", token: adminToken,
  body: { fullName: "OS Test Customer", phone: `+1555000${String(ts).slice(-4)}`, email: `qa.os.cust.${ts}@test.local`, status: "NEW", interestStatus: "PENDING" },
});
assert(sCust === 201, `Create customer -> 201 (got ${sCust})`);
const custId = dCust?.customer?.id || dCust?.id;

// Create an IS user to set up the visit schedule
const isTs = Date.now();
const isEmail = `qa.os.is.${isTs}@test.local`;
const { status: sIsEmp, data: dIsEmp } = await req("/api/admin/employees", {
  method: "POST", token: adminToken,
  body: { fullName: "OS Setup IS User", email: isEmail, password: "TestPass123!", role: "INSIDE_SALES" },
});
assert(sIsEmp === 201, `Create IS user for setup -> 201 (got ${sIsEmp})`);
const isEmpId = dIsEmp?.employee?.id;

const insideToken = await login(isEmail, "TestPass123!", "Inside Sales (setup)");

// Assign customer to IS user so IS can create visit schedule
const { status: sAssign, data: dAssign } = await req(`/api/admin/customers/${custId}/assignment`, {
  method: "POST", token: adminToken, body: { insideSalesEmployeeId: isEmpId },
});
assert(sAssign === 201, `Assign customer to IS -> 201 (got ${sAssign})`);

// Create visit schedule as IS user, assigning customer+property to OS user
const { status: sSched, data: dSched } = await req("/api/inside-sales/visit-schedules", {
  method: "POST", token: insideToken,
  body: {
    customerId: custId,
    propertyId: propId,
    outsideSalesEmployeeId: osEmpId,
    scheduledAt: new Date(Date.now() + 86400000).toISOString(),
    notes: "QA test schedule",
  },
});
assert(sSched === 201, `Create visit schedule -> 201 (got ${sSched})`);

// OS list property documents
const { status: s2 } = await req(`/api/outside-sales/properties/${propId}/documents`, { token: outsideToken });
assert(s2 === 200, `OS list property documents -> 200 (got ${s2})`);

// OS get document access (no documents yet, but property exists)
const { status: s3 } = await req(`/api/outside-sales/properties/${propId}/documents/1/access`, { token: outsideToken });
assert(s3 === 200 || s3 === 404, `OS get document access -> 200/404 (got ${s3})`);

// OS call logs for assigned customer
const { status: s4, data: d4 } = await req(`/api/outside-sales/customers/${custId}/call-logs`, { token: outsideToken });
assert(s4 === 200, "OS list call logs -> 200");

// Create call log
const { status: s5 } = await req(`/api/outside-sales/customers/${custId}/call-logs`, {
  method: "POST", token: outsideToken, body: { outcome: "INTERESTED", notes: "QA OS call" },
});
assert(s5 === 201, `OS create call log -> 201 (got ${s5})`);

// OS cannot access inside-sales endpoints
const { status: s6 } = await req("/api/inside-sales/dashboard", { token: outsideToken });
assert(s6 === 403, "OS cannot access IS dashboard -> 403");

// OS cannot access admin endpoints
const { status: s7 } = await req("/api/admin/employees", { token: outsideToken });
assert(s7 === 403, "OS cannot access admin employees -> 403");

// OS verify invalid visit
const { status: s8 } = await req("/api/visits/999999/verify-location", {
  method: "POST", token: outsideToken, body: { latitude: 40.7128, longitude: -74.006 },
});
assert(s8 === 404 || s8 === 403, `OS verify invalid visit -> 404/403 (got ${s8})`);

console.log(`\nOUTSIDE SALES: ${results.pass} passed, ${results.fail} failed`);
if (results.errors.length) console.log("Errors:", results.errors.join("\n  "));
process.exit(results.fail > 0 ? 1 : 0);