import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase-browser';
import { BarChart3, ChevronLeft, ChevronRight, Trophy, Award } from 'lucide-react';
import { getTeamFlagUrl } from '../../utils/flags';

interface Match {
  id: number;
  home_team: string;
  away_team: string;
  match_time: string;
  home_score: number | null;
  away_score: number | null;
  status: 'scheduled' | 'live' | 'finished';
  group_name: string | null;
  match_number: number;
  phase_id: number;
}

interface Player {
  id: string;
  name: string;
  team: string;
  goals: number;
  assists: number;
}

interface TeamStats {
  team: string;
  group: string;
  pj: number;
  g: number;
  e: number;
  p: number;
  gf: number;
  gc: number;
  dg: number;
  pts: number;
}

interface Props {
  initialMatches: Match[];
  initialPlayers: Player[];
  goldTeams: string[];
}

export default function LiveGroupStandingsWidget({ initialMatches, initialPlayers, goldTeams }: Props) {
  const [matches, setMatches] = useState<Match[]>(initialMatches);
  const [players, setPlayers] = useState<Player[]>(initialPlayers);
  const [currentSlide, setCurrentSlide] = useState(0);

  const fetchLatestPlayers = async () => {
    try {
      const res = await fetch('/api/player-stats');
      if (res.ok) {
        const data = await res.json();
        setPlayers(data.slice(0, 5));
      }
    } catch (e) {
      console.error('Error fetching player stats:', e);
    }
  };

  // Suscribirse a cambios en tiempo real
  useEffect(() => {
    // Suscripción de partidos
    const matchesChannel = supabase
      .channel('public:matches-live-standings-widget-carousel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches' },
        (payload) => {
          const updatedMatch = payload.new as Match;
          setMatches((prev) =>
            prev.map((m) => (m.id === updatedMatch.id ? updatedMatch : m))
          );
        }
      )
      .subscribe();

    // Suscripción de goleadores (player_stats)
    const playersChannel = supabase
      .channel('public:player-stats-widget-carousel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'player_stats' },
        () => {
          fetchLatestPlayers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(matchesChannel);
      supabase.removeChannel(playersChannel);
    };
  }, []);

  // 1. Encontrar el grupo activo (en vivo o el siguiente)
  const activeGroup = useMemo(() => {
    const liveGroupMatch = matches.find(m => m.status === 'live' && m.group_name && m.phase_id === 1);
    if (liveGroupMatch) return liveGroupMatch.group_name;

    const now = new Date().getTime();
    const groupMatches = matches.filter(m => m.phase_id === 1 && m.group_name);
    
    const nextGroupMatch = groupMatches
      .filter(m => m.status === 'scheduled' && new Date(m.match_time).getTime() > now)
      .sort((a, b) => new Date(a.match_time).getTime() - new Date(b.match_time).getTime())[0];

    if (nextGroupMatch) return nextGroupMatch.group_name;

    const finishedGroupMatches = groupMatches.filter(m => m.status === 'finished');
    if (finishedGroupMatches.length > 0) {
      const lastFinished = finishedGroupMatches.sort((a, b) => new Date(b.match_time).getTime() - new Date(a.match_time).getTime())[0];
      return lastFinished.group_name;
    }

    return 'Grupo A';
  }, [matches]);

  // 2. Procesar las tablas de posiciones de TODOS los grupos (para clasificación de grupo y terceros)
  const { groupStandings, thirdPlaces } = useMemo(() => {
    const statsByGroup: Record<string, Record<string, TeamStats>> = {};

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

    const standingsMap: Record<string, TeamStats[]> = {};
    const thirdsList: TeamStats[] = [];

    Object.keys(statsByGroup).sort().forEach(group => {
      const teams = Object.values(statsByGroup[group]);
      teams.forEach(t => t.dg = t.gf - t.gc);
      
      teams.sort((a, b) => {
        if (b.pts !== a.pts) return b.pts - a.pts;
        if (b.dg !== a.dg) return b.dg - a.dg;
        if (b.gf !== a.gf) return b.gf - a.gf;
        return a.team.localeCompare(b.team);
      });
      
      standingsMap[group] = teams;
      
      if (teams.length >= 3) {
        thirdsList.push(teams[2]);
      }
    });

    thirdsList.sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      if (b.dg !== a.dg) return b.dg - a.dg;
      if (b.gf !== a.gf) return b.gf - a.gf;
      if (b.g !== a.g) return b.g - a.g;
      return a.team.localeCompare(b.team);
    });

    return { groupStandings: standingsMap, thirdPlaces: thirdsList };
  }, [matches]);

  const currentGroupStandings = useMemo(() => {
    return activeGroup ? groupStandings[activeGroup] || [] : [];
  }, [groupStandings, activeGroup]);

  // 3. Obtener goles de los 6 equipos favoritos del Pronóstico de Oro
  const goldTeamsStats = useMemo(() => {
    // Mapear todas las estadísticas de los equipos en la fase de grupos
    const allStats: Record<string, { team: string; gf: number }> = {};
    
    // Primero, inicializar los 6 equipos de la lista
    goldTeams.forEach(team => {
      allStats[team] = { team, gf: 0 };
    });

    // Calcular goles anotados
    matches.forEach(match => {
      if ((match.status === 'finished' || match.status === 'live') && match.home_score !== null && match.away_score !== null) {
        if (allStats[match.home_team] !== undefined) {
          allStats[match.home_team].gf += match.home_score;
        }
        if (allStats[match.away_team] !== undefined) {
          allStats[match.away_team].gf += match.away_score;
        }
      }
    });

    return Object.values(allStats).sort((a, b) => b.gf - a.gf);
  }, [matches, goldTeams]);

  // Navegación del carrusel
  const handlePrev = () => {
    setCurrentSlide(prev => (prev === 0 ? 3 : prev - 1));
  };

  const handleNext = () => {
    setCurrentSlide(prev => (prev === 3 ? 0 : prev + 1));
  };

  const slideTitles = [
    'Estadísticas en Vivo',
    'Pronóstico de Oro',
    'Top Goleadores',
    'Mejores Terceros'
  ];

  return (
    <div className="pt-3 pb-5 px-5 rounded-2xl bg-wc-card border border-wc-border backdrop-blur-sm space-y-4 relative overflow-hidden flex flex-col min-h-[345px] justify-between">
      <div className="absolute top-0 right-0 w-20 h-20 bg-wc-gold/5 rounded-full blur-xl pointer-events-none"></div>
      
      {/* Header */}
      <div>
        <div className="flex items-center justify-between border-b border-wc-border pb-2.5">
          <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2 font-sports">
            <BarChart3 className="w-5 h-5 text-wc-gold" strokeWidth={2.5} /> {slideTitles[currentSlide]}
          </h3>
          <div className="flex items-center gap-1">
            <button 
              onClick={handlePrev} 
              className="p-1 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition-colors"
              aria-label="Anterior"
            >
              <ChevronLeft className="w-4.5 h-4.5" />
            </button>
            <button 
              onClick={handleNext} 
              className="p-1 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition-colors"
              aria-label="Siguiente"
            >
              <ChevronRight className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>

        {/* Slides Content */}
        <div className="mt-3.5 flex-grow">
          {/* SLIDE 0: Clasificación del Grupo */}
          {currentSlide === 0 && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-sports uppercase tracking-wider">Clasificación en Vivo</span>
                {activeGroup && (
                  <span className="text-[9px] bg-wc-gold/15 text-wc-gold px-2 py-0.5 rounded-full border border-wc-gold/20 font-bold uppercase tracking-widest font-sports">
                    {activeGroup}
                  </span>
                )}
              </div>
              {currentGroupStandings.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400 font-sports uppercase tracking-wider">
                  No hay datos del grupo disponibles.
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-wc-dark/30 text-[10px] uppercase font-sports tracking-wider text-slate-500 border-b border-wc-border/30">
                      <th className="px-1 py-1.5 text-center w-6">#</th>
                      <th className="px-1 py-1.5">Equipo</th>
                      <th className="px-1 py-1.5 text-center w-8" title="Partidos Jugados">PJ</th>
                      <th className="px-1 py-1.5 text-center w-8" title="Diferencia de Goles">DG</th>
                      <th className="px-1 py-1.5 text-center w-8 text-wc-gold" title="Puntos">PTS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentGroupStandings.map((team, idx) => {
                      const flagUrl = getTeamFlagUrl(team.team);
                      const isQualifier = idx < 2;
                      
                      return (
                        <tr key={team.team} className="border-b border-wc-border/10 hover:bg-white/5 transition-colors text-xs">
                          <td className="px-1 py-1.5 text-center">
                            <span className={`font-sports font-bold ${isQualifier ? 'text-wc-green' : 'text-slate-450'}`}>
                              {idx + 1}
                            </span>
                          </td>
                          <td className="px-1 py-1.5 font-bold text-slate-200">
                            <div className="flex items-center gap-1.5 min-w-0">
                              {flagUrl ? (
                                <img src={flagUrl} alt="" className="w-4 h-3 object-cover rounded-[1px] shadow-sm flex-shrink-0" />
                              ) : (
                                <div className="w-4 h-3 bg-slate-700 rounded-[1px] flex-shrink-0"></div>
                              )}
                              <span className="truncate max-w-[100px]">{team.team}</span>
                            </div>
                          </td>
                          <td className="px-1 py-1.5 text-center text-slate-350 font-medium">{team.pj}</td>
                          <td className="px-1 py-1.5 text-center font-medium text-slate-350">
                            {team.dg > 0 ? `+${team.dg}` : team.dg}
                          </td>
                          <td className="px-1 py-1.5 text-center font-bold text-wc-gold">{team.pts}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* SLIDE 1: Goles Pronóstico de Oro */}
          {currentSlide === 1 && (
            <div className="space-y-3">
              <span className="text-[10px] text-slate-400 font-sports uppercase tracking-wider block">Goles de los Favoritos (Oro)</span>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-wc-dark/30 text-[10px] uppercase font-sports tracking-wider text-slate-500 border-b border-wc-border/30">
                    <th className="px-1 py-1.5 text-center w-6">#</th>
                    <th className="px-1 py-1.5">Equipo</th>
                    <th className="px-1 py-1.5 text-right text-wc-gold w-16" title="Goles a Favor">Goles</th>
                  </tr>
                </thead>
                <tbody>
                  {goldTeamsStats.map((teamStat, idx) => {
                    const flagUrl = getTeamFlagUrl(teamStat.team);
                    return (
                      <tr key={teamStat.team} className="border-b border-wc-border/10 hover:bg-white/5 transition-colors text-xs">
                        <td className="px-1 py-1.5 text-center text-slate-450 font-sports font-bold">
                          {idx + 1}
                        </td>
                        <td className="px-1 py-1.5 font-bold text-slate-200">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {flagUrl ? (
                              <img src={flagUrl} alt="" className="w-4 h-3 object-cover rounded-[1px] shadow-sm flex-shrink-0" />
                            ) : (
                              <div className="w-4 h-3 bg-slate-700 rounded-[1px] flex-shrink-0"></div>
                            )}
                            <span className="truncate max-w-[120px]">{teamStat.team}</span>
                          </div>
                        </td>
                        <td className="px-1 py-1.5 text-right font-extrabold text-wc-gold font-mono pr-2">
                          {teamStat.gf}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* SLIDE 2: Top Goleadores */}
          {currentSlide === 2 && (
            <div className="space-y-3">
              <span className="text-[10px] text-slate-400 font-sports uppercase tracking-wider block">Goleadores del Mundial</span>
              {players.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400 font-sports uppercase tracking-wider">
                  Sin goleadores registrados.
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-wc-dark/30 text-[10px] uppercase font-sports tracking-wider text-slate-500 border-b border-wc-border/30">
                      <th className="px-1 py-1.5 text-center w-6">Pos</th>
                      <th className="px-1 py-1.5">Jugador</th>
                      <th className="px-1 py-1.5 text-right text-wc-gold w-16">Goles</th>
                    </tr>
                  </thead>
                  <tbody>
                    {players.map((player, idx) => {
                      const flagUrl = getTeamFlagUrl(player.team);
                      return (
                        <tr key={player.id || player.name} className="border-b border-wc-border/10 hover:bg-white/5 transition-colors text-xs">
                          <td className="px-1 py-1.5 text-center text-slate-450 font-sports font-bold">
                            {idx + 1}
                          </td>
                          <td className="px-1 py-1.5 font-bold text-slate-200">
                            <div className="flex flex-col min-w-0">
                              <span className="truncate max-w-[125px] leading-tight block">{player.name}</span>
                              <div className="flex items-center gap-1 mt-0.5">
                                {flagUrl && (
                                  <img src={flagUrl} alt="" className="w-3 h-2 object-cover rounded-[1px] flex-shrink-0" />
                                )}
                                <span className="text-[9px] text-slate-450 font-medium uppercase truncate max-w-[90px]">{player.team}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-1 py-1.5 text-right font-extrabold text-wc-gold font-mono pr-2">
                            {player.goals}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* SLIDE 3: Mejores Terceros */}
          {currentSlide === 3 && (
            <div className="space-y-3">
              <span className="text-[10px] text-slate-400 font-sports uppercase tracking-wider block">Clasificación de Terceros (Top 8)</span>
              {thirdPlaces.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400 font-sports uppercase tracking-wider">
                  No hay datos disponibles.
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-wc-dark/30 text-[10px] uppercase font-sports tracking-wider text-slate-500 border-b border-wc-border/30">
                      <th className="px-1 py-1.5 text-center w-6">Pos</th>
                      <th className="px-1 py-1.5">Equipo</th>
                      <th className="px-1 py-1.5 text-center w-8" title="Partidos Jugados">PJ</th>
                      <th className="px-1 py-1.5 text-center w-8" title="Diferencia de Goles">DG</th>
                      <th className="px-1 py-1.5 text-center w-8 text-wc-gold" title="Puntos">PTS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {thirdPlaces.slice(0, 8).map((team, idx) => {
                      const flagUrl = getTeamFlagUrl(team.team);
                      const isQualifier = idx < 8; // Los 8 mejores terceros clasifican
                      
                      return (
                        <tr key={team.team} className="border-b border-wc-border/10 hover:bg-white/5 transition-colors text-xs">
                          <td className="px-1 py-1 text-center">
                            <span className={`font-sports font-bold ${isQualifier ? 'text-wc-green' : 'text-wc-red'}`}>
                              {idx + 1}
                            </span>
                          </td>
                          <td className="px-1 py-1 font-bold text-slate-200">
                            <div className="flex items-center gap-1.5 min-w-0">
                              {flagUrl ? (
                                <img src={flagUrl} alt="" className="w-4 h-3 object-cover rounded-[1px] shadow-sm flex-shrink-0" />
                              ) : (
                                <div className="w-4 h-3 bg-slate-700 rounded-[1px] flex-shrink-0"></div>
                              )}
                              <span className="truncate max-w-[85px]">{team.team}</span>
                              <span className="text-[9px] text-slate-450 font-normal shrink-0">({team.group.split(' ')[1] || team.group})</span>
                            </div>
                          </td>
                          <td className="px-1 py-1 text-center text-slate-350 font-medium">{team.pj}</td>
                          <td className="px-1 py-1 text-center font-medium text-slate-350">
                            {team.dg > 0 ? `+${team.dg}` : team.dg}
                          </td>
                          <td className="px-1 py-1 text-center font-bold text-wc-gold">{team.pts}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer Navigation Dots & Button */}
      <div className="pt-2 border-t border-wc-border/30 space-y-2.5">
        {/* Carousel indicator dots */}
        <div className="flex items-center justify-center gap-1.5">
          {[0, 1, 2, 3].map(slideIdx => (
            <button
              key={slideIdx}
              onClick={() => setCurrentSlide(slideIdx)}
              className={`h-1.5 rounded-full transition-all duration-350 ${
                currentSlide === slideIdx 
                  ? 'w-4 bg-wc-gold' 
                  : 'w-1.5 bg-slate-600 hover:bg-slate-500'
              }`}
              aria-label={`Ir al slide ${slideIdx + 1}`}
            />
          ))}
        </div>
        
        {/* Navigation advice and button */}
        <div className="flex flex-col gap-1.5">
          <p className="text-[10px] text-slate-450 text-center leading-normal">
            Puedes ver más estadísticas en este botón (goleadores, todos los grupos, calendario completo).
          </p>
          <a
            href="/mundial"
            className="w-full py-2 text-center bg-wc-dark hover:bg-slate-800 text-slate-200 hover:text-white rounded-xl text-xs font-bold font-sports tracking-wider uppercase border border-wc-border hover:border-wc-gold/40 transition-all flex items-center justify-center gap-1.5"
          >
            Ver Estadísticas
          </a>
        </div>
      </div>
    </div>
  );
}
