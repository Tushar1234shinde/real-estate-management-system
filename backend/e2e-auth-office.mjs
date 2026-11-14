const BASE = "http://localhost:5000";
let adminToken = null;
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

console.log("\n=== AUTH & OFFICE LOCATIONS ===");

adminToken = await login("admin@example.com", "admin@123", "Admin");
assert(adminToken, "Admin token obtained");

const { status: s1, data: d1 } = await req("/api/auth/login", { method: "POST", body: { email: "admin@example.com", password: "wrong" } });
assert(s1 === 401, "Wrong password -> 401");

const { status: s2 } = await req("/api/auth/login", { method: "POST", body: { email: "admin@example.com" } });
assert(s2 === 400, "Missing password -> 400");

const { status: s3, data: d3 } = await req("/api/auth/me", { token: adminToken });
assert(s3 === 200, "/api/auth/me -> 200");
assert(d3?.user?.role === "ADMIN", "User is ADMIN");

const { status: s4, data: d4 } = await req("/api/admin/office-locations", {
  method: "POST", token: adminToken,
  body: { officeName: "QA Office", address: "123 Test St", latitude: 40.7128, longitude: -74.006, allowedRadiusMeters: 200, isActive: true },
});
assert(s4 === 201, "Create office -> 201");
const officeId = d4?.officeLocation?.id;
assert(officeId, "Office ID returned");

const { status: s5 } = await req("/api/admin/office-locations", { token: adminToken });
assert(s5 === 200, "List offices -> 200");

const { status: s6 } = await req(`/api/admin/office-locations/${officeId}`, {
  method: "PATCH", token: adminToken, body: { officeName: "QA Office Updated" },
});
assert(s6 === 200, "Update office -> 200");

const { status: s7 } = await req(`/api/admin/office-locations/${officeId}/toggle`, { method: "PATCH", token: adminToken });
assert(s7 === 200, "Toggle office -> 200");

const { status: s8 } = await req("/api/admin/office-locations", {
  method: "POST", token: adminToken, body: { officeName: "Bad Lat", latitude: 999, longitude: -74.006, allowedRadiusMeters: 200 },
});
assert(s8 === 400, "Invalid latitude -> 400");

const { status: s9 } = await req("/api/admin/office-locations", {
  method: "POST", token: adminToken, body: { officeName: "Bad Radius", latitude: 40.7128, longitude: -74.006, allowedRadiusMeters: 500 },
});
assert(s9 === 201, "Radius > 0 is valid for office -> 201");

console.log(`\nAUTH/OFFICE: ${results.pass} passed, ${results.fail} failed`);
if (results.errors.length) console.log("Errors:", results.errors.join("\n  "));
process.exit(results.fail > 0 ? 1 : 0);