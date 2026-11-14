const BASE = "http://localhost:5000";
let adminToken = null;
let insideSalesToken = null;
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

console.log("\n=== EMPLOYEE MANAGEMENT ===");

adminToken = await login("admin@example.com", "admin@123", "Admin");

// Create Inside Sales employee
const { status: s1, data: d1 } = await req("/api/admin/employees", {
  method: "POST", token: adminToken,
  body: { fullName: "QA Inside Sales User", email: "qa.inside@test.local", password: "TestPass123!", role: "INSIDE_SALES" },
});
assert(s1 === 201, `Create Inside Sales employee -> 201 (got ${s1})`);
const insideId = d1?.employee?.id;
assert(insideId, "Inside Sales employee ID returned");

// Duplicate email
const { status: s2 } = await req("/api/admin/employees", {
  method: "POST", token: adminToken,
  body: { fullName: "QA Duplicate", email: "qa.inside@test.local", password: "TestPass123!", role: "INSIDE_SALES" },
});
assert(s2 === 409, `Duplicate email -> 409 (got ${s2})`);

// Create Outside Sales employee
const { status: s3, data: d3 } = await req("/api/admin/employees", {
  method: "POST", token: adminToken,
  body: { fullName: "QA Outside Sales User", email: "qa.outside@test.local", password: "TestPass123!", role: "OUTSIDE_SALES" },
});
assert(s3 === 201, `Create Outside Sales employee -> 201 (got ${s3})`);
const outsideId = d3?.employee?.id;

// Create Executive
const { status: s4, data: d4 } = await req("/api/admin/employees", {
  method: "POST", token: adminToken,
  body: { fullName: "QA Executive User", email: "qa.executive@test.local", password: "TestPass123!", role: "EXECUTIVE" },
});
assert(s4 === 201, `Create Executive -> 201 (got ${s4})`);
const execId = d4?.employee?.id;

// List employees
const { status: s5, data: d5 } = await req("/api/admin/employees", { token: adminToken });
assert(s5 === 200, "List employees -> 200");
assert(Array.isArray(d5?.employees), "Employees array returned");

// Get employee
const { status: s6 } = await req(`/api/admin/employees/${insideId}`, { token: adminToken });
assert(s6 === 200, "Get employee -> 200");

// Update employee
const { status: s7 } = await req(`/api/admin/employees/${insideId}`, {
  method: "PATCH", token: adminToken, body: { fullName: "QA Inside Sales Updated" },
});
assert(s7 === 200, "Update employee -> 200");

// Deactivate employee
const { status: s8 } = await req(`/api/admin/employees/${insideId}/status`, {
  method: "PATCH", token: adminToken, body: { isActive: false },
});
assert(s8 === 200, "Deactivate employee -> 200");

// Reactivate
const { status: s9 } = await req(`/api/admin/employees/${insideId}/status`, {
  method: "PATCH", token: adminToken, body: { isActive: true },
});
assert(s9 === 200, "Reactivate employee -> 200");

// Login as inside sales
insideSalesToken = await login("qa.inside@test.local", "TestPass123!", "Inside Sales");

// Executive cannot create ADMIN role
const { status: s10 } = await req("/api/admin/employees", {
  method: "POST", token: adminToken,
  body: { fullName: "Bad Role", email: "bad.role@test.local", password: "TestPass123!", role: "INVALID_ROLE" },
});
assert(s10 === 400, "Invalid role -> 400");

console.log(`\nEMPLOYEES: ${results.pass} passed, ${results.fail} failed`);
if (results.errors.length) console.log("Errors:", results.errors.join("\n  "));
process.exit(results.fail > 0 ? 1 : 0);