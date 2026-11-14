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

console.log("\n=== PROPERTY MANAGEMENT ===");

adminToken = await login("admin@example.com", "admin@123", "Admin");

// Create property
const { status: s1, data: d1 } = await req("/api/admin/properties", {
  method: "POST", token: adminToken,
  body: {
    title: "QA Test Property",
    description: "A test property",
    location: "123 Test Ave",
    latitude: 40.7128,
    longitude: -74.006,
    verificationRadiusMeters: 200,
    price: 250000.00,
    status: "AVAILABLE",
  },
});
assert(s1 === 201, `Create property -> 201 (got ${s1})`);
const propertyId = d1?.property?.id || d1?.id;
assert(propertyId, "Property ID returned");

// List properties
const { status: s2, data: d2 } = await req("/api/admin/properties", { token: adminToken });
assert(s2 === 200, "List properties -> 200");
assert(Array.isArray(d2?.properties), "Properties array returned");

// Get property
const { status: s3 } = await req(`/api/admin/properties/${propertyId}`, { token: adminToken });
assert(s3 === 200, "Get property -> 200");

// Update property
const { status: s4 } = await req(`/api/admin/properties/${propertyId}`, {
  method: "PATCH", token: adminToken, body: { title: "QA Test Property Updated" },
});
assert(s4 === 200, "Update property -> 200");

// Invalid price (negative)
const { status: s5 } = await req("/api/admin/properties", {
  method: "POST", token: adminToken,
  body: { title: "Bad Price", location: "Test", price: -100, status: "AVAILABLE" },
});
assert(s5 === 400, "Negative price -> 400");

// Incomplete coordinates (latitude only)
const { status: s6 } = await req("/api/admin/properties", {
  method: "POST", token: adminToken,
  body: { title: "Bad Coord", location: "Test", latitude: 40.7128, price: 100, status: "AVAILABLE" },
});
assert(s6 === 400, "Incomplete coordinates -> 400");

// Wrong radius (not 200)
const { status: s7 } = await req("/api/admin/properties", {
  method: "POST", token: adminToken,
  body: { title: "Bad Radius", location: "Test", latitude: 40.7128, longitude: -74.006, verificationRadiusMeters: 500, price: 100, status: "AVAILABLE" },
});
assert(s7 === 400, "Radius != 200 -> 400");

console.log(`\nPROPERTIES: ${results.pass} passed, ${results.fail} failed`);
if (results.errors.length) console.log("Errors:", results.errors.join("\n  "));
process.exit(results.fail > 0 ? 1 : 0);