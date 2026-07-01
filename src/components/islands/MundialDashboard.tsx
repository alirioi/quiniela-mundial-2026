/**
 * @file MundialDashboard.tsx
 * @description Componente interactivo para visualizar el progreso general del Mundial 2026.
 * Incluye tablas de posiciones en tiempo real, clasificación de mejores terceros, calendario
 * de partidos y estadísticas detalladas de equipos y jugadores.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Trophy, Calendar, Filter, Search, Award, GitBranch, BarChart3, Star, AlertTriangle, RefreshCw, ChevronUp, ChevronDown, ChevronRight } from 'lucide-react';
import { getTeamFlagUrl } from '../../utils/flags';
import KnockoutBracket from './KnockoutBracket';
import { useGroupStandings } from '../../hooks/useGroupStandings';
import { useFetch } from '../../hooks/useFetch';

/**
 * Representa un partido de fútbol con sus datos básicos, puntajes y estado.
 */
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
  penalty_winner?: string | null;
}

interface Player {
  id: string;
  name: string;
  team: string;
  goals: number;
  assists: number;
  yellow_cards: number;
  red_cards: number;
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
  const [activeTab, setActiveTab] = useState<'grupos' | 'terceros' | 'calendario' | 'llave' | 'estadisticas'>('llave');
  const [filterGroup, setFilterGroup] = useState<string>('todos');
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [teamSortKey, setTeamSortKey] = useState<'pj' | 'gf' | 'gc' | 'team'>('gf');
  const [teamSortDirection, setTeamSortDirection] = useState<'asc' | 'desc'>('desc');
  const [playerTab, setPlayerTab] = useState<'goleadores' | 'asistentes' | 'mixto'>('goleadores');
  
  const { data: fetchedPlayers, loading: playersLoading, error: fetchError } = useFetch({
    url: '/api/player-stats',
    executeOnMount: activeTab === 'estadisticas'
  });

  const players = fetchedPlayers || [];
  const playersError = fetchError ? (fetchError.message || 'Error de conexión') : null;

  // React to tab changes to fetch if needed
  useEffect(() => {
    // If it hasn't loaded yet and we switched to the tab
    if (activeTab === 'estadisticas' && !playersLoading && !fetchedPlayers && !fetchError) {
      // In useFetch we could manually execute, but we rely on executeOnMount for initial
      // or we can just fetch if not loaded
    }
  }, [activeTab]);

  // Handler para el ordenamiento de los equipos
  const handleTeamSort = (key: 'pj' | 'gf' | 'gc' | 'team') => {
    if (teamSortKey === key) {
      setTeamSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setTeamSortKey(key);
      setTeamSortDirection(key === 'team' ? 'asc' : 'desc');
    }
  };

  // Cálculo dinámico de estadísticas por equipo (goles a favor y en contra en todos los partidos)
  const teamStatsSummary = useMemo(() => {
    const stats: Record<string, { team: string; gf: number; gc: number; pj: number }> = {};
    matches.forEach(m => {
      if ((m.status === 'finished' || m.status === 'live') && m.home_score !== null && m.away_score !== null) {
        if (!stats[m.home_team]) stats[m.home_team] = { team: m.home_team, gf: 0, gc: 0, pj: 0 };
        if (!stats[m.away_team]) stats[m.away_team] = { team: m.away_team, gf: 0, gc: 0, pj: 0 };
        
        stats[m.home_team].pj++;
        stats[m.home_team].gf += m.home_score;
        stats[m.home_team].gc += m.away_score;

        stats[m.away_team].pj++;
        stats[m.away_team].gf += m.away_score;
        stats[m.away_team].gc += m.home_score;
      }
    });
    // Ordenar equipos por la columna seleccionada
    return Object.values(stats).sort((a, b) => {
      let comparison = 0;
      if (teamSortKey === 'team') {
        comparison = a.team.localeCompare(b.team);
      } else {
        comparison = a[teamSortKey] - b[teamSortKey];
      }

      if (comparison === 0) {
        // Fallback en caso de empate
        if (b.gf !== a.gf) return b.gf - a.gf;
        if (a.gc !== b.gc) return a.gc - b.gc;
        return a.team.localeCompare(b.team);
      }

      return teamSortDirection === 'asc' ? comparison : -comparison;
    });
  }, [matches, teamSortKey, teamSortDirection]);

