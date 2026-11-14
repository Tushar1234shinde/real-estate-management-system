const BASE = "http://localhost:5000";
let adminToken = null;
let execToken = null;
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

console.log("\n=== ADDITIONAL FEATURES ===");

// --- Attendance ---
console.log("\n--- Attendance ---");

const { status: sOffice, data: dOffice } = await req("/api/admin/office-locations", {
  method: "POST", token: adminToken,
  body: { officeName: "Attendance Office", address: "1 Attendance St", latitude: 40.7128, longitude: -74.006, allowedRadiusMeters: 200, isActive: true },
});
assert(sOffice === 201, `Create office for attendance -> 201`);
const officeId = dOffice?.officeLocation?.id;

const { status: sEmp, data: dEmp } = await req("/api/admin/employees", {
  method: "POST", token: adminToken,
  body: { fullName: "Attendance User", email: `qa.att.${ts}@test.local`, password: "TestPass123!", role: "INSIDE_SALES" },
});
assert(sEmp === 201, `Create attendance employee -> 201`);
const attEmpId = dEmp?.employee?.id;
const attToken = await login(`qa.att.${ts}@test.local`, "TestPass123!", "Attendance User");

const { status: sCheckIn, data: dCheckIn } = await req("/api/attendance/check-in", {
  method: "POST", token: attToken,
  body: { officeLocationId: officeId, loginLatitude: 40.7128, loginLongitude: -74.006 },
});
assert(sCheckIn === 201, `Check-in -> 201 (got ${sCheckIn})`);

const { status: sCheckIn2 } = await req("/api/attendance/check-in", {
  method: "POST", token: attToken,
  body: { officeLocationId: officeId, loginLatitude: 40.7128, loginLongitude: -74.006 },
});
assert(sCheckIn2 === 409, `Duplicate check-in -> 409 (got ${sCheckIn2})`);

const { status: sMyAtt, data: dMyAtt } = await req("/api/attendance", { token: attToken });
assert(sMyAtt === 200, "My attendance -> 200");

const { status: sOffices, data: dOffices } = await req("/api/attendance/office-locations", { token: attToken });
assert(sOffices === 200, "Active office locations -> 200");

const { status: sCheckOut } = await req("/api/attendance/check-out", {
  method: "POST", token: attToken,
  body: { officeLocationId: officeId, logoutLatitude: 40.7128, logoutLongitude: -74.006 },
});
assert(sCheckOut === 200, `Check-out -> 200 (got ${sCheckOut})`);

const { status: sAdminAtt } = await req("/api/admin/attendance", { token: adminToken });
assert(sAdminAtt === 200, "Admin attendance list -> 200");

const { status: sAdminSum } = await req("/api/admin/attendance/summary", { token: adminToken });
assert(sAdminSum === 200, "Admin attendance summary -> 200");

// --- Announcements ---
console.log("\n--- Announcements ---");

const { status: sAnn, data: dAnn } = await req("/api/announcements", {
  method: "POST", token: adminToken,
  body: { title: "QA Announcement", content: "Test announcement content", category: "general", priority: "HIGH", isPublished: true },
});
assert(sAnn === 201, `Create announcement -> 201 (got ${sAnn})`);
const annId = dAnn?.announcement?.id || dAnn?.id;

const { status: sAnnList } = await req("/api/announcements", { token: adminToken });
assert(sAnnList === 200, "List announcements -> 200");

const { status: sAnnGet } = await req(`/api/announcements/${annId}`, { token: adminToken });
assert(sAnnGet === 200, "Get announcement -> 200");

const { status: sAnnRead } = await req(`/api/announcements/${annId}/read`, {
  method: "POST", token: adminToken,
});
assert(sAnnRead === 200, "Mark announcement read -> 200");

const { status: sAnnUpd } = await req(`/api/announcements/${annId}`, {
  method: "PATCH", token: adminToken, body: { title: "QA Announcement Updated" },
});
assert(sAnnUpd === 200, "Update announcement -> 200");

// --- Executive ---
console.log("\n--- Executive ---");

const { status: sExec, data: dExec } = await req("/api/admin/employees", {
  method: "POST", token: adminToken,
  body: { fullName: "QA Executive", email: `qa.exec.${ts}@test.local`, password: "TestPass123!", role: "EXECUTIVE" },
});
assert(sExec === 201, `Create executive -> 201`);
execToken = await login(`qa.exec.${ts}@test.local`, "TestPass123!", "Executive");

const { status: sExecDash } = await req("/api/executive/dashboard", { token: execToken });
assert(sExecDash === 200, "Executive dashboard -> 200");

const { status: sExecProfile } = await req("/api/executive/profile", { token: execToken });
assert(sExecProfile === 200, "Executive profile -> 200");

// --- Call logs (Admin) ---
console.log("\n--- Call Logs (Admin) ---");

const { status: sCallStats } = await req("/api/admin/call-logs/statistics", { token: adminToken });
assert(sCallStats === 200, "Admin call log statistics -> 200");

console.log(`\nADDITIONAL FEATURES: ${results.pass} passed, ${results.fail} failed`);
if (results.errors.length) console.log("Errors:", results.errors.join("\n  "));
process.exit(results.fail > 0 ? 1 : 0);