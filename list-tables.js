const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://admin:password@localhost:5445/gestion_can?schema=public' });
client.connect().then(() => {
  client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'").then(res => {
    console.log(res.rows.map(r => r.table_name));
    client.end();
  });
});