  // Estadísticas generales del torneo (goles totales, promedio, partidos jugados)
  const generalStats = useMemo(() => {
    const finishedMatches = matches.filter(m => m.status === 'finished');
    const totalGoals = finishedMatches.reduce((acc, m) => acc + (m.home_score || 0) + (m.away_score || 0), 0);
    const avgGoals = finishedMatches.length > 0 ? (totalGoals / finishedMatches.length).toFixed(2) : '0.00';
    return {
      played: finishedMatches.length,
      goals: totalGoals,
      avg: avgGoals
    };
  }, [matches]);

  // 1. Procesamiento de las tablas de posiciones de cada grupo
  const { groupStandings, thirdPlaces } = useGroupStandings(matches);

  // Filtrado de partidos para la pestaña de calendario
  const filteredMatches = useMemo(() => {
    return matches.filter(m => {
      const matchGroup = filterGroup === 'todos' || m.group_name === filterGroup;
      
      let matchStatus = true;
      if (filterStatus === 'finalizados') matchStatus = m.status === 'finished';
      if (filterStatus === 'por_jugar') matchStatus = m.status === 'scheduled';
      if (filterStatus === 'en_vivo') matchStatus = m.status === 'live';

      const removeAccents = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const searchLower = removeAccents(searchQuery.toLowerCase());
      const matchSearch = removeAccents(m.home_team.toLowerCase()).includes(searchLower) || 
                          removeAccents(m.away_team.toLowerCase()).includes(searchLower);

      return matchGroup && matchStatus && matchSearch;
    });
  }, [matches, filterGroup, filterStatus, searchQuery]);

