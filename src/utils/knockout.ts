/**
 * @file knockout.ts
 * @description Utilidades para el cálculo y gestión de la fase de eliminación directa (knockout) del Mundial 2026.
 * Incluye la lógica compleja para determinar emparejamientos basados en posiciones de grupos y
 * la selección de los mejores terceros según las reglas de la FIFA.
 */

/**
 * Estadísticas de rendimiento de un equipo en la fase de grupos.
 */
export interface TeamStats {
  team: string;
  group: string;
  pj: number; // Partidos Jugados
  g: number;  // Ganados
  e: number;  // Empatados
  p: number;  // Perdidos
  gf: number; // Goles a Favor
  gc: number; // Goles en Contra
  dg: number; // Diferencia de Goles
  pts: number; // Puntos
}

/**
 * Estructura de un partido en la fase de eliminación directa.
 */
export interface KnockoutMatch {
  matchNumber: number;
  homeTeam: string;
  awayTeam: string;
  homeScore?: number | null;
  awayScore?: number | null;
  winner?: string;
  placeholderHome: string;
  placeholderAway: string;
  dateStr: string;
  venue: string;
}

/**
 * Representación del cuadro completo de la fase eliminatoria.
 */
export interface KnockoutBracketData {
  r32: Record<number, KnockoutMatch>; // Dieciseisavos de final
  r16: Record<number, KnockoutMatch>; // Octavos de final
  qf: Record<number, KnockoutMatch>;  // Cuartos de final
  sf: Record<number, KnockoutMatch>;  // Semifinales
  finalMatch: KnockoutMatch;          // Gran Final
  thirdPlaceMatch: KnockoutMatch;     // Tercer Lugar
}

const allowedOpponents: Record<string, string[]> = {
  'A': ['C', 'E', 'F', 'H', 'I'],
  'B': ['E', 'F', 'G', 'I', 'J'],
  'D': ['B', 'E', 'F', 'I', 'J'],
  'E': ['A', 'B', 'C', 'D', 'F'],
  'G': ['A', 'E', 'H', 'I', 'J'],
  'I': ['C', 'D', 'F', 'G', 'H'],
  'K': ['D', 'E', 'I', 'J', 'L'],
  'L': ['E', 'H', 'I', 'J', 'K']
};

/**
 * Algoritmo de resolución por backtracking para asignar ganadores de grupo a mejores terceros.
 * Sigue las combinaciones permitidas por la FIFA para el formato de 48 equipos.
 * 
 * @param winners - Lista de letras de grupos cuyos ganadores enfrentan a un tercero.
 * @param thirds - Lista de letras de grupos que clasificaron como mejores terceros.
 * @param assignment - Acumulador para la recursión del mapeo.
 * @returns Un objeto con el mapeo ganador -> tercero o null si no hay solución válida.
 */
