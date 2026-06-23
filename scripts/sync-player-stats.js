/**
 * scripts/sync-player-stats.js
 *
 * Automatic synchronisation of player_stats from Wikipedia match articles.
 *
 * Flow:
 *   1. Fetch all 'finished' matches WHERE stats_processed = false.
 *   2. For each match, build a Wikipedia article URL.
 *   3. Parse the plain-text API response to extract goal scorers & assists.
 *   4. Upsert aggregated stats into player_stats (name + team as natural key).
 *   5. Mark the match as stats_processed = true.
 *
 * Designed to run as a GitHub Actions scheduled job (no paid APIs, no secrets
 * beyond SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY stored in GitHub Secrets).
 *
 * Safe to re-run: already-processed matches are skipped; upserts are additive.
 */

import { createClient } from '@supabase/supabase-js';

// ─── Environment validation ────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    '[sync-player-stats] FATAL: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.'
  );
  process.exit(1);
}

// Use service-role key so RLS doesn't block writes; this script runs only in
// trusted CI/CD environments (GitHub Actions) — never exposed to end users.
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ─── Team name translation (English Wikipedia → Spanish DB names) ──────────────
const TEAM_TRANSLATION = {
  'Mexico': 'México',
  'South Africa': 'Sudáfrica',
  'South Korea': 'Corea del Sur',
  'Czech Republic': 'Chequia',
  'Czechia': 'Chequia',
  'Canada': 'Canadá',
  'Bosnia and Herzegovina': 'Bosnia y Herzegovina',
  'Bosnia & Herzegovina': 'Bosnia y Herzegovina',
  'Qatar': 'Qatar',
  'Switzerland': 'Suiza',
  'Brazil': 'Brasil',
  'Morocco': 'Marruecos',
  'Haiti': 'Haití',
  'Scotland': 'Escocia',
  'United States': 'Estados Unidos',
  'USA': 'Estados Unidos',
  'Paraguay': 'Paraguay',
  'Australia': 'Australia',
  'Turkey': 'Turquía',
  'Germany': 'Alemania',
  'Curaçao': 'Curazao',
  'Curacao': 'Curazao',
  'Ivory Coast': 'Costa de Marfil',
  "Côte d'Ivoire": 'Costa de Marfil',
  'Ecuador': 'Ecuador',
  'Netherlands': 'Países Bajos',
  'Japan': 'Japón',
  'Sweden': 'Suecia',
  'Tunisia': 'Túnez',
  'Belgium': 'Bélgica',
  'Egypt': 'Egipto',
  'Iran': 'Irán',
  'New Zealand': 'Nueva Zelanda',
  'Spain': 'España',
  'Cape Verde': 'Cabo Verde',
  'Saudi Arabia': 'Arabia Saudita',
  'Uruguay': 'Uruguay',
  'France': 'Francia',
  'Senegal': 'Senegal',
  'Iraq': 'Irak',
  'Norway': 'Noruega',
  'Argentina': 'Argentina',
  'Algeria': 'Argelia',
  'Austria': 'Austria',
  'Jordan': 'Jordania',
  'Portugal': 'Portugal',
  'DR Congo': 'RD Congo',
  'Democratic Republic of the Congo': 'RD Congo',
  'Uzbekistan': 'Uzbekistán',
  'Colombia': 'Colombia',
  'England': 'Inglaterra',
  'Croatia': 'Croacia',
  'Ghana': 'Ghana',
  'Panama': 'Panamá',
};

function translateTeam(englishName) {
  return TEAM_TRANSLATION[englishName] ?? englishName;
}

// ─── Wikipedia helpers ─────────────────────────────────────────────────────────

/**
 * Builds the expected Wikipedia article title for a given match.
 * Wikipedia uses a consistent naming convention:
 *   "2026 FIFA World Cup Group A" for group stage matches
 *   "2026 FIFA World Cup knockout stage" for later rounds
 */