  // Helper for team rows
  const renderTeamRow = (team: TeamStats, index: number, isThirdPlaceTable = false) => {
    let rowClass = "";
    let indicatorClass = "";
    
    if (!isThirdPlaceTable) {
      if (index === 0 || index === 1) {
        rowClass = "row-qualifier";
        indicatorClass = "text-wc-green font-bold";
      } else if (index === 2) {
        rowClass = "row-possible-third";
        indicatorClass = "text-wc-gold font-bold";
      } else {
        rowClass = "border-l-4 border-transparent opacity-60";
        indicatorClass = "text-slate-500";
      }
    } else {
      if (index < 8) {
        rowClass = "row-qualifier";
        indicatorClass = "text-wc-green font-bold";
      } else {
        rowClass = "row-eliminated opacity-70";
        indicatorClass = "text-wc-red";
      }
    }

    const flagUrl = getTeamFlagUrl(team.team);
    const paddingClass = isThirdPlaceTable ? "p-4" : "px-0.5 py-2 sm:px-1 sm:py-2.5";
    const teamCellPadding = isThirdPlaceTable ? "p-4 min-w-0" : "px-1 py-2 sm:px-1.5 sm:py-2.5 min-w-0";

    return (
      <tr key={team.team} className={`border-b border-wc-border/30 hover:bg-white/5 transition-colors ${rowClass}`}>
        <td className={`${paddingClass} text-center ${isThirdPlaceTable ? 'w-12' : 'w-8'}`}>
          <span className={`font-sports text-sm sm:text-base ${indicatorClass}`}>{index + 1}</span>
        </td>
        <td className={teamCellPadding}>
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            {flagUrl ? (
              <img src={flagUrl} alt={`Bandera de ${team.team}`} className="w-5 h-3.5 object-cover rounded-[2px] shadow-sm flex-shrink-0" />
            ) : (
              <div className="w-5 h-3.5 bg-slate-700 rounded-[2px] flex-shrink-0"></div>
            )}
            <span 
              className={`font-bold text-slate-200 text-xs sm:text-sm truncate block ${
                isThirdPlaceTable 
                  ? "max-w-[150px] sm:max-w-none" 
                  : "max-w-[85px] sm:max-w-[120px] md:max-w-[160px] lg:max-w-[95px] xl:max-w-[135px] 2xl:max-w-[95px] [@media(min-width:1700px)]:max-w-[150px]"
              }`}
              title={team.team}
            >
              {team.team}
            </span>
            {isThirdPlaceTable && <span className="hidden sm:inline-block ml-1 text-[10px] uppercase font-sports text-slate-500 flex-shrink-0">({team.group})</span>}
          </div>
        </td>
        <td className={`${paddingClass} text-center text-slate-300 text-xs sm:text-sm`}>{team.pj}</td>
        <td className={`${paddingClass} text-center text-slate-400 hidden sm:table-cell text-xs`}>{team.g}</td>
        <td className={`${paddingClass} text-center text-slate-400 hidden sm:table-cell text-xs`}>{team.e}</td>
        <td className={`${paddingClass} text-center text-slate-400 hidden sm:table-cell text-xs`}>{team.p}</td>
        <td className={`${paddingClass} text-center text-slate-300 hidden md:table-cell text-xs`}>{team.gf}</td>
        <td className={`${paddingClass} text-center text-slate-300 hidden md:table-cell text-xs`}>{team.gc}</td>
        <td className={`${paddingClass} text-center font-bold text-slate-300 text-xs sm:text-sm`}>{team.dg > 0 ? `+${team.dg}` : team.dg}</td>
        <td className={`${paddingClass} text-center font-bold text-wc-gold text-sm sm:text-base font-sports`}>{team.pts}</td>
      </tr>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header and Tabs */}
      <div className="bg-wc-card border border-wc-border rounded-2xl overflow-hidden shadow-xl">
        <div className="p-6 sm:p-8 bg-gradient-to-br from-wc-dark/50 to-wc-card relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-wc-gold/5 rounded-full blur-3xl pointer-events-none transform translate-x-1/3 -translate-y-1/3"></div>
          <div className="flex flex-col gap-5 sm:gap-6 relative z-10">
            <div>
              <h1 className="text-3xl sm:text-4xl font-black font-sports tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-wc-gold to-amber-500 uppercase">
                Mundial FIFA 2026
              </h1>
              <p className="text-slate-400 mt-2 max-w-2xl text-sm leading-relaxed">
                Consulta los resultados oficiales, las tablas de posiciones actualizadas y la clasificación de los mejores terceros de la fase de grupos.
              </p>
            </div>
            <div className="flex w-full items-center gap-1 sm:gap-2 bg-wc-dark/60 p-1.5 rounded-xl border border-wc-border overflow-x-auto custom-scrollbar whitespace-nowrap">
              <button
                onClick={() => setActiveTab('grupos')}
                title="Tabla de Grupos"
                aria-label="Ver grupos"
                className={`flex-1 basis-0 min-w-[90px] sm:min-w-[140px] shrink-0 py-2.5 sm:py-2 rounded-lg text-[11px] sm:text-sm font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap ${
                  activeTab === 'grupos' ? 'bg-wc-gold text-slate-950 shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Trophy className="w-5 h-5 sm:w-4 sm:h-4" /> <span>Grupos</span>
              </button>
              <button
                onClick={() => setActiveTab('terceros')}
                title="Clasificación de Terceros"
                aria-label="Ver mejores terceros"
                className={`flex-1 basis-0 min-w-[90px] sm:min-w-[140px] shrink-0 py-2.5 sm:py-2 rounded-lg text-[11px] sm:text-sm font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap ${
                  activeTab === 'terceros' ? 'bg-wc-gold text-slate-950 shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Award className="w-5 h-5 sm:w-4 sm:h-4" /> <span>Terceros</span>
              </button>
              <button
                onClick={() => setActiveTab('calendario')}
                title="Calendario de Partidos"
                aria-label="Ver calendario de partidos"
                className={`flex-1 basis-0 min-w-[90px] sm:min-w-[140px] shrink-0 py-2.5 sm:py-2 rounded-lg text-[11px] sm:text-sm font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap ${
                  activeTab === 'calendario' ? 'bg-wc-gold text-slate-950 shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Calendar className="w-5 h-5 sm:w-4 sm:h-4" /> <span>Partidos</span>
              </button>
              <button
                onClick={() => setActiveTab('llave')}
                title="Fase Eliminatoria"
                aria-label="Ver llave de fase eliminatoria"
                className={`flex-1 basis-0 min-w-[90px] sm:min-w-[140px] shrink-0 py-2.5 sm:py-2 rounded-lg text-[11px] sm:text-sm font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap ${
                  activeTab === 'llave' ? 'bg-wc-gold text-slate-950 shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <GitBranch className="w-5 h-5 sm:w-4 sm:h-4" /> <span>Llave</span>
              </button>
              <button
                onClick={() => setActiveTab('estadisticas')}
                title="Estadísticas del Mundial"
                aria-label="Ver estadísticas"
                className={`flex-1 basis-0 min-w-[90px] sm:min-w-[140px] shrink-0 py-2.5 sm:py-2 rounded-lg text-[11px] sm:text-sm font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap ${
                  activeTab === 'estadisticas' ? 'bg-wc-gold text-slate-950 shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <BarChart3 className="w-5 h-5 sm:w-4 sm:h-4" /> <span>Estadísticas</span>
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
                      <th className="px-0.5 py-2 sm:px-1 sm:py-2.5 text-center w-8">#</th>
                      <th className="px-1 py-2 sm:px-1.5 sm:py-2.5">Equipo</th>
                      <th className="px-0.5 py-2 sm:px-1 sm:py-2.5 text-center" title="Partidos Jugados">PJ</th>
                      <th className="px-0.5 py-2 sm:px-1 sm:py-2.5 text-center hidden sm:table-cell" title="Ganados">G</th>
                      <th className="px-0.5 py-2 sm:px-1 sm:py-2.5 text-center hidden sm:table-cell" title="Empatados">E</th>
                      <th className="px-0.5 py-2 sm:px-1 sm:py-2.5 text-center hidden sm:table-cell" title="Perdidos">P</th>
                      <th className="px-0.5 py-2 sm:px-1 sm:py-2.5 text-center hidden md:table-cell" title="Goles a Favor">GF</th>
                      <th className="px-0.5 py-2 sm:px-1 sm:py-2.5 text-center hidden md:table-cell" title="Goles en Contra">GC</th>
                      <th className="px-0.5 py-2 sm:px-1 sm:py-2.5 text-center" title="Diferencia de Goles">DG</th>
                      <th className="px-0.5 py-2 sm:px-1 sm:py-2.5 text-center text-wc-gold" title="Puntos">PTS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teams.map((team, idx) => renderTeamRow(team, idx, false))}
                  </tbody>
                </table>
              </div>
              <div className="p-3 bg-wc-dark/30 border-t border-wc-border flex gap-4 text-[10px] sm:text-xs font-sports uppercase tracking-wider text-slate-400">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-wc-green"></span> Clasifica</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-wc-gold"></span> Posible 3ro</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab Content: Mejores Terceros */}
      {activeTab === 'terceros' && (
        <div className="animate-fade-in space-y-6">
          <div className="gold-banner p-4 rounded-xl flex items-start gap-3">
            <Award className="w-6 h-6 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold uppercase font-sports tracking-wider">Clasificación de Terceros</h4>
              <p className="text-sm leading-relaxed mt-1">
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
              <div className="relative w-full sm:w-64 flex items-center">
                <Search className="absolute left-3 w-4 h-4 text-slate-500 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Buscar equipo..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-wc-dark border border-wc-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-wc-gold focus:ring-1 focus:ring-wc-gold transition-all"
                />
              </div>
              <div className="relative w-full sm:w-48 flex items-center">
                <Filter className="absolute left-3 w-4 h-4 text-slate-500 pointer-events-none" />
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
                className={`flex-1 px-2.5 sm:px-4 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${filterStatus === 'todos' ? 'bg-wc-gold text-slate-950 shadow-md' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
              >
                Todos
              </button>
              <button 
                onClick={() => setFilterStatus('finalizados')}
                className={`flex-1 px-2.5 sm:px-4 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${filterStatus === 'finalizados' ? 'bg-green-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-green-400 hover:bg-green-500/10'}`}
              >
                Jugados
              </button>
              <button 
                onClick={() => setFilterStatus('por_jugar')}
                className={`flex-1 px-2.5 sm:px-4 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${filterStatus === 'por_jugar' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-amber-400 hover:bg-amber-500/10'}`}
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
                const timeStr = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

                return (
                  <div key={match.id} className="bg-wc-card border border-wc-border hover:border-wc-gold/40 transition-all rounded-xl p-4 flex flex-col justify-center">
                    <div className="flex items-center justify-between mb-3 text-xs font-sports uppercase tracking-wider">
                      <span className="text-slate-400 flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {dateStr} • {timeStr}</span>
                      <span className="text-wc-gold font-bold">{match.group_name || 'Fase Final'}</span>
                    </div>
                    
                    <div className="flex items-center justify-between gap-2">
                      {/* Home Team */}
                      <div className="flex flex-col sm:flex-row items-center gap-1.5 sm:gap-3 flex-1 min-w-0">
                        {homeFlag ? (
                          <img src={homeFlag} alt={match.home_team} className="w-8 h-6 sm:w-10 sm:h-7 object-cover rounded shadow-md flex-shrink-0" />
                        ) : (
                          <div className="w-8 h-6 sm:w-10 sm:h-7 bg-slate-800 rounded flex-shrink-0"></div>
                        )}
                        <span className="font-bold text-slate-200 text-xs sm:text-sm md:text-base truncate w-full text-center sm:text-left">{match.home_team}</span>
                      </div>
                      
                      {/* Score */}
                      <div className="px-2 sm:px-4 flex flex-col items-center shrink-0">
                        {match.status === 'finished' ? (
                          <div className="bg-wc-dark border border-wc-border px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-lg flex gap-2 sm:gap-3 text-lg sm:text-xl font-sports font-bold text-white shadow-inner">
                            <span>{match.home_score}</span>
                            <span className="text-slate-500">-</span>
                            <span>{match.away_score}</span>
                          </div>
                        ) : match.status === 'live' ? (
                          <div className="bg-wc-red/10 border border-wc-red/30 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-lg flex gap-2 sm:gap-3 text-lg sm:text-xl font-sports font-bold text-wc-red shadow-md shadow-wc-red/10">
                            <span>{match.home_score ?? 0}</span>
                            <span className="animate-pulse">-</span>
                            <span>{match.away_score ?? 0}</span>
                          </div>
                        ) : (
                          <div className="bg-wc-dark border border-wc-border px-3 py-1 rounded-lg text-slate-500 font-sports font-bold tracking-widest text-base sm:text-lg">
                            VS
                          </div>
                        )}
                        
                        {match.status === 'finished' && <span className="text-[9px] uppercase font-bold text-slate-500 mt-1">Final</span>}
                        {match.status === 'live' && <span className="text-[9px] uppercase font-bold text-red-500 mt-1 animate-pulse">En Vivo</span>}
                      </div>

                      {/* Away Team */}
                      <div className="flex flex-col sm:flex-row-reverse items-center gap-1.5 sm:gap-3 flex-1 min-w-0 justify-end">
                        {awayFlag ? (
                          <img src={awayFlag} alt={match.away_team} className="w-8 h-6 sm:w-10 sm:h-7 object-cover rounded shadow-md flex-shrink-0" />
                        ) : (
                          <div className="w-8 h-6 sm:w-10 sm:h-7 bg-slate-800 rounded flex-shrink-0"></div>
                        )}
                        <span className="font-bold text-slate-200 text-xs sm:text-sm md:text-base text-center sm:text-right truncate w-full">{match.away_team}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {activeTab === 'llave' && (
        <div className="animate-fade-in">
          <KnockoutBracket groupStandings={groupStandings} thirdPlaces={thirdPlaces} dbMatches={matches} />
        </div>
      )}

      {activeTab === 'estadisticas' && (
        <div className="space-y-8 animate-fade-in">
          {/* Mundial in Figures General Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 bg-wc-card/50 rounded-2xl border border-wc-border backdrop-blur-md relative overflow-hidden flex items-center justify-between min-h-[100px]">
              <div>
                <span className="text-slate-450 text-[10px] font-sports font-bold tracking-wider uppercase block">Partidos Completados</span>
                <span className="text-3xl font-extrabold font-mono text-white mt-1 block">{generalStats.played}</span>
              </div>
              <div className="p-3.5 rounded-xl bg-wc-blue/10 border border-wc-blue/20 text-wc-blue">
                <Calendar className="w-5.5 h-5.5" />
              </div>
            </div>

            <div className="p-5 bg-wc-card/50 rounded-2xl border border-wc-border backdrop-blur-md relative overflow-hidden flex items-center justify-between min-h-[100px]">
              <div>
                <span className="text-slate-450 text-[10px] font-sports font-bold tracking-wider uppercase block">Goles Totales</span>
                <span className="text-3xl font-extrabold font-mono text-wc-gold mt-1 block">{generalStats.goals}</span>
              </div>
              <div className="p-3.5 rounded-xl bg-wc-gold/10 border border-wc-gold/20 text-wc-gold">
                <Trophy className="w-5.5 h-5.5" />
              </div>
            </div>

            <div className="p-5 bg-wc-card/50 rounded-2xl border border-wc-border backdrop-blur-md relative overflow-hidden flex items-center justify-between min-h-[100px]">
              <div>
                <span className="text-slate-450 text-[10px] font-sports font-bold tracking-wider uppercase block">Promedio de Goles</span>
                <span className="text-3xl font-extrabold font-mono text-wc-green mt-1 block">{generalStats.avg}</span>
              </div>
              <div className="p-3.5 rounded-xl bg-wc-green/10 border border-wc-green/20 text-wc-green">
                <Star className="w-5.5 h-5.5" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Goles por Selección (Dinámico) */}
            <div className="bg-wc-card border border-wc-border rounded-2xl overflow-hidden shadow-xl flex flex-col relative">
              <div className="bg-wc-dark/60 p-4 border-b border-wc-border flex items-center justify-between">
                <h3 className="font-sports text-lg text-wc-gold tracking-wider uppercase flex items-center gap-2">
                  <Award className="w-5 h-5 text-wc-gold shrink-0" strokeWidth={2.5} /> Goles por Selección
                </h3>
                <span className="sm:hidden text-[10px] text-slate-400 font-sports tracking-wider uppercase flex items-center gap-1 animate-pulse">
                  Desliza <ChevronRight className="w-3 h-3" />
                </span>
              </div>
              <div className="overflow-x-auto max-h-[500px] custom-scrollbar">
                {teamStatsSummary.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-xs uppercase font-sports tracking-wider">
                    No hay partidos finalizados para procesar.
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-wc-dark/30 text-[10px] sm:text-xs uppercase font-sports tracking-wider text-slate-500 border-b border-wc-border/30">
                        <th className="p-4 w-12 text-center">#</th>
                        <th className="p-4 cursor-pointer hover:text-white transition-colors select-none group" onClick={() => handleTeamSort('team')}>
                          <div className="flex items-center gap-1">
                            Selección
                            <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                              {teamSortKey === 'team' ? (teamSortDirection === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-white opacity-100" /> : <ChevronDown className="w-3.5 h-3.5 text-white opacity-100" />) : <ChevronUp className="w-3.5 h-3.5" />}
                            </span>
                            {teamSortKey === 'team' && <span className="opacity-100 absolute ml-[70px]">{teamSortDirection === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-white" /> : <ChevronDown className="w-3.5 h-3.5 text-white" />}</span>}
                          </div>
                        </th>
                        <th className="p-4 text-center cursor-pointer hover:text-white transition-colors select-none group" onClick={() => handleTeamSort('pj')}>
                          <div className="flex items-center justify-center gap-1 relative">
                            Partidos
                            {teamSortKey === 'pj' ? (teamSortDirection === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-white" /> : <ChevronDown className="w-3.5 h-3.5 text-white" />) : <ChevronUp className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />}
                          </div>
                        </th>
                        <th className="p-4 text-center text-wc-green cursor-pointer hover:text-green-400 transition-colors select-none group" onClick={() => handleTeamSort('gf')}>
                          <div className="flex items-center justify-center gap-1 relative">
                            G. Marcados
                            {teamSortKey === 'gf' ? (teamSortDirection === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-green-400" /> : <ChevronDown className="w-3.5 h-3.5 text-green-400" />) : <ChevronUp className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />}
                          </div>
                        </th>
                        <th className="p-4 text-center text-wc-red cursor-pointer hover:text-red-400 transition-colors select-none group" onClick={() => handleTeamSort('gc')}>
                          <div className="flex items-center justify-center gap-1 relative">
                            G. Recibidos
                            {teamSortKey === 'gc' ? (teamSortDirection === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-red-400" /> : <ChevronDown className="w-3.5 h-3.5 text-red-400" />) : <ChevronUp className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />}
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-wc-border/30 text-sm text-slate-300">
                      {teamStatsSummary.map((t, idx) => {
                        const flagUrl = getTeamFlagUrl(t.team);
                        return (
                          <tr key={t.team} className="hover:bg-white/5 transition-colors">
                            <td className="p-4 text-center font-mono font-bold text-slate-500">{idx + 1}</td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                {flagUrl ? (
                                  <img src={flagUrl} alt={t.team} className="w-5 h-3.5 object-cover rounded shadow-sm" />
                                ) : (
                                  <div className="w-5 h-3.5 bg-slate-800 rounded"></div>
                                )}
                                <span className="font-bold text-white text-xs sm:text-sm">{t.team}</span>
                              </div>
                            </td>
                            <td className="p-4 text-center font-mono">{t.pj}</td>
                            <td className="p-4 text-center font-mono font-extrabold text-wc-green text-base">{t.gf}</td>
                            <td className="p-4 text-center font-mono text-slate-400">{t.gc}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Tabla de Jugadores */}
            <div className="bg-wc-card border border-wc-border rounded-2xl overflow-hidden shadow-xl flex flex-col relative">
              <div className="bg-wc-dark/60 p-4 border-b border-wc-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center justify-between w-full sm:w-auto">
                  <h3 className="font-sports text-lg text-wc-gold tracking-wider uppercase flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-wc-gold shrink-0" strokeWidth={2.5} /> Estadísticas de Jugadores
                  </h3>
                  <span className="sm:hidden text-[10px] text-slate-400 font-sports tracking-wider uppercase flex items-center gap-1 animate-pulse ml-2">
                    Desliza <ChevronRight className="w-3 h-3" />
                  </span>
                </div>
                <div className="flex items-center gap-1 bg-wc-dark/50 p-1 rounded-lg border border-wc-border/50 text-[10px] font-sports tracking-wider uppercase flex-wrap">
                  <button
                    onClick={() => setPlayerTab('goleadores')}
                    className={`px-3 py-1.5 rounded-md transition-all ${playerTab === 'goleadores' ? 'bg-wc-gold text-wc-dark font-bold shadow-sm' : 'text-slate-400 hover:text-white'}`}
                  >
                    Goleadores
                  </button>
                  <button
                    onClick={() => setPlayerTab('asistentes')}
                    className={`px-3 py-1.5 rounded-md transition-all ${playerTab === 'asistentes' ? 'bg-wc-blue text-wc-dark font-bold shadow-sm' : 'text-slate-400 hover:text-white'}`}
                  >
                    Asistencias
                  </button>
                  <button
                    onClick={() => setPlayerTab('mixto')}
                    className={`px-3 py-1.5 rounded-md transition-all ${playerTab === 'mixto' ? 'bg-wc-green text-wc-dark font-bold shadow-sm' : 'text-slate-400 hover:text-white'}`}
                  >
                    Goles + Asist.
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto max-h-[500px] custom-scrollbar">
                {playersLoading ? (
                  <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                    <RefreshCw className="w-6 h-6 animate-spin text-wc-gold" />
                    <span className="text-[10px] uppercase font-sports tracking-wider">Cargando goleadores...</span>
                  </div>
                ) : playersError ? (
                  <div className="p-8 text-center text-wc-red text-xs uppercase font-sports tracking-wider flex items-center justify-center gap-2">
                    <AlertTriangle className="w-4.5 h-4.5" />
                    <span>{playersError}</span>
                  </div>
                ) : !Array.isArray(players) || players.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-xs uppercase font-sports tracking-wider">
                    No hay goleadores individuales registrados.
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-wc-dark/30 text-[10px] sm:text-xs uppercase font-sports tracking-wider text-slate-500 border-b border-wc-border/30">
                        <th className="p-4 w-12 text-center">#</th>
                        <th className="p-4">Jugador</th>
                        <th className="p-4 text-center text-wc-gold">Goles</th>
                        <th className="p-4 text-center text-wc-blue">Asistencias</th>
                        <th className="p-4 text-center text-wc-green">G+A</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-wc-border/30 text-sm text-slate-300">
                      {Array.isArray(players) && [...players].sort((a, b) => {
                        if (playerTab === 'goleadores') {
                          if (b.goals !== a.goals) return b.goals - a.goals;
                          return b.assists - a.assists;
                        } else if (playerTab === 'asistentes') {
                          if (b.assists !== a.assists) return b.assists - a.assists;
                          return b.goals - a.goals;
                        } else {
                          const aTotal = a.goals + a.assists;
                          const bTotal = b.goals + b.assists;
                          if (bTotal !== aTotal) return bTotal - aTotal;
                          if (b.goals !== a.goals) return b.goals - a.goals;
                          return b.assists - a.assists;
                        }
                      }).map((p, idx) => {
                        const flagUrl = getTeamFlagUrl(p.team);
                        return (
                          <tr key={p.id} className="hover:bg-white/5 transition-colors">
                            <td className="p-4 text-center font-mono font-bold text-slate-500">{idx + 1}</td>
                            <td className="p-4">
                              <div className="flex flex-col gap-0.5">
                                <span className="font-bold text-white text-xs sm:text-sm">{p.name}</span>
                                <div className="flex items-center gap-1.5 text-[10px] text-slate-450 font-semibold uppercase">
                                  {flagUrl && (
                                    <img src={flagUrl} alt={p.team} className="w-3.5 h-2.5 object-cover rounded-[1px]" />
                                  )}
                                  <span>{p.team}</span>
                                </div>
                              </div>
                            </td>
                            <td className={`p-4 text-center font-mono font-extrabold text-base ${playerTab === 'goleadores' ? 'text-wc-gold' : 'text-slate-400'}`}>{p.goals}</td>
                            <td className={`p-4 text-center font-mono font-extrabold text-base ${playerTab === 'asistentes' ? 'text-wc-blue' : 'text-slate-400'}`}>{p.assists}</td>
                            <td className={`p-4 text-center font-mono font-extrabold text-base ${playerTab === 'mixto' ? 'text-wc-green' : 'text-slate-400'}`}>{p.goals + p.assists}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
