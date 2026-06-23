/**
 * scripts/run-migration.js
 * Applies the stats_processed column migration directly via Supabase RPC
 * using the postgres-level access granted by the service role key.
 * Run once: bun run scripts/run-migration.js
 */
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function runSQL(sql) {
  // Use the pg endpoint which accepts raw SQL via service role
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/query`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  return { status: res.status, body: text };
}

// Alternative: Use the Supabase Management API to run migrations
async function runMigrationViaManagementAPI(sql) {
  // Try the pg endpoint approach that works with service role
  const res = await fetch(`${SUPABASE_URL}/pg/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });
  return { status: res.status, body: await res.text() };
}

const MIGRATION_SQL = `
ALTER TABLE public.matches
ADD COLUMN IF NOT EXISTS stats_processed boolean NOT NULL DEFAULT false;

UPDATE public.matches
SET stats_processed = true
WHERE status = 'finished';
`;

console.log('Attempting migration via Supabase...');
console.log('\nSQL to execute:');
console.log(MIGRATION_SQL);

const result1 = await runSQL(MIGRATION_SQL);
console.log('\nAttempt 1 (rpc/query):', result1);

if (result1.status !== 200) {
  const result2 = await runMigrationViaManagementAPI(MIGRATION_SQL);
  console.log('Attempt 2 (pg/query):', result2);
}

console.log('\n---');
console.log('If both attempts failed, paste this SQL in your Supabase Dashboard:');
console.log('https://supabase.com/dashboard/project/_/sql/new');
console.log(MIGRATION_SQL);
