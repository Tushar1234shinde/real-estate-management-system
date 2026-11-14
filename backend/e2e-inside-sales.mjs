const BASE = "http://localhost:5000";
let adminToken = null;
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

console.log("\n=== INSIDE SALES WORKFLOW ===");

adminToken = await login("admin@example.com", "admin@123", "Admin");

const ts = Date.now();
const isEmail = `qa.is.${ts}@test.local`;

// Create inside sales employee
const { status: sEmp, data: dEmp } = await req("/api/admin/employees", {
  method: "POST", token: adminToken,
  body: { fullName: "IS Test User", email: isEmail, password: "TestPass123!", role: "INSIDE_SALES" },
});
assert(sEmp === 201, `Create IS employee -> 201 (got ${sEmp})`);
const isEmpId = dEmp?.employee?.id;

insideToken = await login(isEmail, "TestPass123!", "Inside Sales");

// Dashboard
const { status: s1, data: d1 } = await req("/api/inside-sales/dashboard", { token: insideToken });
assert(s1 === 200, "IS dashboard -> 200");

// List assigned customers
const { status: s2, data: d2 } = await req("/api/inside-sales/customers", { token: insideToken });
assert(s2 === 200, "IS list customers -> 200");
assert(Array.isArray(d2?.customers), "IS customers array returned");

// Get own customer (if assigned)
const { status: s3 } = await req("/api/inside-sales/customers/999999", { token: insideToken });
assert(s3 === 404 || s3 === 403, `IS accessing unassigned customer -> 404/403 (got ${s3})`);

// Create call log for a customer (need a customer ID first)
const custEmail = `qa.is.cust.${ts}@test.local`;
const custPhone = `+1555000${String(ts).slice(-4)}`;

// We need to assign a customer to this IS user first via admin
const { status: sCust, data: dCust } = await req("/api/admin/customers", {
  method: "POST", token: adminToken,
  body: { fullName: "IS Test Customer", phone: custPhone, email: custEmail, status: "NEW", interestStatus: "PENDING" },
});
const custId = dCust?.customer?.id || dCust?.id;

// Assign to IS user
const { status: sAssign } = await req(`/api/admin/customers/${custId}/assignment`, {
  method: "POST", token: adminToken, body: { insideSalesEmployeeId: isEmpId },
});
assert(sAssign === 201, `Assign customer to IS -> 201 (got ${sAssign})`);

// Now IS can access this customer
const { status: s4, data: d4 } = await req(`/api/inside-sales/customers/${custId}`, { token: insideToken });
assert(s4 === 200, "IS get assigned customer -> 200");

// Create call log
const { status: s5, data: d5 } = await req(`/api/inside-sales/customers/${custId}/call-logs`, {
  method: "POST", token: insideToken,
  body: { outcome: "INTERESTED", notes: "QA test call" },
});
assert(s5 === 201, `IS create call log -> 201 (got ${s5})`);

// List call logs
const { status: s6, data: d6 } = await req(`/api/inside-sales/customers/${custId}/call-logs`, { token: insideToken });
assert(s6 === 200, "IS list call logs -> 200");

// Update interest
const { status: s7 } = await req(`/api/inside-sales/customers/${custId}/interest`, {
  method: "PATCH", token: insideToken, body: { interestStatus: "INTERESTED" },
});
assert(s7 === 200, "IS update interest -> 200");

// List available properties
const { status: s8, data: d8 } = await req("/api/inside-sales/properties", { token: insideToken });
assert(s8 === 200, "IS list properties -> 200");

// IS cannot access admin endpoints
const { status: s9 } = await req("/api/admin/employees", { token: insideToken });
assert(s9 === 403, "IS cannot access admin employees -> 403");

// IS profile
const { status: s10, data: d10 } = await req("/api/inside-sales/profile", { token: insideToken });
assert(s10 === 200, "IS profile -> 200");

// IS visit schedules
const { status: s11, data: d11 } = await req("/api/inside-sales/visit-schedules", { token: insideToken });
assert(s11 === 200, "IS visit schedules -> 200");

console.log(`\nINSIDE SALES: ${results.pass} passed, ${results.fail} failed`);
if (results.errors.length) console.log("Errors:", results.errors.join("\n  "));
process.exit(results.fail > 0 ? 1 : 0);