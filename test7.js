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
      hostname: '127.0.0.1',
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
      hostname: '127.0.0.1',
      port: 3001,
      path: '/api/roles/permissions?per_page=500&sortField=name',
      method: 'GET',
      headers: authHeaders
    });
    
    const targetNames = ['READ_ROLES', 'CREATE_ROLES', 'UPDATE_ROLES', 'DELETE_ROLES'];
    const perms = permRes.data.data.filter(p => targetNames.includes(p.name));
    
    const createPermIds = [
      perms.find(p => p.name === 'READ_ROLES').id,
      perms.find(p => p.name === 'CREATE_ROLES').id,
      perms.find(p => p.name === 'UPDATE_ROLES').id
    ];

    console.log('\n--- 6. PRUEBA REAL CREATE ---');
    console.log('Creando con permisos:', ['READ_ROLES', 'CREATE_ROLES', 'UPDATE_ROLES']);
    const createRes = await request({
      hostname: '127.0.0.1',
      port: 3001,
      path: '/api/roles',
      method: 'POST',
      headers: authHeaders
    }, {
      name: 'ROLE_RBAC_TEST',
      description: 'Test Role',
      permissionIds: createPermIds
    });
    console.log('Create Response Status:', createRes.statusCode);
    if (createRes.statusCode !== 201) {
        console.log(createRes.data);
        return;
    }
    
    const roleId = createRes.data.data.id;
    
    const readRes = await request({
      hostname: '127.0.0.1',
      port: 3001,
      path: `/api/roles/${roleId}`,
      method: 'GET',
      headers: authHeaders
    });
    console.log('persisted permission count:', readRes.data.data.permissions.length);
    console.log('persisted names:', readRes.data.data.permissions.map(p => p.permission.name).join(','));

    console.log('\n--- 7. PRUEBA REAL UPDATE ---');
    const updatePermIds = [
      perms.find(p => p.name === 'READ_ROLES').id,
      perms.find(p => p.name === 'CREATE_ROLES').id,
      perms.find(p => p.name === 'DELETE_ROLES').id
    ];
    console.log('Actualizando a:', ['READ_ROLES', 'CREATE_ROLES', 'DELETE_ROLES']);
    const updateRes = await request({
      hostname: '127.0.0.1',
      port: 3001,
      path: `/api/roles/${roleId}`,
      method: 'PATCH',
      headers: authHeaders
    }, {
      permissionIds: updatePermIds
    });
    console.log('Update Response Status:', updateRes.statusCode);
    
    const readRes2 = await request({
      hostname: '127.0.0.1',
      port: 3001,
      path: `/api/roles/${roleId}`,
      method: 'GET',
      headers: authHeaders
    });
    console.log('persisted final set:', readRes2.data.data.permissions.map(p => p.permission.name).join(','));

    console.log('\n--- 9. CLEANUP ---');
    const deleteRes = await request({
      hostname: '127.0.0.1',
      port: 3001,
      path: `/api/roles/${roleId}`,
      method: 'DELETE',
      headers: authHeaders
    });
    console.log('Delete Response Status:', deleteRes.statusCode);

  } catch (err) {
    console.error(err);
  }
})();
