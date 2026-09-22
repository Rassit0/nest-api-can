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
  try {
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
      path: '/api/roles/permissions?per_page=500',
      method: 'GET',
      headers: authHeaders
    });
    console.log(Object.keys(permRes.data));
    console.log(permRes.data.data ? permRes.data.data.length : 'no data');
    if (permRes.data.data && permRes.data.data.length > 0) {
        console.log(permRes.data.data[0]);
    }
  } catch (err) {
    console.error(err);
  }
})();
