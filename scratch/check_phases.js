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
  console.log('--- TOURNAMENT PHASES ---');
  const { data: phases, error: pError } = await supabase.from('tournament_phases').select('*').order('order');
  if (pError) console.error('Error phases:', pError);
  else console.log(JSON.stringify(phases, null, 2));

  console.log('--- COUNT MATCHES PER PHASE ---');
  const { data: countData, error: cError } = await supabase.rpc('count_matches_by_phase');
  // Si no hay rpc, lo hacemos con select
  if (cError) {
    const { data: matches, error: mError } = await supabase.from('matches').select('phase_id');
    if (mError) {
      console.error('Error matches:', mError);
    } else {
      const counts = {};
      matches.forEach(m => {
        counts[m.phase_id] = (counts[m.phase_id] || 0) + 1;
      });
      console.log('Matches by phase id:', counts);
    }
  } else {
    console.log(countData);
  }
}

check();
