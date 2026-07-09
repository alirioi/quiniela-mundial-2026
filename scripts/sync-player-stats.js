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

// ─── FIFA Country Code to DB Spanish Name Mapping ──────────────────────────────
const FIFA_CODE_MAP = {
  'ARG': 'Argentina',
  'AUS': 'Australia',
  'AUT': 'Austria',
  'BEL': 'Bélgica',
  'BIH': 'Bosnia y Herzegovina',
  'BRA': 'Brasil',
  'CAN': 'Canadá',
  'CPV': 'Cabo Verde',
  'COL': 'Colombia',
  'CIV': 'Costa de Marfil',
  'CRO': 'Croacia',
  'CZE': 'Chequia',
  'COD': 'RD Congo',
  'ECU': 'Ecuador',
  'EGY': 'Egipto',
  'ENG': 'Inglaterra',
  'FRA': 'Francia',
  'GER': 'Alemania',
  'GHA': 'Ghana',
  'HAI': 'Haití',
  'IRN': 'Irán',
  'IRQ': 'Irak',
  'JPN': 'Japón',
  'JOR': 'Jordania',
  'MAR': 'Marruecos',
  'MEX': 'México',
  'NED': 'Países Bajos',
  'NZL': 'Nueva Zelanda',
  'NOR': 'Noruega',
  'PAN': 'Panamá',
  'PAR': 'Paraguay',
  'POR': 'Portugal',
  'QAT': 'Qatar',
  'KSA': 'Arabia Saudita',
  'SCO': 'Escocia',
  'SEN': 'Senegal',
  'RSA': 'Sudáfrica',
  'KOR': 'Corea del Sur',
  'ESP': 'España',
  'SWE': 'Suecia',
  'SUI': 'Suiza',
  'TUN': 'Túnez',
  'TUR': 'Turquía',
  'URU': 'Uruguay',
  'USA': 'Estados Unidos',
  'UZB': 'Uzbekistán',
  'CUW': 'Curazao',
  'ALG': 'Argelia',
};

function translateTeam(englishName) {
  return TEAM_TRANSLATION[englishName] ?? englishName;
}

// ─── Wikipedia helpers ─────────────────────────────────────────────────────────

/**
 * Builds the expected Wikipedia article title for a given match.
 * Wikipedia organises knockout rounds into separate articles:
 *   - Matches 73-88:  2026 FIFA World Cup round of 32
 *   - Matches 89-96:  2026 FIFA World Cup round of 16
 *   - Matches 97-100: 2026 FIFA World Cup quarter-finals
 *   - Matches 101-102 / 103: 2026 FIFA World Cup semi-finals / third-place play-off / final
 */
function buildWikiTitle(homeTeam, awayTeam, groupName, matchNumber) {
  if (groupName) {
    const isKnockout = /dieciseisavos|octavos|cuartos|semifinal|final|tercer/i.test(groupName);
    if (!isKnockout) {
      const groupLetter = groupName.replace(/^Grupo\s+/i, '').replace(/^Group\s+/i, '');
      return `2026_FIFA_World_Cup_Group_${groupLetter}`;
    }
  }
  return '2026_FIFA_World_Cup_knockout_stage';
}

// ─── Knockout Bracket Resolution Helpers (JS Vanilla) ──────────────────────────

const allowedOpponents = {
  'A': ['C', 'E', 'F', 'H', 'I'],
  'B': ['E', 'F', 'G', 'I', 'J'],
  'D': ['B', 'E', 'F', 'I', 'J'],
  'E': ['A', 'B', 'C', 'D', 'F'],
  'G': ['A', 'E', 'H', 'I', 'J'],
  'I': ['C', 'D', 'F', 'G', 'H'],
  'K': ['D', 'E', 'I', 'J', 'L'],
  'L': ['E', 'H', 'I', 'J', 'K']
};

function isPlaceholderName(name) {
  if (!name) return true;
  return name.startsWith('1º') || 
         name.startsWith('2º') || 
         name.startsWith('3º') || 
         name.startsWith('Ganador') ||
         name.startsWith('Perdedor');
}

function matchWinnersToThirds(winners, thirds, assignment = {}) {
  if (winners.length === 0) return assignment;
  const currentWinner = winners[0];
  const remainingWinners = winners.slice(1);
  const options = allowedOpponents[currentWinner] || [];

  for (const option of options) {
    if (thirds.includes(option) && !Object.values(assignment).includes(option)) {
      const newAssignment = { ...assignment, [currentWinner]: option };
      const result = matchWinnersToThirds(remainingWinners, thirds, newAssignment);
      if (result) return result;
    }
  }
  return null;
}

