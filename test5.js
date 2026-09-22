const http = require('http');
const request = (options, postData = null) => {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve({ statusCode: res.statusCode, headers: res.headers, data: JSON.parse(data) }); }
        catch (e) { resolve({ statusCode: res.statusCode, headers: res.headers, data }); }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(JSON.stringify(postData));
    }
    req.end();
  });
};
(async () => {
    const loginRes = await request({
      hostname: 'localhost',
      port: 3001,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'admin@can.edu.bo', password: 'admin123' });

    const token = loginRes.data.data.token;
    
    const authHeaders = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    
    const permRes = await request({
      hostname: 'localhost',
      port: 3001,
      path: '/api/roles/permissions?per_page=500&sortField=name',
      method: 'GET',
      headers: authHeaders
    });
    const permIds = permRes.data.data.slice(0, 3).map(p => p.id);
    const createRes = await request({
      hostname: 'localhost',
      port: 3001,
      path: '/api/roles',
      method: 'POST',
      headers: authHeaders
    }, {
      name: 'ROLE_RBAC_TEST',
      description: 'Test Role',
      permissionIds: permIds
    });
    console.log(createRes.data);
})();