function buildWikiTitle(homeTeam, awayTeam, groupName) {
  if (groupName) {
    // Group stage: "2026 FIFA World Cup Group A"
    const groupLetter = groupName.replace(/^Grupo\s+/i, '').replace(/^Group\s+/i, '');
    return `2026_FIFA_World_Cup_Group_${groupLetter}`;
  }
  // Knockout stage: single article
  return '2026_FIFA_World_Cup_knockout_stage';
}

const WIKIPEDIA_API = 'https://en.wikipedia.org/w/api.php';

/** Fetch the wikitext of a Wikipedia article via the free MediaWiki API. */
async function fetchWikiText(title) {
  const params = new URLSearchParams({
    action: 'query',
    titles: title,
    prop: 'revisions',
    rvprop: 'content',
    rvslots: 'main',
    format: 'json',
    formatversion: '2',
  });

  const url = `${WIKIPEDIA_API}?${params}`;
  const res = await fetch(url, {
    headers: {
      // Wikipedia asks bots to identify themselves
      'User-Agent': 'QuinielaMundial2026/1.0 (https://github.com/alirioi/quiniela-2026; bot)',
    },
  });

  if (!res.ok) {
    throw new Error(`Wikipedia API responded ${res.status} for title: ${title}`);
  }

  const json = await res.json();
  const pages = json?.query?.pages;
  if (!pages || pages.length === 0) return null;

  const page = pages[0];
  if (page.missing) return null;

  return page?.revisions?.[0]?.slots?.main?.content ?? null;
}

/**
 * Parse goalscorers and assists from a Wikipedia match section wikitext.
 *
 * Wikipedia wikitext for World Cup matches typically has a "football box" template
 * with goal and assist information structured like:
 *
 *   |goals1 = {{football player|Player Name|23'}} {{football player|Another|45'}}
 *   |goals2 = {{football player|Away Player|67'}}
 *   |assist1 = {{football player|Assister|23'}}
 *
 * The templates {{goal}} / {{football player}} / {{flagicon}} vary by editor.
 * We use multiple regex strategies with a fallback.
 */
