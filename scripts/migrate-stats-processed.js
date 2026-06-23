import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log('Adding stats_processed column to matches table...');

  // Step 1: Check if the column already exists
  const { data: cols, error: colErr } = await supabase
    .from('matches')
    .select('id, stats_processed')
    .limit(1);

  if (!colErr) {
    console.log('Column stats_processed already exists. Checking unprocessed finished matches...');
  } else {
    console.log('Column does not exist yet, will need to add via Supabase Dashboard.');
    console.log('Error:', colErr.message);
    console.log('\n=== MANUAL SQL TO RUN IN SUPABASE SQL EDITOR ===');
    console.log(`
ALTER TABLE public.matches
ADD COLUMN IF NOT EXISTS stats_processed boolean NOT NULL DEFAULT false;

UPDATE public.matches
SET stats_processed = true
WHERE status = 'finished';

COMMENT ON COLUMN public.matches.stats_processed IS
  'True once player_stats have been synced for this match via the auto-sync workflow.';
    `);
    return;
  }

  // Step 2: Mark all finished matches as processed (already done manually)
  const { data: finished, error: finErr } = await supabase
    .from('matches')
    .select('id, status, stats_processed')
    .eq('status', 'finished');

  if (finErr) {
    console.error('Error fetching finished matches:', finErr.message);
    return;
  }

  const unprocessed = finished.filter(m => !m.stats_processed);
  console.log(`Found ${finished.length} finished matches, ${unprocessed.length} unprocessed.`);

  if (unprocessed.length > 0) {
    // Mark them all as processed (stats were loaded manually)
    const ids = unprocessed.map(m => m.id);
    const { error: updateErr } = await supabase
      .from('matches')
      .update({ stats_processed: true })
      .in('id', ids);

    if (updateErr) {
      console.error('Error marking matches as processed:', updateErr.message);
    } else {
      console.log(`✓ Marked ${ids.length} matches as stats_processed = true`);
    }
  }

  // Final verification
  const { data: verify } = await supabase
    .from('matches')
    .select('id, status, stats_processed')
    .eq('status', 'finished');

  const allProcessed = verify?.every(m => m.stats_processed);
  console.log(`\n✅ Migration complete. All finished matches processed: ${allProcessed}`);
  console.log(`Total finished matches: ${verify?.length}`);
}

run().catch(console.error);