function calculateGroupStandings(matches) {
  const statsByGroup = {};

  matches.forEach(match => {
    if (!match.group_name || match.phase_id !== 1) return;
    const group = match.group_name;
    
    if (!statsByGroup[group]) statsByGroup[group] = {};
    if (!statsByGroup[group][match.home_team]) {
      statsByGroup[group][match.home_team] = { team: match.home_team, group, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, dg: 0, pts: 0 };
    }
    if (!statsByGroup[group][match.away_team]) {
      statsByGroup[group][match.away_team] = { team: match.away_team, group, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, dg: 0, pts: 0 };
    }

    if ((match.status === 'finished' || match.status === 'live') && match.home_score !== null && match.away_score !== null) {
      const home = statsByGroup[group][match.home_team];
      const away = statsByGroup[group][match.away_team];
      
      home.pj++;
      away.pj++;
      home.gf += match.home_score;
      home.gc += match.away_score;
      away.gf += match.away_score;
      away.gc += match.home_score;

      if (match.home_score > match.away_score) {
        home.g++;
        home.pts += 3;
        away.p++;
      } else if (match.home_score < match.away_score) {
        away.g++;
        away.pts += 3;
        home.p++;
      } else {
        home.e++;
        away.e++;
        home.pts += 1;
        away.pts += 1;
      }
    }
  });

  const finalStandings = {};
  const allThirds = [];

  Object.keys(statsByGroup).sort().forEach(group => {
    const teams = Object.values(statsByGroup[group]);
    teams.forEach(t => t.dg = t.gf - t.gc);
    
    teams.sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      if (b.dg !== a.dg) return b.dg - a.dg;
      if (b.gf !== a.gf) return b.gf - a.gf;
      return a.team.localeCompare(b.team);
    });
    
    finalStandings[group] = teams;
    if (teams.length >= 3) allThirds.push(teams[2]);
  });

  allThirds.sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.dg !== a.dg) return b.dg - a.dg;
    if (b.gf !== a.gf) return b.gf - a.gf;
    if (b.g !== a.g) return b.g - a.g;
    return a.team.localeCompare(b.team);
  });

  return { groupStandings: finalStandings, thirdPlaces: allThirds };
}

