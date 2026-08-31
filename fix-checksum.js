const crypto = require('crypto');
const fs = require('fs');
const { Client } = require('pg');

async function fix() {
  const client = new Client({
    connectionString: "postgresql://admin:password@localhost:5445/gestion_can?schema=public"
  });
  await client.connect();
  
  const fileContent = fs.readFileSync('prisma/migrations/20260824120000_team_season_multi_category/migration.sql', 'utf8');
  const hash = crypto.createHash('sha256').update(fileContent).digest('hex');
  
  await client.query(`UPDATE _prisma_migrations SET checksum = $1 WHERE migration_name = '20260824120000_team_season_multi_category'`, [hash]);
  console.log('Checksum updated to', hash);
  await client.end();
}

fix().catch(console.error);
