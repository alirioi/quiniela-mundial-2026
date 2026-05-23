import React, { useState, useMemo } from 'react';
import { Trophy, Calendar, Filter, Search, Award } from 'lucide-react';
import { getTeamFlagUrl } from '../../utils/flags';

export interface Match {
  id: number;
  phase_id: number;
  home_team: string;
  away_team: string;
  match_time: string;
  home_score: number | null;
  away_score: number | null;
  status: 'scheduled' | 'live' | 'finished';
  group_name: string | null;
  match_number: number;
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
  matches: Match[];
}

export default function MundialDashboard({ matches }: Props) {
  const [activeTab, setActiveTab] = useState<'grupos' | 'terceros' | 'calendario'>('grupos');
  const [filterGroup, setFilterGroup] = useState<string>('todos');
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Process group standings
  const { groupStandings, thirdPlaces } = useMemo(() => {
    const statsByGroup: Record<string, Record<string, TeamStats>> = {};

    // Initialize stats and process matches
    matches.forEach(match => {
      if (!match.group_name) return; // Only group stage matches
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

    const finalStandings: Record<string, TeamStats[]> = {};
    const allThirds: TeamStats[] = [];

    // Sort teams inside groups
    Object.keys(statsByGroup).sort().forEach(group => {
      const teams = Object.values(statsByGroup[group]);
      // Calculate DG just in case
      teams.forEach(t => t.dg = t.gf - t.gc);
      
      teams.sort((a, b) => {
        if (b.pts !== a.pts) return b.pts - a.pts;
        if (b.dg !== a.dg) return b.dg - a.dg;
        if (b.gf !== a.gf) return b.gf - a.gf;
        return a.team.localeCompare(b.team);
      });
      
      finalStandings[group] = teams;
      
      if (teams.length >= 3) {
        allThirds.push(teams[2]); // The 3rd placed team (index 2)
      }
    });

    // Sort third places
    allThirds.sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      if (b.dg !== a.dg) return b.dg - a.dg;
      if (b.gf !== a.gf) return b.gf - a.gf;
      if (b.g !== a.g) return b.g - a.g;
      return a.team.localeCompare(b.team);
    });

    return { groupStandings: finalStandings, thirdPlaces: allThirds };
  }, [matches]);

  // Calendar filtering
  const filteredMatches = useMemo(() => {
    return matches.filter(m => {
      const matchGroup = filterGroup === 'todos' || m.group_name === filterGroup;
      
      let matchStatus = true;
      if (filterStatus === 'finalizados') matchStatus = m.status === 'finished';
      if (filterStatus === 'por_jugar') matchStatus = m.status === 'scheduled';
      if (filterStatus === 'en_vivo') matchStatus = m.status === 'live';

      const searchLower = searchQuery.toLowerCase();
      const matchSearch = m.home_team.toLowerCase().includes(searchLower) || m.away_team.toLowerCase().includes(searchLower);

      return matchGroup && matchStatus && matchSearch;
    });
  }, [matches, filterGroup, filterStatus, searchQuery]);

  // Helper for team rows
  const renderTeamRow = (team: TeamStats, index: number, isThirdPlaceTable = false) => {
    let rowClass = "";
    let indicatorClass = "";
    
    if (!isThirdPlaceTable) {
      if (index === 0 || index === 1) {
        rowClass = "bg-green-500/5 border-l-4 border-green-500";
        indicatorClass = "text-green-500 font-bold";
      } else if (index === 2) {
        rowClass = "bg-amber-500/5 border-l-4 border-amber-500";
        indicatorClass = "text-amber-500 font-bold";
      } else {
        rowClass = "border-l-4 border-transparent opacity-60";
        indicatorClass = "text-slate-500";
      }
    } else {
      if (index < 8) {
        rowClass = "bg-green-500/5 border-l-4 border-green-500";
        indicatorClass = "text-green-500 font-bold";
      } else {
        rowClass = "bg-red-500/5 border-l-4 border-red-500 opacity-70";
        indicatorClass = "text-red-500";
      }
    }

    const flagUrl = getTeamFlagUrl(team.team);

    return (
      <tr key={team.team} className={`border-b border-wc-border/30 hover:bg-white/5 transition-colors ${rowClass}`}>
        <td className="p-2 sm:p-3 text-center w-8">
          <span className={`font-sports text-sm sm:text-base ${indicatorClass}`}>{index + 1}</span>
        </td>
        <td className="p-2 sm:p-3">
          <div className="flex items-center gap-2">
            {flagUrl ? (
              <img src={flagUrl} alt={`Bandera de ${team.team}`} className="w-5 h-3.5 object-cover rounded-[2px] shadow-sm" />
            ) : (
              <div className="w-5 h-3.5 bg-slate-700 rounded-[2px]"></div>
            )}
            <span className="font-bold text-slate-200 text-sm">{team.team}</span>
            {isThirdPlaceTable && <span className="hidden sm:inline-block ml-1 text-[10px] uppercase font-sports text-slate-500">({team.group})</span>}
          </div>
        </td>
        <td className="p-2 sm:p-3 text-center text-slate-300 text-xs sm:text-sm">{team.pj}</td>
        <td className="p-2 sm:p-3 text-center text-slate-400 hidden sm:table-cell text-xs">{team.g}</td>
        <td className="p-2 sm:p-3 text-center text-slate-400 hidden sm:table-cell text-xs">{team.e}</td>
        <td className="p-2 sm:p-3 text-center text-slate-400 hidden sm:table-cell text-xs">{team.p}</td>
        <td className="p-2 sm:p-3 text-center text-slate-300 hidden md:table-cell text-xs">{team.gf}</td>
        <td className="p-2 sm:p-3 text-center text-slate-300 hidden md:table-cell text-xs">{team.gc}</td>
        <td className="p-2 sm:p-3 text-center font-bold text-slate-300 text-xs sm:text-sm">{team.dg > 0 ? `+${team.dg}` : team.dg}</td>
        <td className="p-2 sm:p-3 text-center font-bold text-wc-gold text-sm sm:text-base font-sports">{team.pts}</td>
      </tr>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header and Tabs */}
      <div className="bg-wc-card border border-wc-border rounded-2xl overflow-hidden shadow-xl">
        <div className="p-6 sm:p-8 bg-gradient-to-br from-wc-dark/50 to-wc-card relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-wc-gold/5 rounded-full blur-3xl pointer-events-none transform translate-x-1/3 -translate-y-1/3"></div>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 relative z-10">
            <div>
              <h1 className="text-3xl sm:text-4xl font-black font-sports tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-wc-gold to-amber-500 uppercase">
                Mundial FIFA 2026
              </h1>
              <p className="text-slate-400 mt-2 max-w-2xl text-sm leading-relaxed">
                Consulta los resultados oficiales, las tablas de posiciones actualizadas y la clasificación de los mejores terceros de la fase de grupos.
              </p>
            </div>
            <div className="flex items-center gap-2 bg-wc-dark/60 p-1.5 rounded-xl border border-wc-border">
              <button
                onClick={() => setActiveTab('grupos')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
                  activeTab === 'grupos' ? 'bg-wc-gold text-slate-950 shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Trophy className="w-4 h-4" /> <span className="hidden sm:inline">Grupos</span>
              </button>
              <button
                onClick={() => setActiveTab('terceros')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
                  activeTab === 'terceros' ? 'bg-wc-gold text-slate-950 shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Award className="w-4 h-4" /> <span className="hidden sm:inline">Terceros</span>
              </button>
              <button
                onClick={() => setActiveTab('calendario')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
                  activeTab === 'calendario' ? 'bg-wc-gold text-slate-950 shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Calendar className="w-4 h-4" /> <span className="hidden sm:inline">Partidos</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Content: Grupos */}
      {activeTab === 'grupos' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-6 animate-fade-in">
          {Object.entries(groupStandings).map(([groupName, teams]) => (
            <div key={groupName} className="bg-wc-card border border-wc-border rounded-2xl overflow-hidden shadow-lg flex flex-col">
              <div className="bg-wc-dark/60 p-4 border-b border-wc-border flex items-center justify-between">
                <h3 className="font-sports text-xl text-wc-gold tracking-wider uppercase">{groupName}</h3>
              </div>
              <div className="overflow-x-auto flex-grow">
                <table className="w-full text-left border-collapse min-w-full">
                  <thead>
                    <tr className="bg-wc-dark/30 text-[10px] sm:text-xs uppercase font-sports tracking-wider text-slate-500">
                      <th className="p-2 sm:p-3 text-center w-8">#</th>
                      <th className="p-2 sm:p-3">Equipo</th>
                      <th className="p-2 sm:p-3 text-center" title="Partidos Jugados">PJ</th>
                      <th className="p-2 sm:p-3 text-center hidden sm:table-cell" title="Ganados">G</th>
                      <th className="p-2 sm:p-3 text-center hidden sm:table-cell" title="Empatados">E</th>
                      <th className="p-2 sm:p-3 text-center hidden sm:table-cell" title="Perdidos">P</th>
                      <th className="p-2 sm:p-3 text-center hidden md:table-cell" title="Goles a Favor">GF</th>
                      <th className="p-2 sm:p-3 text-center hidden md:table-cell" title="Goles en Contra">GC</th>
                      <th className="p-2 sm:p-3 text-center" title="Diferencia de Goles">DG</th>
                      <th className="p-2 sm:p-3 text-center text-wc-gold" title="Puntos">PTS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teams.map((team, idx) => renderTeamRow(team, idx, false))}
                  </tbody>
                </table>
              </div>
              <div className="p-3 bg-wc-dark/30 border-t border-wc-border flex gap-4 text-[10px] sm:text-xs font-sports uppercase tracking-wider text-slate-400">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> Clasifica</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"></span> Posible 3ro</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab Content: Mejores Terceros */}
      {activeTab === 'terceros' && (
        <div className="animate-fade-in space-y-6">
          <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl flex items-start gap-3">
            <Award className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-amber-500 font-bold uppercase font-sports tracking-wider">Clasificación de Terceros</h4>
              <p className="text-sm text-amber-500/80 leading-relaxed mt-1">
                En la Copa del Mundo 2026 de 48 equipos, los primeros 2 equipos de cada grupo y los <strong>8 mejores terceros</strong> avanzan a los Dieciseisavos de Final.
              </p>
            </div>
          </div>
          
          <div className="bg-wc-card border border-wc-border rounded-2xl overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-full">
                <thead>
                  <tr className="bg-wc-dark text-xs uppercase font-sports tracking-wider text-slate-400">
                    <th className="p-4 text-center w-12">Pos</th>
                    <th className="p-4">Selección (Grupo)</th>
                    <th className="p-4 text-center" title="Partidos Jugados">PJ</th>
                    <th className="p-4 text-center hidden sm:table-cell" title="Ganados">G</th>
                    <th className="p-4 text-center hidden sm:table-cell" title="Empatados">E</th>
                    <th className="p-4 text-center hidden sm:table-cell" title="Perdidos">P</th>
                    <th className="p-4 text-center hidden md:table-cell" title="Goles a Favor">GF</th>
                    <th className="p-4 text-center hidden md:table-cell" title="Goles en Contra">GC</th>
                    <th className="p-4 text-center" title="Diferencia de Goles">DG</th>
                    <th className="p-4 text-center text-wc-gold" title="Puntos">PTS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-wc-border/30">
                  {thirdPlaces.map((team, idx) => renderTeamRow(team, idx, true))}
                  {thirdPlaces.length === 0 && (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-slate-400 text-sm">No hay datos de grupos disponibles.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content: Calendario */}
      {activeTab === 'calendario' && (
        <div className="animate-fade-in space-y-6">
          <div className="bg-wc-card border border-wc-border rounded-2xl p-4 sm:p-6 shadow-lg flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex w-full md:w-auto flex-col sm:flex-row gap-4 flex-grow">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Buscar equipo..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-wc-dark border border-wc-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-wc-gold focus:ring-1 focus:ring-wc-gold transition-all"
                />
              </div>
              <div className="relative w-full sm:w-48">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-500" />
                <select
                  value={filterGroup}
                  onChange={(e) => setFilterGroup(e.target.value)}
                  className="w-full bg-wc-dark border border-wc-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-wc-gold appearance-none cursor-pointer"
                >
                  <option value="todos">Todos los Grupos</option>
                  {Object.keys(groupStandings).sort().map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="flex bg-wc-dark border border-wc-border rounded-xl p-1 w-full md:w-auto">
              <button 
                onClick={() => setFilterStatus('todos')}
                className={`flex-1 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${filterStatus === 'todos' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                Todos
              </button>
              <button 
                onClick={() => setFilterStatus('finalizados')}
                className={`flex-1 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${filterStatus === 'finalizados' ? 'bg-green-600/30 text-green-400' : 'text-slate-400 hover:text-green-400'}`}
              >
                Jugados
              </button>
              <button 
                onClick={() => setFilterStatus('por_jugar')}
                className={`flex-1 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${filterStatus === 'por_jugar' ? 'bg-amber-600/30 text-amber-400' : 'text-slate-400 hover:text-amber-400'}`}
              >
                Por Jugar
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredMatches.length === 0 ? (
              <div className="col-span-full p-12 text-center text-slate-500 bg-wc-card border border-wc-border rounded-2xl">
                <Calendar className="w-8 h-8 mx-auto mb-3 opacity-50" />
                <p>No se encontraron partidos con los filtros seleccionados.</p>
              </div>
            ) : (
              filteredMatches.map(match => {
                const homeFlag = getTeamFlagUrl(match.home_team);
                const awayFlag = getTeamFlagUrl(match.away_team);
                const dateObj = new Date(match.match_time);
                const dateStr = dateObj.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase();
                const timeStr = dateObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

                return (
                  <div key={match.id} className="bg-wc-card border border-wc-border hover:border-wc-gold/40 transition-all rounded-xl p-4 flex flex-col justify-center">
                    <div className="flex items-center justify-between mb-3 text-xs font-sports uppercase tracking-wider">
                      <span className="text-slate-400 flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {dateStr} • {timeStr}</span>
                      <span className="text-wc-gold font-bold">{match.group_name || 'Fase Final'}</span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      {/* Home Team */}
                      <div className="flex items-center gap-3 flex-1">
                        {homeFlag ? (
                          <img src={homeFlag} alt={match.home_team} className="w-8 h-6 sm:w-10 sm:h-7 object-cover rounded shadow-md" />
                        ) : (
                          <div className="w-8 h-6 sm:w-10 sm:h-7 bg-slate-800 rounded"></div>
                        )}
                        <span className="font-bold text-slate-200 text-sm sm:text-base">{match.home_team}</span>
                      </div>
                      
                      {/* Score */}
                      <div className="px-4 flex flex-col items-center">
                        {match.status === 'finished' ? (
                          <div className="bg-wc-dark border border-wc-border px-3 py-1.5 rounded-lg flex gap-3 text-xl font-sports font-bold text-white shadow-inner">
                            <span>{match.home_score}</span>
                            <span className="text-slate-500">-</span>
                            <span>{match.away_score}</span>
                          </div>
                        ) : match.status === 'live' ? (
                          <div className="bg-red-950/40 border border-red-500/30 px-3 py-1.5 rounded-lg flex gap-3 text-xl font-sports font-bold text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                            <span>{match.home_score ?? 0}</span>
                            <span className="animate-pulse">-</span>
                            <span>{match.away_score ?? 0}</span>
                          </div>
                        ) : (
                          <div className="bg-wc-dark border border-wc-border px-3 py-1 rounded-lg text-slate-500 font-sports font-bold tracking-widest text-lg">
                            VS
                          </div>
                        )}
                        
                        {match.status === 'finished' && <span className="text-[9px] uppercase font-bold text-slate-500 mt-1">Final</span>}
                        {match.status === 'live' && <span className="text-[9px] uppercase font-bold text-red-500 mt-1 animate-pulse">En Vivo</span>}
                      </div>

                      {/* Away Team */}
                      <div className="flex items-center gap-3 flex-1 justify-end">
                        <span className="font-bold text-slate-200 text-sm sm:text-base text-right">{match.away_team}</span>
                        {awayFlag ? (
                          <img src={awayFlag} alt={match.away_team} className="w-8 h-6 sm:w-10 sm:h-7 object-cover rounded shadow-md" />
                        ) : (
                          <div className="w-8 h-6 sm:w-10 sm:h-7 bg-slate-800 rounded"></div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