function parseMatchStats(wikitext, homeTeam, awayTeam) {
  const stats = []; // { name, team, goals, assists }

  // ── Strategy 1: Parse "football box" template (most common in FIFA WC articles)
  // Matches: |goals1 = ... or |goal1 = ...
  const homeGoalMatch = wikitext.match(/\|goals?1\s*=\s*([^\|<\n]+)/i);
  const awayGoalMatch = wikitext.match(/\|goals?2\s*=\s*([^\|<\n]+)/i);
  const homeAssistMatch = wikitext.match(/\|assist(?:s)?1\s*=\s*([^\|<\n]+)/i);
  const awayAssistMatch = wikitext.match(/\|assist(?:s)?2\s*=\s*([^\|<\n]+)/i);

  const spanishHome = translateTeam(homeTeam);
  const spanishAway = translateTeam(awayTeam);

  function extractPlayerNames(rawStr) {
    if (!rawStr) return [];
    const names = [];
    // Match {{football player|Name|time}} or {{goal|Name|time}} or similar
    const templateRe = /\{\{[^|{}]+\|([^|{}]+)\|[^{}]*\}\}/g;
    let m;
    while ((m = templateRe.exec(rawStr)) !== null) {
      const candidate = m[1].trim();
      // Skip if it's a flag template or empty
      if (candidate && !candidate.startsWith('flag') && candidate.length > 1) {
        names.push(candidate);
      }
    }

    // Fallback: plain names before a minute marker like "Name 45'" or "Name 45+2'"
    if (names.length === 0) {
      const plainRe = /([A-ZÀ-Ö][a-zà-öø-ÿ]+(?:\s+[A-ZÀ-Öa-zà-öø-ÿ'-]+){0,4})\s+\d{1,3}(?:\+\d+)?'/g;
      while ((m = plainRe.exec(rawStr)) !== null) {
        names.push(m[1].trim());
      }
    }

    return [...new Set(names)]; // deduplicate
  }

  const homeGoals = extractPlayerNames(homeGoalMatch?.[1]);
  const awayGoals = extractPlayerNames(awayGoalMatch?.[1]);
  const homeAssists = extractPlayerNames(homeAssistMatch?.[1]);
  const awayAssists = extractPlayerNames(awayAssistMatch?.[1]);

  for (const name of homeGoals) stats.push({ name, team: spanishHome, goals: 1, assists: 0 });
  for (const name of awayGoals) stats.push({ name, team: spanishAway, goals: 1, assists: 0 });
  for (const name of homeAssists) stats.push({ name, team: spanishHome, goals: 0, assists: 1 });
  for (const name of awayAssists) stats.push({ name, team: spanishAway, goals: 0, assists: 1 });

  return stats;
}

/** Aggregate raw events into { "Name|Team": { name, team, goals, assists } } */
function aggregateStats(events) {
  const map = new Map();
  for (const ev of events) {
    const key = `${ev.name.trim()}|${ev.team.trim()}`;
    if (!map.has(key)) {
      map.set(key, { name: ev.name.trim(), team: ev.team.trim(), goals: 0, assists: 0 });
    }
    const entry = map.get(key);
    entry.goals += ev.goals;
    entry.assists += ev.assists;
  }
  return map;
}

// ─── Database helpers ──────────────────────────────────────────────────────────

/**
 * Upsert player stats: if the player already exists (name + team), increment
 * their counters; otherwise insert a new row.
 * Uses the 'id' returned from SELECT to do targeted UPDATEs, which respects RLS
 * even though we're using the service-role key here.
 */
async function upsertPlayerStats(statsMap) {
  if (statsMap.size === 0) return { inserted: 0, updated: 0, errors: 0 };

  const { data: existingPlayers, error: fetchErr } = await supabase
    .from('player_stats')
    .select('id, name, team, goals, assists');

  if (fetchErr) {
    console.error('[upsert] Error fetching existing player_stats:', fetchErr.message);
    return { inserted: 0, updated: 0, errors: 1 };
  }

  const dbMap = new Map();
  for (const p of existingPlayers) {
    dbMap.set(`${p.name.trim()}|${p.team.trim()}`, p);
  }

  let inserted = 0;
  let updated = 0;
  let errors = 0;

  for (const [key, agg] of statsMap.entries()) {
    if (dbMap.has(key)) {
      const existing = dbMap.get(key);
      const newGoals = existing.goals + agg.goals;
      const newAssists = existing.assists + agg.assists;

      if (newGoals !== existing.goals || newAssists !== existing.assists) {
        const { error } = await supabase
          .from('player_stats')
          .update({ goals: newGoals, assists: newAssists })
          .eq('id', existing.id);

        if (error) {
          console.error(`[upsert] Error updating ${agg.name}:`, error.message);
          errors++;
        } else {
          updated++;
        }
      }
    } else {
      const { error } = await supabase.from('player_stats').insert({
        name: agg.name,
        team: agg.team,
        goals: agg.goals,
        assists: agg.assists,
      });

      if (error) {
        console.error(`[upsert] Error inserting ${agg.name}:`, error.message);
        errors++;
      } else {
        inserted++;
      }
    }
  }

  return { inserted, updated, errors };
}

/** Mark a match as processed so we don't re-scrape it next run. */
async function markMatchProcessed(matchId) {
  const { error } = await supabase
    .from('matches')
    .update({ stats_processed: true })
    .eq('id', matchId);

  if (error) {
    console.error(`[mark] Error marking match ${matchId} as processed:`, error.message);
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('[sync-player-stats] Starting run at', new Date().toISOString());

  // 1. Fetch unprocessed finished matches
  // First attempt: use stats_processed column (requires migration 020 to be applied).
  // Fall back gracefully if the column does not yet exist.
  let matches;
  let columnExists = true;

  const { data: matchesWithFlag, error: matchErr } = await supabase
    .from('matches')
    .select('id, home_team, away_team, group_name, home_score, away_score')
    .eq('status', 'finished')
    .eq('stats_processed', false)
    .order('id', { ascending: true });

  if (matchErr) {
    if (matchErr.message.includes('stats_processed')) {
      columnExists = false;
      console.warn(
        '[sync-player-stats] ⚠️  Column "stats_processed" does not exist on the matches table.'
      );
      console.warn(
        '[sync-player-stats] ⚠️  Please apply migration 020 in the Supabase SQL Editor:'
      );
      console.warn('');
      console.warn('    ALTER TABLE public.matches');
      console.warn('    ADD COLUMN IF NOT EXISTS stats_processed boolean NOT NULL DEFAULT false;');
      console.warn('');
      console.warn('    UPDATE public.matches SET stats_processed = true WHERE status = \'finished\';');
      console.warn('');
      console.warn('[sync-player-stats] Aborting until migration is applied.');
      process.exit(1);
    }
    console.error('[sync-player-stats] Error fetching matches:', matchErr.message);
    process.exit(1);
  }

  matches = matchesWithFlag;

  if (!matches || matches.length === 0) {
    console.log('[sync-player-stats] No unprocessed matches found. Nothing to do.');
    return;
  }

  console.log(`[sync-player-stats] Found ${matches.length} unprocessed finished match(es).`);

  // Cache fetched wikitext per title to avoid redundant HTTP requests
  const wikiCache = new Map();

  let totalInserted = 0;
  let totalUpdated = 0;
  let totalErrors = 0;
  let skipped = 0;

  for (const match of matches) {
    const { id, home_team, away_team, group_name } = match;
    const label = `Match ${id}: ${home_team} vs ${away_team}`;

    console.log(`\n[sync] Processing ${label}…`);

    const wikiTitle = buildWikiTitle(home_team, away_team, group_name);

    // Fetch wikitext (use cache if already fetched for this article)
    if (!wikiCache.has(wikiTitle)) {
      try {
        const text = await fetchWikiText(wikiTitle);
        wikiCache.set(wikiTitle, text);
      } catch (err) {
        console.warn(`[sync] Could not fetch Wikipedia article "${wikiTitle}": ${err.message}`);
        wikiCache.set(wikiTitle, null);
      }

      // Be a polite bot: 1 second between distinct Wikipedia requests
      await new Promise((r) => setTimeout(r, 1000));
    }

    const wikiText = wikiCache.get(wikiTitle);

    if (!wikiText) {
      console.warn(`[sync] No Wikipedia content found for "${wikiTitle}". Skipping match ${id}.`);
      skipped++;
      continue;
    }

    // Parse stats from wikitext
    const events = parseMatchStats(wikiText, home_team, away_team);

    if (events.length === 0) {
      console.warn(
        `[sync] Could not parse any player events for ${label}. ` +
        `Wikipedia article may not yet have scorer data. Skipping.`
      );
      skipped++;
      continue;
    }

    console.log(`[sync] Parsed ${events.length} events for ${label}.`);

    const statsMap = aggregateStats(events);
    const { inserted, updated, errors } = await upsertPlayerStats(statsMap);

    console.log(
      `[sync] ${label} → inserted: ${inserted}, updated: ${updated}, errors: ${errors}`
    );

    totalInserted += inserted;
    totalUpdated += updated;
    totalErrors += errors;

    // Mark match as processed even if some player rows errored,
    // to avoid endless re-processing of partially-done matches.
    await markMatchProcessed(id);
  }

  console.log('\n─────────────────────────────────────');
  console.log('[sync-player-stats] Run complete.');
  console.log(`  Matches processed : ${matches.length - skipped}`);
  console.log(`  Matches skipped   : ${skipped}`);
  console.log(`  Players inserted  : ${totalInserted}`);
  console.log(`  Players updated   : ${totalUpdated}`);
  console.log(`  Errors            : ${totalErrors}`);
  console.log('─────────────────────────────────────');

  if (totalErrors > 0) {
    process.exit(1); // Signal failure to GitHub Actions
  }
}

main().catch((err) => {
  console.error('[sync-player-stats] Unhandled error:', err);
  process.exit(1);
});
