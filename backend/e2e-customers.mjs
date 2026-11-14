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

console.log("\n=== CUSTOMER MANAGEMENT ===");

adminToken = await login("admin@example.com", "admin@123", "Admin");

// Create customer
const { status: s1, data: d1 } = await req("/api/admin/customers", {
  method: "POST", token: adminToken,
  body: { fullName: "QA Test Customer", phone: "+15550001234", email: "qa.customer@test.local", status: "NEW", interestStatus: "PENDING" },
});
assert(s1 === 201, `Create customer -> 201 (got ${s1})`);
const customerId = d1?.customer?.id || d1?.id;
assert(customerId, "Customer ID returned");

// Duplicate email - customers don't have unique email constraint in schema
const { status: s2 } = await req("/api/admin/customers", {
  method: "POST", token: adminToken,
  body: { fullName: "QA Duplicate", phone: "+15550001235", email: "qa.customer@test.local", status: "NEW", interestStatus: "PENDING" },
});
assert(s2 === 201, `Duplicate email allowed (schema has no unique email on customers) -> 201 (got ${s2})`);

// List customers
const { status: s3, data: d3 } = await req("/api/admin/customers", { token: adminToken });
assert(s3 === 200, "List customers -> 200");
assert(Array.isArray(d3?.customers), "Customers array returned");

// Get customer
const { status: s4 } = await req(`/api/admin/customers/${customerId}`, { token: adminToken });
assert(s4 === 200, "Get customer -> 200");

// Update customer
const { status: s5 } = await req(`/api/admin/customers/${customerId}`, {
  method: "PATCH", token: adminToken, body: { fullName: "QA Test Customer Updated" },
});
assert(s5 === 200, "Update customer -> 200");

// Assign customer to inside sales
const { status: s6, data: d6 } = await req(`/api/admin/customers/${customerId}/assignment`, {
  method: "POST", token: adminToken, body: { insideSalesEmployeeId: 2 }, // use inside sales user ID
});
assert(s6 === 200 || s6 === 201, `Assign customer -> 200/201 (got ${s6})`);

// Get assignment
const { status: s7 } = await req(`/api/admin/customers/${customerId}/assignment`, { token: adminToken });
assert(s7 === 200, "Get assignment -> 200");

// Invalid status
const { status: s8 } = await req("/api/admin/customers", {
  method: "POST", token: adminToken,
  body: { fullName: "Bad Customer", phone: "+15550001236", status: "INVALID_STATUS", interestStatus: "PENDING" },
});
assert(s8 === 400, "Invalid status -> 400");

console.log(`\nCUSTOMERS: ${results.pass} passed, ${results.fail} failed`);
if (results.errors.length) console.log("Errors:", results.errors.join("\n  "));
process.exit(results.fail > 0 ? 1 : 0);