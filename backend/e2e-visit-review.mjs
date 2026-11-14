const BASE = "http://localhost:5000";
let adminToken = null;
let outsideToken = null;
let insideToken = null;
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

console.log("\n=== VISIT VERIFICATION & ADMIN REVIEW ===");

adminToken = await login("admin@example.com", "admin@123", "Admin");

const ts = Date.now();

// Create OS user
const osEmail = `qa.vr.os.${ts}@test.local`;
const { status: sEmp, data: dEmp } = await req("/api/admin/employees", {
  method: "POST", token: adminToken,
  body: { fullName: "VR OS User", email: osEmail, password: "TestPass123!", role: "OUTSIDE_SALES" },
});
assert(sEmp === 201, `Create OS employee -> 201`);
const osEmpId = dEmp?.employee?.id;
// Create IS user
const isEmail = `qa.vr.is.${ts}@test.local`;
const { status: sIsEmp, data: dIsEmp } = await req("/api/admin/employees", {
  method: "POST", token: adminToken,
  body: { fullName: "VR IS User", email: isEmail, password: "TestPass123!", role: "INSIDE_SALES" },
});
assert(sIsEmp === 201, `Create IS employee -> 201`);
const isEmpId = dIsEmp?.employee?.id;
insideToken = await login(isEmail, "TestPass123!", "Inside Sales");

// Create property with coordinates
const { status: sProp, data: dProp } = await req("/api/admin/properties", {
  method: "POST", token: adminToken,
  body: {
    title: "VR Test Property",
    location: "789 Test Ave",
    latitude: 40.7128,
    longitude: -74.006,
    verificationRadiusMeters: 200,
    price: 400000.00,
    status: "AVAILABLE",
  },
});
assert(sProp === 201, `Create property -> 201`);
const propId = dProp?.property?.id || dProp?.id;

// Create customer
const { status: sCust, data: dCust } = await req("/api/admin/customers", {
  method: "POST", token: adminToken,
  body: { fullName: "VR Test Customer", phone: `+1555000${String(ts).slice(-4)}`, email: `qa.vr.cust.${ts}@test.local`, status: "NEW", interestStatus: "PENDING" },
});
assert(sCust === 201, `Create customer -> 201`);
const custId = dCust?.customer?.id || dCust?.id;

// Assign customer to IS
const { status: sAssign } = await req(`/api/admin/customers/${custId}/assignment`, {
  method: "POST", token: adminToken, body: { insideSalesEmployeeId: isEmpId },
});
assert(sAssign === 201, `Assign customer to IS -> 201`);

// IS creates visit schedule
const { status: sSched, data: dSched } = await req("/api/inside-sales/visit-schedules", {
  method: "POST", token: insideToken,
  body: {
    customerId: custId,
    propertyId: propId,
    outsideSalesEmployeeId: osEmpId,
    scheduledAt: new Date(Date.now() + 86400000).toISOString(),
    notes: "VR test schedule",
  },
});
assert(sSched === 201, `Create visit schedule -> 201`);
const scheduleId = dSched?.schedule?.id;

// OS login
outsideToken = await login(osEmail, "TestPass123!", "Outside Sales");

// OS initializes visit
const { status: sInit, data: dInit } = await req(`/api/visit-schedules/${scheduleId}/visit`, {
  method: "POST", token: outsideToken,
});
assert(sInit === 201 || sInit === 200, `Initialize visit -> 201/200 (got ${sInit})`);
const visitId = dInit?.visit?.id;
assert(visitId, "Visit ID returned");

// OS verifies location (within radius - should PASS)
const { status: sVerify, data: dVerify } = await req(`/api/visits/${visitId}/verify-location`, {
  method: "POST", token: outsideToken,
  body: { latitude: 40.7128, longitude: -74.006, accuracy: 10 },
});
assert(sVerify === 200, `Verify location (within radius) -> 200 (got ${sVerify})`);
if (sVerify === 200) {
  assert(dVerify?.visit?.verificationResult === "PASSED", `Location verification result is PASSED (got ${dVerify?.visit?.verificationResult})`);
}

// OS submits visit (after location verification)
// BLOCKED: requires selfie upload via Cloudinary, which is not configured
const { status: sSubmit } = await req(`/api/visits/${visitId}/submit`, {
  method: "POST", token: outsideToken,
});
assert(sSubmit === 409, `Submit visit blocked (no selfie/Cloudinary) -> 409 (got ${sSubmit})`);

// Admin lists pending reviews (visit not submitted, so empty)
const { status: sReview, data: dReview } = await req("/api/admin/visits/pending-review", { token: adminToken });
assert(sReview === 200, "Admin list pending reviews -> 200");

// Admin cannot approve a visit that was never submitted
const { status: sApprove } = await req(`/api/admin/visits/${visitId}/approve`, {
  method: "PATCH", token: adminToken,
});
assert(sApprove === 404 || sApprove === 409, `Admin approve unsubmitted visit -> 404/409 (got ${sApprove})`);

// IS cannot approve visits
const { status: sForbid } = await req(`/api/admin/visits/${visitId}/approve`, {
  method: "PATCH", token: insideToken,
});
assert(sForbid === 403, "IS cannot approve visit -> 403");

// OS cannot approve visits
const { status: sForbid2 } = await req(`/api/admin/visits/${visitId}/approve`, {
  method: "PATCH", token: outsideToken,
});
assert(sForbid2 === 403, "OS cannot approve visit -> 403");

console.log(`\nVISIT REVIEW: ${results.pass} passed, ${results.fail} failed`);
if (results.errors.length) console.log("Errors:", results.errors.join("\n  "));
process.exit(results.fail > 0 ? 1 : 0);