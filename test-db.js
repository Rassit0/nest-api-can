const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://admin:password@localhost:5445/gestion_can?schema=public' });
client.connect().then(() => {
  client.query('SELECT id, date, amount, status FROM "InternalTransfer"').then(res => {
    console.log(res.rows);
    client.end();
  });
});
