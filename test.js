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
    console.log('Logging in...');
    const loginRes = await request({
      hostname: 'localhost',
      port: 3001,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'admin@can.edu.bo', password: 'admin123' });

    const token = loginRes.data.data.token;
    if (!token) throw new Error('No token obtained');

    const authHeaders = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    console.log('\n--- 3. VERIFICAR PAGINACIÓN ---');
    const permRes = await request({
      hostname: 'localhost',
      port: 3001,
      path: '/api/roles/permissions?per_page=500',
      method: 'GET',
      headers: authHeaders
    });
    console.log('per_page efectivo:', permRes.data.meta.itemsPerPage);
    console.log('total permissions:', permRes.data.meta.totalItems);
    console.log('items returned:', permRes.data.data.length);
    console.log('has next page:', permRes.data.meta.hasNextPage);
    console.log('perm.module tipo:', typeof permRes.data.data[0].module);

    const perms = permRes.data.data.slice(0, 4);
    const permIds = perms.map(p => p.id);

    console.log('\n--- 6. PRUEBA REAL CREATE ---');
    console.log('Creando con permisos:', permIds.slice(0, 3));
    const createRes = await request({
      hostname: 'localhost',
      port: 3001,
      path: '/api/roles',
      method: 'POST',
      headers: authHeaders
    }, {
      name: 'ROLE_RBAC_TEST',
      description: 'Test Role',
      permissionIds: permIds.slice(0, 3)
    });
    console.log('Create Response Status:', createRes.statusCode);
    const roleId = createRes.data.data.id;
    
    const readRes = await request({
      hostname: 'localhost',
      port: 3001,
      path: `/api/roles/${roleId}`,
      method: 'GET',
      headers: authHeaders
    });
    console.log('persisted permission count:', readRes.data.data.permissions.length);
    console.log('persisted IDs:', readRes.data.data.permissions.map(p => p.permission.id).join(','));

    console.log('\n--- 7. PRUEBA REAL UPDATE ---');
    const newPermIds = [permIds[0], permIds[2], permIds[3]];
    console.log('Actualizando a:', newPermIds);
    const updateRes = await request({
      hostname: 'localhost',
      port: 3001,
      path: `/api/roles/${roleId}`,
      method: 'PATCH',
      headers: authHeaders
    }, {
      permissionIds: newPermIds
    });
    console.log('Update Response Status:', updateRes.statusCode);
    
    const readRes2 = await request({
      hostname: 'localhost',
      port: 3001,
      path: `/api/roles/${roleId}`,
      method: 'GET',
      headers: authHeaders
    });
    console.log('persisted final set:', readRes2.data.data.permissions.map(p => p.permission.id).join(','));

    console.log('\n--- 9. CLEANUP ---');
    const deleteRes = await request({
      hostname: 'localhost',
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
