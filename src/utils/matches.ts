import { supabaseAdmin } from '../lib/supabase-server';
import { calculateGroupStandings, calculateKnockoutBracket, isPlaceholderName } from './knockout';

/**
 * Obtiene todos los partidos con los campos estándar necesarios para cálculos
 */
export async function fetchAllMatches() {
  const { data, error } = await supabaseAdmin
    .from('matches')
    .select('id, phase_id, home_team, away_team, match_time, home_score, away_score, status, group_name, match_number, penalty_winner')
    .order('match_time', { ascending: true });
    
  return { data, error };
}

/**
 * Resuelve los placeholders de los partidos de la fase de eliminación directa ("3er C/E/F...", "Ganador 49...")
 * usando los resultados de la fase de grupos. Modifica los equipos IN-PLACE.
 */
export async function resolveKnockoutTeamNames(matchesToResolve: any[]) {
  if (!matchesToResolve || matchesToResolve.length === 0) return;

  const { data: allMatches } = await fetchAllMatches();
  if (!allMatches) return;

  const { groupStandings, thirdPlaces } = calculateGroupStandings(allMatches);
  const bracket = calculateKnockoutBracket(groupStandings, thirdPlaces, undefined, allMatches);
  
  const knockoutMatchesByNumber = new Map();
  [
    ...Object.values(bracket.r32),
    ...Object.values(bracket.r16),
    ...Object.values(bracket.qf),
    ...Object.values(bracket.sf),
    bracket.finalMatch,
    bracket.thirdPlaceMatch
  ].filter(Boolean).forEach((km: any) => knockoutMatchesByNumber.set(km.matchNumber, km));

  matchesToResolve.forEach(match => {
    const km = knockoutMatchesByNumber.get(match.match_number);
    if (km) {
      if (!isPlaceholderName(km.homeTeam)) match.home_team = km.homeTeam;
      if (!isPlaceholderName(km.awayTeam)) match.away_team = km.awayTeam;
    }
  });
}

/**
 * Determina si un partido está bloqueado (no se pueden cambiar los pronósticos).
 * Se bloquea 5 minutos antes de la hora del partido.
 */
export function isMatchLocked(matchTime: string): boolean {
  const matchTimeMs = new Date(matchTime).getTime();
  const nowMs = Date.now();
  const lockTimeMs = matchTimeMs - 5 * 60 * 1000; // 5 minutos antes
  return nowMs >= lockTimeMs;
}