function calculateKnockoutBracket(groupStandings, thirdPlaces, dbMatches = []) {
  const winners = {};
  const runnersUp = {};
  const thirdPlaceMap = {};
  const groups = ['Grupo A', 'Grupo B', 'Grupo C', 'Grupo D', 'Grupo E', 'Grupo F', 'Grupo G', 'Grupo H', 'Grupo I', 'Grupo J', 'Grupo K', 'Grupo L'];
  
  groups.forEach(groupName => {
    const letter = groupName.replace('Grupo ', '');
    const teams = groupStandings[groupName] || [];
    winners[letter] = teams[0]?.team || `1º ${letter}`;
    runnersUp[letter] = teams[1]?.team || `2º ${letter}`;
    thirdPlaceMap[letter] = teams[2]?.team || `3º ${letter}`;
  });

  const sortedThirds = [...thirdPlaces].sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.dg !== a.dg) return b.dg - a.dg;
    if (b.gf !== a.gf) return b.gf - a.gf;
    if (b.g !== a.g) return b.g - a.g;
    return a.group.localeCompare(b.group);
  });

  const bestEightThirds = sortedThirds.slice(0, 8);
  const bestEightLetters = bestEightThirds.map(t => t.group.replace('Grupo ', ''));
  const winnersToMatch = ['E', 'I', 'A', 'L', 'D', 'G', 'B', 'K'];
  const solvedAssignments = matchWinnersToThirds(winnersToMatch, bestEightLetters) || {};

  const getThirdPlaceOpponent = (winnerLetter) => {
    const assignedGroupLetter = solvedAssignments[winnerLetter];
    return assignedGroupLetter ? (thirdPlaceMap[assignedGroupLetter] || `3º ${assignedGroupLetter}`) : `3º Grupo ${winnerLetter}`;
  };

  const r32 = {
    73: { matchNumber: 73, homeTeam: runnersUp['A'], awayTeam: runnersUp['B'] },
    74: { matchNumber: 74, homeTeam: winners['E'], awayTeam: getThirdPlaceOpponent('E') },
    75: { matchNumber: 75, homeTeam: winners['F'], awayTeam: runnersUp['C'] },
    76: { matchNumber: 76, homeTeam: winners['C'], awayTeam: runnersUp['F'] },
    77: { matchNumber: 77, homeTeam: winners['I'], awayTeam: getThirdPlaceOpponent('I') },
    78: { matchNumber: 78, homeTeam: runnersUp['E'], awayTeam: runnersUp['I'] },
    79: { matchNumber: 79, homeTeam: winners['A'], awayTeam: getThirdPlaceOpponent('A') },
    80: { matchNumber: 80, homeTeam: winners['L'], awayTeam: getThirdPlaceOpponent('L') },
    81: { matchNumber: 81, homeTeam: winners['D'], awayTeam: getThirdPlaceOpponent('D') },
    82: { matchNumber: 82, homeTeam: winners['G'], awayTeam: getThirdPlaceOpponent('G') },
    83: { matchNumber: 83, homeTeam: runnersUp['K'], awayTeam: runnersUp['L'] },
    84: { matchNumber: 84, homeTeam: winners['H'], awayTeam: runnersUp['J'] },
    85: { matchNumber: 85, homeTeam: winners['B'], awayTeam: getThirdPlaceOpponent('B') },
    86: { matchNumber: 86, homeTeam: winners['J'], awayTeam: runnersUp['H'] },
    87: { matchNumber: 87, homeTeam: winners['K'], awayTeam: getThirdPlaceOpponent('K') },
    88: { matchNumber: 88, homeTeam: runnersUp['D'], awayTeam: runnersUp['G'] }
  };

  const applyDbMatches = (round) => {
    dbMatches.forEach(dbMatch => {
      const num = dbMatch.match_number || dbMatch.matchNumber;
      if (num && round[num]) {
        if (dbMatch.home_team && !isPlaceholderName(dbMatch.home_team)) round[num].homeTeam = dbMatch.home_team;
        if (dbMatch.away_team && !isPlaceholderName(dbMatch.away_team)) round[num].awayTeam = dbMatch.away_team;
        if (dbMatch.home_score !== undefined) round[num].homeScore = dbMatch.home_score;
        if (dbMatch.away_score !== undefined) round[num].awayScore = dbMatch.away_score;
        if (dbMatch.winner) {
          round[num].winner = dbMatch.winner;
        } else if (dbMatch.status === 'finished' && dbMatch.home_score !== null && dbMatch.away_score !== null) {
          if (dbMatch.home_score > dbMatch.away_score) round[num].winner = round[num].homeTeam;
          else if (dbMatch.away_score > dbMatch.home_score) round[num].winner = round[num].awayTeam;
          else if (dbMatch.penalty_winner) round[num].winner = dbMatch.penalty_winner;
        }
      }
    });
  };

  applyDbMatches(r32);

  const getWinnerName = (match) => {
    if (match.winner) return match.winner;
    if (match.homeTeam && !isPlaceholderName(match.homeTeam)) {
      if (match.homeScore !== undefined && match.homeScore !== null && match.awayScore !== undefined && match.awayScore !== null) {
        if (match.homeScore > match.awayScore) return match.homeTeam;
        if (match.awayScore > match.homeScore) return match.awayTeam;
      }
    }
    return `Ganador M${match.matchNumber}`;
  };

  const r16 = {
    89: { matchNumber: 89, homeTeam: getWinnerName(r32[74]), awayTeam: getWinnerName(r32[77]) },
    90: { matchNumber: 90, homeTeam: getWinnerName(r32[73]), awayTeam: getWinnerName(r32[75]) },
    91: { matchNumber: 91, homeTeam: getWinnerName(r32[76]), awayTeam: getWinnerName(r32[78]) },
    92: { matchNumber: 92, homeTeam: getWinnerName(r32[79]), awayTeam: getWinnerName(r32[80]) },
    93: { matchNumber: 93, homeTeam: getWinnerName(r32[83]), awayTeam: getWinnerName(r32[84]) },
    94: { matchNumber: 94, homeTeam: getWinnerName(r32[81]), awayTeam: getWinnerName(r32[82]) },
    95: { matchNumber: 95, homeTeam: getWinnerName(r32[86]), awayTeam: getWinnerName(r32[88]) },
    96: { matchNumber: 96, homeTeam: getWinnerName(r32[85]), awayTeam: getWinnerName(r32[87]) }
  };

  applyDbMatches(r16);

  const qf = {
    97: { matchNumber: 97, homeTeam: getWinnerName(r16[89]), awayTeam: getWinnerName(r16[90]) },
    98: { matchNumber: 98, homeTeam: getWinnerName(r16[93]), awayTeam: getWinnerName(r16[94]) },
    99: { matchNumber: 99, homeTeam: getWinnerName(r16[91]), awayTeam: getWinnerName(r16[92]) },
    100: { matchNumber: 100, homeTeam: getWinnerName(r16[95]), awayTeam: getWinnerName(r16[96]) }
  };

  applyDbMatches(qf);

  const sf = {
    101: { matchNumber: 101, homeTeam: getWinnerName(qf[97]), awayTeam: getWinnerName(qf[98]) },
    102: { matchNumber: 102, homeTeam: getWinnerName(qf[99]), awayTeam: getWinnerName(qf[100]) }
  };

  applyDbMatches(sf);

  const getLoserName = (match) => {
    if (match.winner) return match.winner === match.homeTeam ? match.awayTeam : match.homeTeam;
    if (match.homeTeam && !isPlaceholderName(match.homeTeam)) {
      if (match.homeScore !== undefined && match.homeScore !== null && match.awayScore !== undefined && match.awayScore !== null) {
        return match.homeScore > match.awayScore ? match.awayTeam : match.homeTeam;
      }
    }
    return `Perdedor M${match.matchNumber}`;
  };

  const finalMatch = { matchNumber: 104, homeTeam: getWinnerName(sf[101]), awayTeam: getWinnerName(sf[102]) };
  const thirdPlaceMatch = { matchNumber: 103, homeTeam: getLoserName(sf[101]), awayTeam: getLoserName(sf[102]) };

  applyDbMatches({ 104: finalMatch });
  applyDbMatches({ 103: thirdPlaceMatch });

  return { r32, r16, qf, sf, finalMatch, thirdPlaceMatch };
}

