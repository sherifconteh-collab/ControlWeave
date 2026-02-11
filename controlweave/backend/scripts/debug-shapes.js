const http = require('http');
function req(method, path, body, token) {
  return new Promise((resolve) => {
    const url = new URL(path, 'http://localhost:3001');
    const opts = { hostname: url.hostname, port: url.port, path: url.pathname, method, headers: {'Content-Type':'application/json'} };
    if (token) opts.headers.Authorization = 'Bearer ' + token;
    const r = http.request(opts, res => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>{ try { resolve({s:res.statusCode,b:JSON.parse(d)}); } catch(e) { resolve({s:res.statusCode,b:d}); }}); });
    r.on('error', e => resolve({s:0,b:e.message}));
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

(async () => {
  // 1. Check register response shape
  const reg = await req('POST', '/api/v1/auth/register', {
    email: 'shape-test-' + Date.now() + '@test.com',
    password: 'TestPass123!',
    full_name: 'Shape Tester',
    organization_name: 'Shape Test Org'
  });
  console.log('=== REGISTER RESPONSE ===');
  console.log('Status:', reg.s);
  console.log('Full body:', JSON.stringify(reg.b, null, 2).substring(0, 500));

  // 2. Login to get token
  const email = reg.b.data?.user?.email || reg.b.data?.email;
  const login = await req('POST', '/api/v1/auth/login', {
    email: email,
    password: 'TestPass123!'
  });
  console.log('\n=== LOGIN RESPONSE ===');
  console.log('Status:', login.s);
  console.log('Full body:', JSON.stringify(login.b, null, 2).substring(0, 500));

  const token = login.b.data?.accessToken || login.b.data?.tokens?.accessToken;
  const orgId = login.b.data?.user?.organization_id || login.b.data?.user?.organizationId;
  console.log('Token:', token ? 'found' : 'NOT FOUND');
  console.log('OrgId:', orgId);

  // 3. Check /auth/me
  const me = await req('GET', '/api/v1/auth/me', null, token);
  console.log('\n=== AUTH/ME RESPONSE ===');
  console.log('Status:', me.s);
  console.log('Full body:', JSON.stringify(me.b, null, 2).substring(0, 500));

  // 4. Try to add frameworks
  const fws = await req('GET', '/api/v1/frameworks', null, token);
  const fwIds = fws.b.data?.slice(0, 2).map(f => f.id);
  console.log('\n=== ADD FRAMEWORKS ===');
  console.log('FW IDs:', fwIds);
  const addFw = await req('POST', '/api/v1/organizations/' + orgId + '/frameworks', { frameworkIds: fwIds }, token);
  console.log('Status:', addFw.s);
  console.log('Body:', JSON.stringify(addFw.b, null, 2).substring(0, 500));

  // 5. Org controls
  const controls = await req('GET', '/api/v1/organizations/' + orgId + '/controls', null, token);
  console.log('\n=== ORG CONTROLS ===');
  console.log('Status:', controls.s);
  console.log('Body:', JSON.stringify(controls.b).substring(0, 300));
})();
