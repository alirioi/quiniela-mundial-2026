import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Leer .env manualmente
const envContent = fs.readFileSync('.env', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  console.log('--- PERFILES ---');
  const { data: profiles, error: pError } = await supabase.from('profiles').select('*');
  if (pError) console.error('Error profiles:', pError);
  else console.log(JSON.stringify(profiles, null, 2));

  console.log('--- ENTRADAS/CUPOS ---');
  const { data: entries, error: eError } = await supabase.from('entries').select('*');
  if (eError) console.error('Error entries:', eError);
  else console.log(JSON.stringify(entries, null, 2));

  console.log('--- USUARIOS DE AUTH ---');
  const { data: users, error: uError } = await supabase.auth.admin.listUsers();
  if (uError) console.error('Error users:', uError);
  else console.log(JSON.stringify(users.users.map(u => ({ id: u.id, email: u.email, created_at: u.created_at })), null, 2));
}

check();
