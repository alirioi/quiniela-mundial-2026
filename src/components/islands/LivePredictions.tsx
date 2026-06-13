import React, { useState, useEffect } from 'react';
import { getTeamFlagUrl } from '../../utils/flags';
import { RefreshCw, Search, Award, Activity, Users, CheckCircle, HelpCircle, XCircle, Lock } from 'lucide-react';

interface Prediction {
  entry_id: string;
  display_name: string;
  entry_number: number;
  predicted_home: number | null;
  predicted_away: number | null;
  points_earned: number;
  has_prediction: boolean;
  is_own: boolean;
}

interface Match {
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

interface Tendencies {
  home_win_percent: number;
  draw_percent: number;
  away_win_percent: number;
  total_predictions: number;
}

export default function LivePredictions() {
  const [match, setMatch] = useState<Match | null>(null);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [tendencies, setTendencies] = useState<Tendencies | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Simulation score states
  const [simHome, setSimHome] = useState<string>('');
  const [simAway, setSimAway] = useState<string>('');
  
  // Filter/sort states
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'points' | 'name'>('points');

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/matches/live-predictions');
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Error (${response.status}) al obtener los pronósticos`);
      }
      const data = await response.json();
      setMatch(data.match);
      setPredictions(data.predictions);
      setTendencies(data.tendencies || null);
      
      if (data.match) {
        setSimHome(data.match.home_score !== null ? String(data.match.home_score) : '0');
        setSimAway(data.match.away_score !== null ? String(data.match.away_score) : '0');
      }
    } catch (err: any) {
      setError(err.message || 'Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSimScoreChange = (field: 'home' | 'away', val: string) => {
    if (val !== '' && !/^\d+$/.test(val)) return;
    if (field === 'home') setSimHome(val);
    else setSimAway(val);
  };

  // Point calculation matching trigger logic
  const calculateSimPoints = (predHome: number | null, predAway: number | null) => {
    if (predHome === null || predAway === null) {
      return { points: 0, type: 'none' as const };
    }
    const homeVal = simHome === '' ? 0 : parseInt(simHome, 10);
    const awayVal = simAway === '' ? 0 : parseInt(simAway, 10);

    // Exact Match
    if (predHome === homeVal && predAway === awayVal) {
      return { points: 3, type: 'exact' as const };
    }

    // Trend (Sign match)
    const actualSign = Math.sign(homeVal - awayVal);
    const predSign = Math.sign(predHome - predAway);
    if (actualSign === predSign) {
      return { points: 1, type: 'trend' as const };
    }

    return { points: 0, type: 'miss' as const };
  };

  // Process and enrich predictions with calculated simulated points
  const enrichedPredictions = predictions.map(p => {
    const sim = calculateSimPoints(p.predicted_home, p.predicted_away);
    return {
      ...p,
      simPoints: sim.points,
      simType: sim.type
    };
  });

  // Calculate summary counters
  const totalCount = enrichedPredictions.length;
  const withPredictionsCount = enrichedPredictions.filter(p => p.has_prediction).length;
  
  const exactCount = enrichedPredictions.filter(p => p.has_prediction && p.simType === 'exact').length;
  const trendCount = enrichedPredictions.filter(p => p.has_prediction && p.simType === 'trend').length;
  const missCount = enrichedPredictions.filter(p => p.has_prediction && p.simType === 'miss').length;

  // Filter and sort
  const filteredPredictions = enrichedPredictions
    .filter(p => {
      const term = searchTerm.toLowerCase();
      return p.display_name.toLowerCase().includes(term);
    })
    .sort((a, b) => {
      if (sortBy === 'points') {
        if (b.simPoints !== a.simPoints) {
          return b.simPoints - a.simPoints;
        }
        return a.display_name.localeCompare(b.display_name);
      } else {
        return a.display_name.localeCompare(b.display_name);
      }
    });

  const matchTime = match ? new Date(match.match_time) : null;
  const isMatchScheduled = match ? match.status === 'scheduled' : false;

  return (
    <div className="space-y-6">
      {/* Page Header Actions */}
      <div className="flex items-center justify-between p-4 bg-wc-card/50 rounded-2xl border border-wc-border backdrop-blur-md relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-wc-gold/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex items-center gap-2.5 relative z-10">
          <Activity className="w-5 h-5 text-wc-gold animate-pulse" />
          <div>
            <h2 className="text-sm font-bold text-white font-sports tracking-wider uppercase">Pronósticos del Partido</h2>
            <p className="text-[10px] text-slate-400">Compara predicciones y simula resultados en vivo</p>
          </div>
        </div>
        <button
          onClick={fetchData}
          className="p-2 px-3.5 rounded-xl bg-wc-dark hover:bg-wc-card text-slate-300 hover:text-white border border-wc-border transition-all duration-200 text-xs font-bold font-sports tracking-wider uppercase flex items-center gap-1.5 relative z-10"
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} strokeWidth={2.5} />
          <span>Actualizar</span>
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 space-y-4 bg-wc-card/40 rounded-2xl border border-wc-border">
          <RefreshCw className="w-9 h-9 animate-spin text-wc-gold" strokeWidth={2.5} />
          <p className="text-slate-400 text-xs font-sports tracking-wider uppercase">Obteniendo partido y pronósticos...</p>
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl bg-wc-red/10 border border-wc-red/20 text-center flex flex-col items-center justify-center space-y-3">
          <XCircle className="w-9 h-9 text-wc-red" strokeWidth={2.5} />
          <p className="text-wc-red font-bold text-xs uppercase font-sports tracking-wider">{error}</p>
          <button
            onClick={fetchData}
            className="px-4 py-2 rounded-xl bg-wc-red/20 hover:bg-wc-red/35 text-white text-xs font-bold font-sports tracking-wider uppercase border border-wc-red/30 transition-colors"
          >
            Reintentar
          </button>
        </div>
      ) : !match ? (
        <div className="p-12 text-center bg-wc-card/40 rounded-2xl border border-wc-border text-slate-400 text-sm flex flex-col items-center justify-center gap-2">
          <Award className="w-9 h-9 text-slate-500" strokeWidth={2.5} />
          <p className="font-sports text-xs uppercase tracking-wider">No se encontró ningún partido activo o próximo.</p>
        </div>
      ) : (
        <>
          {/* Hero Match Details & Simulation Tool */}
          <div className="p-6 bg-wc-card border border-wc-border rounded-2xl relative overflow-hidden shadow-xl shadow-black/20">
            <div className="absolute top-0 right-0 w-64 h-64 bg-wc-gold/5 rounded-full blur-3xl pointer-events-none"></div>
            
            {/* Match Metadata */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-400 mb-5 border-b border-wc-border/50 pb-3 relative z-10">
              <div className="flex flex-wrap items-center gap-2">
                {match.group_name && (
                  <span className="whitespace-nowrap font-bold text-slate-455 font-sports tracking-wider uppercase bg-wc-dark/60 px-3 py-1 rounded-xl border border-wc-border">{match.group_name}</span>
                )}
                <span className={`whitespace-nowrap px-2 py-0.5 rounded text-[10px] font-bold font-sports tracking-wide uppercase ${
                  match.status === 'live'
                    ? 'bg-wc-red/10 border border-wc-red/30 text-wc-red animate-pulse'
                    : match.status === 'finished'
                    ? 'bg-wc-green/10 border border-wc-green/30 text-wc-green'
                    : 'bg-slate-800 border border-slate-700 text-slate-300'
                }`}>
                  {match.status === 'live' ? 'En Vivo' : match.status === 'finished' ? 'Finalizado' : 'Programado'}
                </span>
              </div>
              <div className="font-bold font-sports tracking-wider uppercase text-slate-450 sm:text-right">
                {matchTime ? `${matchTime.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} • ${matchTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}` : ''}
              </div>
            </div>

            {/* Score Simulation Form */}
            <div className="flex items-center justify-between gap-2 sm:gap-6 relative z-10">
              {/* Home Team */}
              <div className="flex-1 min-w-0 flex flex-col items-center text-center">
                {getTeamFlagUrl(match.home_team) && (
                  <img
                    src={getTeamFlagUrl(match.home_team)!}
                    alt={match.home_team}
                    className="w-10 h-7 object-cover rounded shadow border border-slate-700/50 shrink-0"
                  />
                )}
                <span className="font-extrabold text-white text-xs sm:text-base font-sports tracking-wide uppercase mt-2 whitespace-normal text-center max-w-full">
                  {match.home_team}
                </span>
              </div>

              {/* Simulation Score Controller */}
              <div className="flex flex-col items-center gap-1.5 bg-wc-dark/40 border border-wc-border p-2 sm:p-3 px-3 sm:px-5 rounded-2xl min-w-[130px] sm:min-w-[200px] shrink-0">
                <span className="text-[8px] sm:text-[10px] text-wc-gold font-bold uppercase tracking-wider font-sports text-center">Simulador</span>
                <div className="flex items-center gap-2 sm:gap-3">
                  <input
                    type="text"
                    maxLength={2}
                    value={simHome}
                    onChange={(e) => handleSimScoreChange('home', e.target.value)}
                    placeholder="0"
                    className="w-10 h-10 sm:w-14 sm:h-14 rounded-lg sm:rounded-xl bg-wc-dark text-center text-lg sm:text-2xl font-bold border border-wc-border text-wc-gold focus:outline-none focus:ring-2 focus:ring-wc-gold/50 focus:border-wc-gold font-mono"
                  />
                  <span className="text-slate-500 font-bold text-lg sm:text-2xl">:</span>
                  <input
                    type="text"
                    maxLength={2}
                    value={simAway}
                    onChange={(e) => handleSimScoreChange('away', e.target.value)}
                    placeholder="0"
                    className="w-10 h-10 sm:w-14 sm:h-14 rounded-lg sm:rounded-xl bg-wc-dark text-center text-lg sm:text-2xl font-bold border border-wc-border text-wc-gold focus:outline-none focus:ring-2 focus:ring-wc-gold/50 focus:border-wc-gold font-mono"
                  />
                </div>
                {match.status === 'scheduled' && (
                  <span className="text-[9px] sm:text-xs text-slate-500 font-bold tracking-wider font-sports uppercase text-center">Programado</span>
                )}
                {match.status === 'live' && (
                  <span className="text-[9px] sm:text-xs text-wc-red animate-pulse font-bold tracking-wider font-sports uppercase text-center">En Vivo: {match.home_score ?? 0}-{match.away_score ?? 0}</span>
                )}
                {match.status === 'finished' && (
                  <span className="text-[9px] sm:text-xs text-wc-green font-bold tracking-wider font-sports uppercase text-center">Final: {match.home_score}-{match.away_score}</span>
                )}
              </div>

              {/* Away Team */}
              <div className="flex-1 min-w-0 flex flex-col items-center text-center">
                {getTeamFlagUrl(match.away_team) && (
                  <img
                    src={getTeamFlagUrl(match.away_team)!}
                    alt={match.away_team}
                    className="w-10 h-7 object-cover rounded shadow border border-slate-700/50 shrink-0"
                  />
                )}
                <span className="font-extrabold text-white text-xs sm:text-base font-sports tracking-wide uppercase mt-2 whitespace-normal text-center max-w-full">
                  {match.away_team}
                </span>
              </div>
            </div>

            {/* Tendencias de la Comunidad */}
            {tendencies && tendencies.total_predictions > 0 && (
              <div className="mt-5 pt-4 border-t border-wc-border/50 relative z-10">
                <p className="text-[10px] text-wc-gold font-bold uppercase tracking-wider font-sports text-center mb-2.5">
                  Tendencia de los Participantes
                </p>
                <div className="flex items-center justify-between text-[10px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 font-sports uppercase tracking-wider mb-2">
                  <span className="text-emerald-600 dark:text-wc-green">{match.home_team} {tendencies.home_win_percent}%</span>
                  <span className="text-slate-550 dark:text-slate-400 font-bold">Empate {tendencies.draw_percent}%</span>
                  <span className="text-blue-600 dark:text-wc-blue">{match.away_team} {tendencies.away_win_percent}%</span>
                </div>
                <div className="h-2.5 rounded-full overflow-hidden flex bg-slate-200 dark:bg-slate-800">
                  <div 
                    style={{ width: `${tendencies.home_win_percent}%` }} 
                    className="bg-emerald-500 dark:bg-wc-green transition-all duration-500" 
                    title={`Victoria de ${match.home_team}: ${tendencies.home_win_percent}%`} 
                  />
                  <div 
                    style={{ width: `${tendencies.draw_percent}%` }} 
                    className="bg-slate-400 dark:bg-slate-600 transition-all duration-500" 
                    title={`Empate: ${tendencies.draw_percent}%`} 
                  />
                  <div 
                    style={{ width: `${tendencies.away_win_percent}%` }} 
                    className="bg-blue-500 dark:bg-wc-blue transition-all duration-500" 
                    title={`Victoria de ${match.away_team}: ${tendencies.away_win_percent}%`} 
                  />
                </div>
              </div>
            )}
          </div>

          {/* Quick Counters Cards - Only shown if match is live/finished (so calculations are visible) */}
          {!isMatchScheduled && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3 bg-wc-card/30 border border-wc-border rounded-xl flex items-center gap-3">
                <div className="p-2 rounded-lg bg-wc-green/10 text-wc-green border border-wc-green/20">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[9px] text-slate-400 font-sports uppercase tracking-wider">Exacto (3 pts)</p>
                  <p className="text-lg font-bold text-white font-mono">{exactCount}</p>
                </div>
              </div>

              <div className="p-3 bg-wc-card/30 border border-wc-border rounded-xl flex items-center gap-3">
                <div className="p-2 rounded-lg bg-wc-blue/10 text-wc-blue border border-wc-border/20">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[9px] text-slate-400 font-sports uppercase tracking-wider">Tendencia (1 pt)</p>
                  <p className="text-lg font-bold text-white font-mono">{trendCount}</p>
                </div>
              </div>

              <div className="p-3 bg-wc-card/30 border border-wc-border rounded-xl flex items-center gap-3">
                <div className="p-2 rounded-lg bg-wc-red/10 text-wc-red border border-wc-red/20">
                  <XCircle className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[9px] text-slate-400 font-sports uppercase tracking-wider">Errado (0 pts)</p>
                  <p className="text-lg font-bold text-white font-mono">{missCount}</p>
                </div>
              </div>

              <div className="p-3 bg-wc-card/30 border border-wc-border rounded-xl flex items-center gap-3">
                <div className="p-2 rounded-lg bg-slate-800 text-slate-400 border border-slate-700">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[9px] text-slate-400 font-sports uppercase tracking-wider">Participantes</p>
                  <p className="text-lg font-bold text-white font-mono">
                    {withPredictionsCount} <span className="text-xs text-slate-500">/ {totalCount}</span>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* List Section */}
          <div className="bg-wc-card border border-wc-border rounded-2xl overflow-hidden shadow-lg">
            {/* Search & Sort Panel */}
            <div className="p-4 border-b border-wc-border/60 bg-wc-card/50 flex flex-col md:flex-row items-center gap-4 justify-between">
              {/* Search Bar */}
              <div className="w-full md:w-80 relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Buscar participante..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-wc-dark border border-wc-border text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-wc-gold/50 focus:border-wc-gold"
                />
              </div>

              {/* Sort Tabs - Only show point sorting if match is not scheduled */}
              <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                <span className="text-[10px] text-slate-455 uppercase font-sports tracking-wider">Ordenar por:</span>
                <div className="bg-wc-dark p-1 rounded-lg border border-wc-border flex items-center">
                  {!isMatchScheduled && (
                    <button
                      onClick={() => setSortBy('points')}
                      className={`px-3 py-1 rounded text-[10px] font-bold font-sports tracking-wider uppercase transition-colors ${
                        sortBy === 'points' ? 'bg-wc-gold text-wc-dark' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Puntos
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setSortBy('name');
                    }}
                    className={`px-3 py-1 rounded text-[10px] font-bold font-sports tracking-wider uppercase transition-colors ${
                      sortBy === 'name' || isMatchScheduled ? 'bg-wc-gold text-wc-dark' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Nombre
                  </button>
                </div>
              </div>
            </div>

            {/* Predictions Table */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse font-medium">
                <thead>
                  <tr className="border-b border-wc-border/50 text-[10px] text-slate-455 font-sports uppercase tracking-wider text-left bg-wc-dark/30">
                    <th className="py-3 px-4 font-bold">Participante</th>
                    <th className="py-3 px-4 font-bold text-center">Pronóstico</th>
                    {!isMatchScheduled && <th className="py-3 px-4 font-bold text-center">Simula</th>}
                    {!isMatchScheduled && <th className="py-3 px-4 font-bold text-right whitespace-nowrap">Pts. Sim.</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-wc-border/30 text-xs">
                  {filteredPredictions.length === 0 ? (
                    <tr>
                      <td colSpan={isMatchScheduled ? 2 : 4} className="py-8 text-center text-slate-500 italic">
                        No se encontraron registros que coincidan.
                      </td>
                    </tr>
                  ) : (
                    filteredPredictions.map((pred) => {
                      const isMyEntry = pred.is_own;
                      return (
                        <tr 
                          key={pred.entry_id} 
                          className={`transition-all duration-200 hover:bg-wc-dark/20 ${
                            isMyEntry ? 'bg-wc-gold/5 border-l-2 border-l-wc-gold' : ''
                          }`}
                        >
                          <td className="py-3 px-4 flex items-center gap-2">
                            <span className={isMyEntry ? 'font-bold text-wc-gold' : 'text-white font-semibold'}>
                              {pred.display_name}
                            </span>
                            {isMyEntry && (
                              <span className="px-1.5 py-0.5 rounded bg-wc-gold/15 text-wc-gold text-[8px] font-bold uppercase border border-wc-gold/20 font-sports tracking-wider">
                                Tú
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {pred.has_prediction ? (
                              pred.predicted_home !== null ? (
                                <span className="font-mono bg-wc-dark px-2.5 py-1 rounded-md border border-wc-border/50 text-white font-semibold">
                                  {pred.predicted_home} - {pred.predicted_away}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 text-[10px] bg-slate-800/60 px-2.5 py-1 rounded text-slate-450 border border-slate-700/50">
                                  <Lock className="w-3 h-3 text-slate-500 shrink-0" strokeWidth={2.5} /> Oculto
                                </span>
                              )
                            ) : (
                              <span className="text-[10px] text-slate-500 italic uppercase">Sin pronóstico</span>
                            )}
                          </td>
                          {!isMatchScheduled && (
                            <td className="py-3 px-4 text-center">
                              {pred.has_prediction ? (
                                pred.simType === 'exact' ? (
                                  <span className="inline-block px-2.5 py-0.5 rounded text-[9px] font-bold font-sports tracking-wider uppercase bg-wc-green/10 border border-wc-green/30 text-wc-green">
                                    Exacto
                                  </span>
                                ) : pred.simType === 'trend' ? (
                                  <span className="inline-block px-2.5 py-0.5 rounded text-[9px] font-bold font-sports tracking-wider uppercase bg-wc-blue/10 border border-wc-blue/30 text-wc-blue">
                                    Tendencia
                                  </span>
                                ) : (
                                  <span className="inline-block px-2.5 py-0.5 rounded text-[9px] font-bold font-sports tracking-wider uppercase bg-wc-red/10 border border-wc-red/25 text-wc-red/80">
                                    Errado
                                  </span>
                                )
                              ) : (
                                <span className="text-[10px] text-slate-650">-</span>
                              )}
                            </td>
                          )}
                          {!isMatchScheduled && (
                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              <span className={`inline-block font-mono text-xs font-bold px-2 py-0.5 rounded whitespace-nowrap ${
                                pred.simPoints === 3
                                  ? 'bg-wc-green/20 text-wc-green border border-wc-green/20'
                                  : pred.simPoints === 1
                                  ? 'bg-wc-blue/20 text-wc-blue border border-wc-blue/20'
                                  : 'bg-slate-800/40 text-slate-500 border border-slate-700/40'
                              }`}>
                                +{pred.simPoints} pts
                              </span>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