function matchWinnersToThirds(
  winners: string[],
  thirds: string[],
  assignment: Record<string, string> = {}
): Record<string, string> | null {
  if (winners.length === 0) {
    return assignment;
  }
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

/**
 * Datos de predicción para un partido de eliminación directa.
 */
export interface KnockoutPrediction {
  predicted_home?: number | null;
  predicted_away?: number | null;
  predicted_winner?: string | null;
}

/**
 * Calcula dinámicamente el cuadro de la fase eliminatoria.
 * 
 * @param groupStandings - Clasificaciones actuales de todos los grupos.
 * @param thirdPlaces - Lista de equipos que quedaron en tercer lugar.
 * @param predictionsMap - Mapa opcional con las predicciones del usuario para el cuadro.
 * @returns Objeto con todos los partidos calculados para cada ronda.
 */
export function calculateKnockoutBracket(
  groupStandings: Record<string, TeamStats[]>,
  thirdPlaces: TeamStats[],
  predictionsMap?: Record<number, KnockoutPrediction>,
  dbMatches?: any[]
): KnockoutBracketData {
  // 1. Get Winners and Runners-up from each group A-L
  const winners: Record<string, string> = {};
  const runnersUp: Record<string, string> = {};
  const thirdPlaceMap: Record<string, string> = {};

  const groups = ['Grupo A', 'Grupo B', 'Grupo C', 'Grupo D', 'Grupo E', 'Grupo F', 'Grupo G', 'Grupo H', 'Grupo I', 'Grupo J', 'Grupo K', 'Grupo L'];
  
  groups.forEach(groupName => {
    const letter = groupName.replace('Grupo ', '');
    const teams = groupStandings[groupName] || [];
    
    winners[letter] = teams[0]?.team || `1º ${letter}`;
    runnersUp[letter] = teams[1]?.team || `2º ${letter}`;
    thirdPlaceMap[letter] = teams[2]?.team || `3º ${letter}`;
  });

  // 2. Determine best 8 third places
  // Sort third places using FIFA rules: pts -> dg -> gf -> g (wins) -> group name (fallback)
  const sortedThirds = [...thirdPlaces].sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.dg !== a.dg) return b.dg - a.dg;
    if (b.gf !== a.gf) return b.gf - a.gf;
    if (b.g !== a.g) return b.g - a.g;
    return a.group.localeCompare(b.group);
  });

  const bestEightThirds = sortedThirds.slice(0, 8);
  const bestEightLetters = bestEightThirds.map(t => t.group.replace('Grupo ', ''));

  // 3. Match the 8 winners to the 8 third places using backtracking solver
  const winnersToMatch = ['E', 'I', 'A', 'L', 'D', 'G', 'B', 'K'];
  const solvedAssignments = matchWinnersToThirds(winnersToMatch, bestEightLetters) || {};

  // Helper to get third place team based on solved assignments
  const getThirdPlaceOpponent = (winnerLetter: string): string => {
    const assignedGroupLetter = solvedAssignments[winnerLetter];
    if (assignedGroupLetter) {
      return thirdPlaceMap[assignedGroupLetter] || `3º ${assignedGroupLetter}`;
    }
    // Fallback if not solved yet (incomplete data)
    return `3º Grupo ${winnerLetter}`;
  };

  // Build the 16 Round of 32 Matches
  const r32: Record<number, KnockoutMatch> = {
    73: {
      matchNumber: 73,
      homeTeam: runnersUp['A'],
      awayTeam: runnersUp['B'],
      placeholderHome: '2º Grupo A',
      placeholderAway: '2º Grupo B',
      dateStr: '28 JUN',
      venue: 'Los Ángeles'
    },
    74: {
      matchNumber: 74,
      homeTeam: winners['E'],
      awayTeam: getThirdPlaceOpponent('E'),
      placeholderHome: '1º Grupo E',
      placeholderAway: '3º A/B/C/D/F',
      dateStr: '29 JUN',
      venue: 'Boston'
    },
    75: {
      matchNumber: 75,
      homeTeam: winners['F'],
      awayTeam: runnersUp['C'],
      placeholderHome: '1º Grupo F',
      placeholderAway: '2º Grupo C',
      dateStr: '30 JUN',
      venue: 'Monterrey'
    },
    76: {
      matchNumber: 76,
      homeTeam: winners['C'],
      awayTeam: runnersUp['F'],
      placeholderHome: '1º Grupo C',
      placeholderAway: '2º Grupo F',
      dateStr: '29 JUN',
      venue: 'Houston'
    },
    77: {
      matchNumber: 77,
      homeTeam: winners['I'],
      awayTeam: getThirdPlaceOpponent('I'),
      placeholderHome: '1º Grupo I',
      placeholderAway: '3º C/D/F/G/H',
      dateStr: '30 JUN',
      venue: 'Nueva York / Nueva Jersey'
    },
    78: {
      matchNumber: 78,
      homeTeam: runnersUp['E'],
      awayTeam: runnersUp['I'],
      placeholderHome: '2º Grupo E',
      placeholderAway: '2º Grupo I',
      dateStr: '30 JUN',
      venue: 'Dallas'
    },
    79: {
      matchNumber: 79,
      homeTeam: winners['A'],
      awayTeam: getThirdPlaceOpponent('A'),
      placeholderHome: '1º Grupo A',
      placeholderAway: '3º C/E/F/H/I',
      dateStr: '1 JUL',
      venue: 'Ciudad de México'
    },
    80: {
      matchNumber: 80,
      homeTeam: winners['L'],
      awayTeam: getThirdPlaceOpponent('L'),
      placeholderHome: '1º Grupo L',
      placeholderAway: '3º E/H/I/J/K',
      dateStr: '1 JUL',
      venue: 'Atlanta'
    },
    81: {
      matchNumber: 81,
      homeTeam: winners['D'],
      awayTeam: getThirdPlaceOpponent('D'),
      placeholderHome: '1º Grupo D',
      placeholderAway: '3º B/E/F/I/J',
      dateStr: '1 JUL',
      venue: 'Seattle'
    },
    82: {
      matchNumber: 82,
      homeTeam: winners['G'],
      awayTeam: getThirdPlaceOpponent('G'),
      placeholderHome: '1º Grupo G',
      placeholderAway: '3º A/E/H/I/J',
      dateStr: '1 JUL',
      venue: 'San Francisco'
    },
    83: {
      matchNumber: 83,
      homeTeam: runnersUp['K'],
      awayTeam: runnersUp['L'],
      placeholderHome: '2º Grupo K',
      placeholderAway: '2º Grupo L',
      dateStr: '2 JUL',
      venue: 'Toronto'
    },
    84: {
      matchNumber: 84,
      homeTeam: winners['H'],
      awayTeam: runnersUp['J'],
      placeholderHome: '1º Grupo H',
      placeholderAway: '2º Grupo J',
      dateStr: '2 JUL',
      venue: 'Los Ángeles'
    },
    85: {
      matchNumber: 85,
      homeTeam: winners['B'],
      awayTeam: getThirdPlaceOpponent('B'),
      placeholderHome: '1º Grupo B',
      placeholderAway: '3º E/F/G/I/J',
      dateStr: '2 JUL',
      venue: 'Vancouver'
    },
    86: {
      matchNumber: 86,
      homeTeam: winners['J'],
      awayTeam: runnersUp['H'],
      placeholderHome: '1º Grupo J',
      placeholderAway: '2º Grupo H',
      dateStr: '3 JUL',
      venue: 'Miami'
    },
    87: {
      matchNumber: 87,
      homeTeam: winners['K'],
      awayTeam: getThirdPlaceOpponent('K'),
      placeholderHome: '1º Grupo K',
      placeholderAway: '3º D/E/I/J/L',
      dateStr: '3 JUL',
      venue: 'Kansas City'
    },
    88: {
      matchNumber: 88,
      homeTeam: runnersUp['D'],
      awayTeam: runnersUp['G'],
      placeholderHome: '2º Grupo D',
      placeholderAway: '2º Grupo G',
      dateStr: '3 JUL',
      venue: 'Dallas'
    }
  };

  // Overwrite R32 matches with DB matches if provided
  if (dbMatches && dbMatches.length > 0) {
    dbMatches.forEach(dbMatch => {
      const num = dbMatch.match_number || dbMatch.matchNumber;
      if (num && r32[num]) {
        // Only override if we have a real team or specific placeholder from the DB
        if (dbMatch.home_team) r32[num].homeTeam = dbMatch.home_team;
        if (dbMatch.away_team) r32[num].awayTeam = dbMatch.away_team;
        if (dbMatch.home_score !== undefined) r32[num].homeScore = dbMatch.home_score;
        if (dbMatch.away_score !== undefined) r32[num].awayScore = dbMatch.away_score;
        if (dbMatch.winner) r32[num].winner = dbMatch.winner;
        else if (dbMatch.status === 'finished' && dbMatch.home_score !== null && dbMatch.away_score !== null) {
          r32[num].winner = dbMatch.home_score > dbMatch.away_score ? dbMatch.home_team : dbMatch.away_team;
        }
      }
    });
  }

  // Helper to dynamically get winners of R32
  const getWinnerName = (match: KnockoutMatch): string => {
    // If the match has a simulated or real winner, return that team name.
    // If team name starts with placeholders, return "Ganador M[number]"
    if (match.winner) return match.winner;
    if (match.homeTeam && !match.homeTeam.startsWith('1º') && !match.homeTeam.startsWith('2º') && !match.homeTeam.startsWith('3º')) {
      // If we are simulating or have scores, decide based on that
      if (match.homeScore !== undefined && match.homeScore !== null && match.awayScore !== undefined && match.awayScore !== null) {
        if (match.homeScore > match.awayScore) return match.homeTeam;
        if (match.awayScore > match.homeScore) return match.awayTeam;
      }
    }
    return `Ganador M${match.matchNumber}`;
  };

  // Build the 8 Round of 16 matches (Matches 89 - 96)
  const r16: Record<number, KnockoutMatch> = {
    89: {
      matchNumber: 89,
      homeTeam: getWinnerName(r32[74]),
      awayTeam: getWinnerName(r32[77]),
      placeholderHome: 'Ganador M74',
      placeholderAway: 'Ganador M77',
      dateStr: '4 JUL',
      venue: 'Filadelfia'
    },
    90: {
      matchNumber: 90,
      homeTeam: getWinnerName(r32[73]),
      awayTeam: getWinnerName(r32[75]),
      placeholderHome: 'Ganador M73',
      placeholderAway: 'Ganador M75',
      dateStr: '4 JUL',
      venue: 'Houston'
    },
    91: {
      matchNumber: 91,
      homeTeam: getWinnerName(r32[76]),
      awayTeam: getWinnerName(r32[78]),
      placeholderHome: 'Ganador M76',
      placeholderAway: 'Ganador M78',
      dateStr: '5 JUL',
      venue: 'Nueva York / Nueva Jersey'
    },
    92: {
      matchNumber: 92,
      homeTeam: getWinnerName(r32[79]),
      awayTeam: getWinnerName(r32[80]),
      placeholderHome: 'Ganador M79',
      placeholderAway: 'Ganador M80',
      dateStr: '5 JUL',
      venue: 'Ciudad de México'
    },
    93: {
      matchNumber: 93,
      homeTeam: getWinnerName(r32[83]),
      awayTeam: getWinnerName(r32[84]),
      placeholderHome: 'Ganador M83',
      placeholderAway: 'Ganador M84',
      dateStr: '6 JUL',
      venue: 'Dallas'
    },
    94: {
      matchNumber: 94,
      homeTeam: getWinnerName(r32[81]),
      awayTeam: getWinnerName(r32[82]),
      placeholderHome: 'Ganador M81',
      placeholderAway: 'Ganador M82',
      dateStr: '6 JUL',
      venue: 'Seattle'
    },
    95: {
      matchNumber: 95,
      homeTeam: getWinnerName(r32[86]),
      awayTeam: getWinnerName(r32[88]),
      placeholderHome: 'Ganador M86',
      placeholderAway: 'Ganador M88',
      dateStr: '7 JUL',
      venue: 'Atlanta'
    },
    96: {
      matchNumber: 96,
      homeTeam: getWinnerName(r32[85]),
      awayTeam: getWinnerName(r32[87]),
      placeholderHome: 'Ganador M85',
      placeholderAway: 'Ganador M87',
      dateStr: '7 JUL',
      venue: 'Vancouver'
    }
  };

  // Build the 4 Quarterfinals (Matches 97 - 100)
  const qf: Record<number, KnockoutMatch> = {
    97: {
      matchNumber: 97,
      homeTeam: getWinnerName(r16[89]),
      awayTeam: getWinnerName(r16[90]),
      placeholderHome: 'Ganador M89',
      placeholderAway: 'Ganador M90',
      dateStr: '9 JUL',
      venue: 'Boston'
    },
    98: {
      matchNumber: 98,
      homeTeam: getWinnerName(r16[93]),
      awayTeam: getWinnerName(r16[94]),
      placeholderHome: 'Ganador M93',
      placeholderAway: 'Ganador M94',
      dateStr: '10 JUL',
      venue: 'Los Ángeles'
    },
    99: {
      matchNumber: 99,
      homeTeam: getWinnerName(r16[91]),
      awayTeam: getWinnerName(r16[92]),
      placeholderHome: 'Ganador M91',
      placeholderAway: 'Ganador M92',
      dateStr: '11 JUL',
      venue: 'Miami'
    },
    100: {
      matchNumber: 100,
      homeTeam: getWinnerName(r16[95]),
      awayTeam: getWinnerName(r16[96]),
      placeholderHome: 'Ganador M95',
      placeholderAway: 'Ganador M96',
      dateStr: '11 JUL',
      venue: 'Kansas City'
    }
  };

  // Build the 2 Semifinals (Matches 101 - 102)
  const sf: Record<number, KnockoutMatch> = {
    101: {
      matchNumber: 101,
      homeTeam: getWinnerName(qf[97]),
      awayTeam: getWinnerName(qf[98]),
      placeholderHome: 'Ganador M97',
      placeholderAway: 'Ganador M98',
      dateStr: '14 JUL',
      venue: 'Dallas'
    },
    102: {
      matchNumber: 102,
      homeTeam: getWinnerName(qf[99]),
      awayTeam: getWinnerName(qf[100]),
      placeholderHome: 'Ganador M99',
      placeholderAway: 'Ganador M100',
      dateStr: '15 JUL',
      venue: 'Atlanta'
    }
  };

  // Helper to dynamically get losers of semifinals/r32
  const getLoserName = (match: KnockoutMatch): string => {
    if (match.winner) {
      return match.winner === match.homeTeam ? match.awayTeam : match.homeTeam;
    }
    if (match.homeTeam && !match.homeTeam.startsWith('1º') && !match.homeTeam.startsWith('2º') && !match.homeTeam.startsWith('3º')) {
      if (match.homeScore !== undefined && match.homeScore !== null && match.awayScore !== undefined && match.awayScore !== null) {
        return match.homeScore > match.awayScore ? match.awayTeam : match.homeTeam;
      }
    }
    return `Perdedor M${match.matchNumber}`;
  };

  // Build the Final Match (Match 104 / Final)
  const finalMatch: KnockoutMatch = {
    matchNumber: 104, // 104 matches total in 2026 World Cup
    homeTeam: getWinnerName(sf[101]),
    awayTeam: getWinnerName(sf[102]),
    placeholderHome: 'Ganador M101',
    placeholderAway: 'Ganador M102',
    dateStr: '19 JUL',
    venue: 'Nueva York / Nueva Jersey'
  };

  // Build the Third Place Match (Match 103)
  const thirdPlaceMatch: KnockoutMatch = {
    matchNumber: 103,
    homeTeam: getLoserName(sf[101]),
    awayTeam: getLoserName(sf[102]),
    placeholderHome: 'Perdedor M101',
    placeholderAway: 'Perdedor M102',
    dateStr: '18 JUL',
    venue: 'Miami'
  };

  return { r32, r16, qf, sf, finalMatch, thirdPlaceMatch };
}