function resolveKnockoutTeamNames(matchesToResolve, allMatches) {
  if (!matchesToResolve || matchesToResolve.length === 0) return;
  const { groupStandings, thirdPlaces } = calculateGroupStandings(allMatches);
  const bracket = calculateKnockoutBracket(groupStandings, thirdPlaces, allMatches);
  
  const knockoutMatchesByNumber = new Map();
  [
    ...Object.values(bracket.r32),
    ...Object.values(bracket.r16),
    ...Object.values(bracket.qf),
    ...Object.values(bracket.sf),
    bracket.finalMatch,
    bracket.thirdPlaceMatch
  ].filter(Boolean).forEach((km) => knockoutMatchesByNumber.set(km.matchNumber, km));

  matchesToResolve.forEach(match => {
    const km = knockoutMatchesByNumber.get(match.match_number);
    if (km) {
      if (!isPlaceholderName(km.homeTeam)) match.home_team = km.homeTeam;
      if (!isPlaceholderName(km.awayTeam)) match.away_team = km.awayTeam;
    }
  });
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

/** Extract all football box blocks in wikitext, respecting nested templates. */
function extractFootballBoxes(wikitext) {
  const boxes = [];
  const regex = /\{\{\s*(?:#invoke:\s*football\s*box|football\s*box|footballbox)\b/ig;
  let match;
  while ((match = regex.exec(wikitext)) !== null) {
    const startIndex = match.index;
    let braceCount = 2;
    let i = startIndex + match[0].length;
    while (i < wikitext.length && braceCount > 0) {
      if (wikitext[i] === '{' && wikitext[i+1] === '{') {
        braceCount += 2;
        i += 2;
      } else if (wikitext[i] === '}' && wikitext[i+1] === '}') {
        braceCount -= 2;
        i += 2;
      } else if (wikitext[i] === '{') {
        braceCount++;
        i++;
      } else if (wikitext[i] === '}') {
        braceCount--;
        i++;
      } else {
        i++;
      }
    }
    const boxContent = wikitext.substring(startIndex, i);
    boxes.push(boxContent);
  }
  return boxes;
}

/** Safely extract a template parameter value, respecting nested templates. */
function getTemplateParam(templateText, paramName) {
  const regex = new RegExp(`\\|\\s*${paramName}\\s*=`, 'i');
  const match = regex.exec(templateText);
  if (!match) return null;
  
  let i = match.index + match[0].length;
  let braceCount = 0;
  let bracketCount = 0;
  const start = i;
  while (i < templateText.length) {
    const char = templateText[i];
    if (char === '{') braceCount++;
    else if (char === '}') {
      if (braceCount === 0) break; // End of template
      braceCount--;
    }
    else if (char === '[') bracketCount++;
    else if (char === ']') bracketCount--;
    else if (char === '|' && braceCount === 0 && bracketCount === 0) {
      break; // Next parameter
    }
    i++;
  }
  return templateText.substring(start, i).trim();
}

/** Parse team name from team parameter (uses FIFA code or text match). */
function getTeamFromParam(paramValue) {
  if (!paramValue) return null;
  
  const fifaMatch = paramValue.match(/\|([A-Z]{3})\b/);
  if (fifaMatch) {
    const code = fifaMatch[1];
    if (FIFA_CODE_MAP[code]) {
      return FIFA_CODE_MAP[code];
    }
  }
  
  const valLower = paramValue.toLowerCase();
  for (const [en, es] of Object.entries(TEAM_TRANSLATION)) {
    if (valLower.includes(en.toLowerCase()) || valLower.includes(es.toLowerCase())) {
      return es;
    }
  }
  
  return null;
}

/** Find the specific football box block that corresponds to the match. */
function findMatchFootballBox(wikitext, homeTeamEs, awayTeamEs) {
  const boxes = extractFootballBoxes(wikitext);
  
  // Try parameter-based matching (most reliable)
  for (const box of boxes) {
    const team1Param = getTemplateParam(box, 'team1');
    const team2Param = getTemplateParam(box, 'team2');
    
    const team1 = getTeamFromParam(team1Param);
    const team2 = getTeamFromParam(team2Param);
    
    if (team1 && team2) {
      const matchNormal = (team1.toLowerCase() === homeTeamEs.toLowerCase() && team2.toLowerCase() === awayTeamEs.toLowerCase());
      const matchSwapped = (team2.toLowerCase() === homeTeamEs.toLowerCase() && team1.toLowerCase() === awayTeamEs.toLowerCase());
      if (matchNormal || matchSwapped) {
        return { box, swapped: matchSwapped };
      }
    }
  }
  
  // Fallback: match via section header
  const sections = wikitext.split(/(====*[^=]+====*)/);
  for (let i = 0; i < sections.length; i++) {
    const part = sections[i];
    if (part.startsWith('==')) {
      const heading = part.replace(/={2,}/g, '').trim().toLowerCase();
      const cleanStr = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const hClean = cleanStr(heading);
      const homeClean = cleanStr(homeTeamEs);
      const awayClean = cleanStr(awayTeamEs);
      
      let homeEn = homeTeamEs;
      let awayEn = awayTeamEs;
      for (const [en, es] of Object.entries(TEAM_TRANSLATION)) {
        if (es.toLowerCase() === homeTeamEs.toLowerCase()) homeEn = en;
        if (es.toLowerCase() === awayTeamEs.toLowerCase()) awayEn = en;
      }
      const homeEnClean = cleanStr(homeEn);
      const awayEnClean = cleanStr(awayEn);
      
      const containsHome = hClean.includes(homeClean) || hClean.includes(homeEnClean);
      const containsAway = hClean.includes(awayClean) || hClean.includes(awayEnClean);
      
      if (containsHome && containsAway) {
        const nextContent = sections[i + 1] || '';
        const boxesInSection = extractFootballBoxes(nextContent);
        if (boxesInSection.length > 0) {
          return { box: boxesInSection[0], swapped: false };
        }
      }
    }
  }
  
  return null;
}

/** Parses a goals or assists list into an array of { name, count }. */
function parsePlayerList(rawStr) {
  if (!rawStr) return [];
  const players = [];

  const lines = rawStr.split(/(?:\*|\n)/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.toLowerCase().includes('o.g.') || trimmed.toLowerCase().includes('own goal')) {
      continue; // Skip own goals
    }

    let name = null;
    let count = 0;

    // Only match templates that actually contain the player's name (e.g. {{football player|Name|...}})
    // Do NOT match {{goal|minute}} or {{assist|minute}} as they only contain minutes, not names.
    const templateMatch = trimmed.match(/\{\{(?:football\s*player|player)\s*\|\s*([^|}]+)/i);
    if (templateMatch) {
      name = templateMatch[1].trim();
    } else {
      const linkMatch = trimmed.match(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/);
      if (linkMatch) {
        name = linkMatch[1].trim();
      } else {
        const nameMatch = trimmed.match(/^([A-ZÀ-Ö][a-zà-öø-ÿ]+(?:\s+[A-ZÀ-Öa-zà-öø-ÿ'-]+){0,4})/);
        if (nameMatch) {
          name = nameMatch[1].trim();
        }
      }
    }

    // Extract any goal/assist/football player templates on this line to count their minute values
    const allTemplates = trimmed.match(/\{\{[^}]+\}\}/g) || [];
    for (const temp of allTemplates) {
      if (temp.toLowerCase().includes('goal') || temp.toLowerCase().includes('assist') || temp.toLowerCase().includes('player')) {
        const params = temp.split('|').slice(1);
        for (const p of params) {
          const cleanP = p.replace('}}', '').trim();
          if (/^\d{1,3}(?:\+\d+)?'?$/.test(cleanP)) {
            count++;
          }
        }
      }
    }

    // If no templates with minutes were found, look for plain minutes on the line (e.g. 6', 39')
    if (count === 0) {
      const plainMinutes = trimmed.match(/\b\d{1,3}(?:\+\d+)?'/g) || [];
      count = plainMinutes.length;
    }

    if (name) {
      name = name.replace(/\s*\([^)]+\)/g, '').trim();
      if (count === 0) count = 1;
      players.push({ name, count });
    }
  }

  return players;
}


/** Parse goalscorers and assists from a Wikipedia match wikitext. */
function parseMatchStats(wikitext, homeTeam, awayTeam) {
  const stats = []; // { name, team, goals, assists }

  const spanishHome = translateTeam(homeTeam);
  const spanishAway = translateTeam(awayTeam);

  const matchBoxResult = findMatchFootballBox(wikitext, spanishHome, spanishAway);
  if (!matchBoxResult) {
    return stats;
  }

  const { box, swapped } = matchBoxResult;

  const goals1Raw = getTemplateParam(box, 'goals1') || getTemplateParam(box, 'goal1');
  const goals2Raw = getTemplateParam(box, 'goals2') || getTemplateParam(box, 'goal2');
  const assists1Raw = getTemplateParam(box, 'assist1') || getTemplateParam(box, 'assists1');
  const assists2Raw = getTemplateParam(box, 'assist2') || getTemplateParam(box, 'assists2');

  const homeGoalsRaw = swapped ? goals2Raw : goals1Raw;
  const awayGoalsRaw = swapped ? goals1Raw : goals2Raw;
  const homeAssistsRaw = swapped ? assists2Raw : assists1Raw;
  const awayAssistsRaw = swapped ? assists1Raw : assists2Raw;

  const homeGoals = parsePlayerList(homeGoalsRaw);
  const awayGoals = parsePlayerList(awayGoalsRaw);
  const homeAssists = parsePlayerList(homeAssistsRaw);
  const awayAssists = parsePlayerList(awayAssistsRaw);

  for (const { name, count } of homeGoals) {
    stats.push({ name, team: spanishHome, goals: count, assists: 0 });
  }
  for (const { name, count } of awayGoals) {
    stats.push({ name, team: spanishAway, goals: count, assists: 0 });
  }
  for (const { name, count } of homeAssists) {
    stats.push({ name, team: spanishHome, goals: 0, assists: count });
  }
  for (const { name, count } of awayAssists) {
    stats.push({ name, team: spanishAway, goals: 0, assists: count });
  }

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

  // 1. Fetch all matches to compute bracket standings and resolve placeholders
  const { data: allMatches, error: matchErr } = await supabase
    .from('matches')
    .select('id, phase_id, home_team, away_team, group_name, home_score, away_score, status, match_number, penalty_winner, stats_processed')
    .order('match_time', { ascending: true });

  if (matchErr) {
    console.error('[sync-player-stats] Error fetching matches:', matchErr.message);
    process.exit(1);
  }

  // 2. Resolve placeholders in-memory
  console.log('[sync-player-stats] Resolving knockout placeholders...');
  resolveKnockoutTeamNames(allMatches, allMatches);

  // 3. Filter finished and unprocessed matches
  const matches = allMatches.filter(m => m.status === 'finished' && m.stats_processed === false);

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
    const { id, match_number, home_team, away_team, group_name } = match;
    const label = `Match ${id}: ${home_team} vs ${away_team}`;

    console.log(`\n[sync] Processing ${label}…`);

    const wikiTitle = buildWikiTitle(home_team, away_team, group_name, match_number);

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

    const expectedGoals = (match.home_score ?? 0) + (match.away_score ?? 0);
    const parsedGoals = events.filter(e => e.goals > 0).reduce((sum, e) => sum + e.goals, 0);

    if (expectedGoals > 0 && parsedGoals === 0) {
      console.warn(
        `[sync] Match ${id} expected ${expectedGoals} goals, but parsed 0 goals. ` +
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

    // Mark match as processed
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
