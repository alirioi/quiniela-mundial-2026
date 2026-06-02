/**
 * @file PredictionsForm.tsx
 * @description Componente de formulario interactivo para que los usuarios ingresen y guarden sus predicciones.
 * Permite la gestión por cupos individuales, visualización de tablas simuladas basadas en los pronósticos
 * ingresados y validación de tiempos de bloqueo (lock) antes de cada partido.
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { showAlert } from '../../utils/alerts';
import { getTeamFlagUrl } from '../../utils/flags';
import { Lock, Clock, AlertTriangle, Loader2, Award, CheckCircle2, Trophy, GitBranch, Save } from 'lucide-react';
import KnockoutBracket from './KnockoutBracket';

/**
 * Datos de una predicción específica.
 */
interface Prediction {
  id?: number;
  predicted_home: number;
  predicted_away: number;
  points_earned?: number;
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
  prediction: Prediction | null;
}

interface Phase {
  id: number;
  name: string;
  slug: string;
  is_active: boolean;
}

interface Entry {
  id: number;
  entry_number: number;
  display_name: string;
  status: 'pending' | 'approved' | 'rejected';
  predicted_champion?: string | null;
  predicted_champion_goals?: number | null;
  predicted_final_goals?: number | null;
}

interface PredictionsFormProps {
  phaseSlug: string;
  userEntries: Entry[];
}

export default function PredictionsForm({ phaseSlug, userEntries }: PredictionsFormProps) {
  const [selectedEntryId, setSelectedEntryId] = useState<number>(userEntries[0]?.id || 0);

  const selectedEntry = useMemo(() => {
    return userEntries.find(e => e.id === selectedEntryId);
  }, [userEntries, selectedEntryId]);

  const isGoldPredictionPending = useMemo(() => {
    return selectedEntry && (
      !selectedEntry.predicted_champion ||
      selectedEntry.predicted_champion_goals === null ||
      selectedEntry.predicted_final_goals === null
    );
  }, [selectedEntry]);
  const [phase, setPhase] = useState<Phase | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'pronosticos' | 'tabla' | 'llave'>('pronosticos');
  
  // Estado local para los inputs: record de matchId -> { home, away }
  const [inputs, setInputs] = useState<Record<number, { home: string; away: string }>>({});
  const [savingIds, setSavingIds] = useState<Record<number, boolean>>({});
  const [bulkSaving, setBulkSaving] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<Record<number, string>>({});
  const [showFloatingSave, setShowFloatingSave] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 200) {
        setShowFloatingSave(true);
      } else {
        setShowFloatingSave(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // 1. Procesa las posiciones de grupos simuladas en tiempo real
  const { groupStandings, thirdPlaces } = useMemo(() => {
    if (phaseSlug !== 'grupos' || matches.length === 0) {
      return { groupStandings: {}, thirdPlaces: [] };
    }

    const statsByGroup: Record<string, Record<string, TeamStats>> = {};

    matches.forEach(match => {
      if (!match.group_name) return;
      const group = match.group_name;

      if (!statsByGroup[group]) statsByGroup[group] = {};
      if (!statsByGroup[group][match.home_team]) {
        statsByGroup[group][match.home_team] = { team: match.home_team, group, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, dg: 0, pts: 0 };
      }
      if (!statsByGroup[group][match.away_team]) {
        statsByGroup[group][match.away_team] = { team: match.away_team, group, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, dg: 0, pts: 0 };
      }

      // Determinar puntajes simulados (prioridad: input local > predicción guardada > marcador real)
      const input = inputs[match.id];
      let homeScore: number | null = null;
      let awayScore: number | null = null;

      if (input && input.home !== '' && input.away !== '') {
        // Usar input local del usuario si está completo
        homeScore = parseInt(input.home);
        awayScore = parseInt(input.away);
      } else if (match.prediction) {
        // Usar predicción guardada si está disponible
        homeScore = match.prediction.predicted_home;
        awayScore = match.prediction.predicted_away;
      } else if ((match.status === 'finished' || match.status === 'live') && match.home_score !== null && match.away_score !== null) {
        // Usar marcador real si el partido ya ocurrió/está en vivo y no hay predicción
        homeScore = match.home_score;
        awayScore = match.away_score;
      }

      if (homeScore !== null && awayScore !== null) {
        const home = statsByGroup[group][match.home_team];
        const away = statsByGroup[group][match.away_team];

        home.pj++;
        away.pj++;
        home.gf += homeScore;
        home.gc += awayScore;
        away.gf += awayScore;
        away.gc += homeScore;

        if (homeScore > awayScore) {
          home.g++;
          home.pts += 3;
          away.p++;
        } else if (homeScore < awayScore) {
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

    // Ordenar equipos dentro de cada grupo simulado
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

      if (teams.length >= 3) {
        allThirds.push(teams[2]); // El 3º puesto simulado
      }
    });

    // Ordenar los mejores terceros simulados
    allThirds.sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      if (b.dg !== a.dg) return b.dg - a.dg;
      if (b.gf !== a.gf) return b.gf - a.gf;
      if (b.g !== a.g) return b.g - a.g;
      return a.team.localeCompare(b.team);
    });

    return { groupStandings: finalStandings, thirdPlaces: allThirds };
  }, [matches, inputs, phaseSlug]);

  // Helper for team rows in simulated standings
  const renderSimulatedTeamRow = (team: TeamStats, index: number, isThirdPlaceTable = false) => {
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

  const fetchMatchesAndPredictions = async () => {
    if (!selectedEntryId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/matches/${phaseSlug}?entryId=${selectedEntryId}`);
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Error al cargar los partidos');
      }
      const data = await response.json();
      setPhase(data.phase);
      setMatches(data.matches);

      // Rellenar inputs iniciales
      const initialInputs: Record<number, { home: string; away: string }> = {};
      data.matches.forEach((match: Match) => {
        initialInputs[match.id] = {
          home: match.prediction ? String(match.prediction.predicted_home) : '',
          away: match.prediction ? String(match.prediction.predicted_away) : '',
        };
      });
      setInputs(initialInputs);
    } catch (err: any) {
      setError(err.message || 'Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatchesAndPredictions();
  }, [selectedEntryId]);

  // Actualizar temporizadores (countdown de 2 horas antes de cada partido)
  useEffect(() => {
    const updateCountdowns = () => {
      const remaining: Record<number, string> = {};
      matches.forEach((match) => {
        const matchTime = new Date(match.match_time).getTime();
        const lockTime = matchTime - 2 * 60 * 60 * 1000; // 2 horas antes
        const now = Date.now();

        if (now >= lockTime) {
          remaining[match.id] = 'Bloqueado';
        } else {
          const diff = lockTime - now;
          const days = Math.floor(diff / (24 * 60 * 60 * 1000));
          const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
          const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
          const seconds = Math.floor((diff % (60 * 1000)) / 1000);

          if (days > 0) {
            remaining[match.id] = `Cierra en ${days}d ${hours}h`;
          } else if (hours > 0) {
            remaining[match.id] = `Cierra en ${hours}h ${minutes}m`;
          } else {
            remaining[match.id] = `Cierra en ${minutes}m ${seconds}s`;
          }
        }
      });
      setTimeRemaining(remaining);
    };

    updateCountdowns();
    timerRef.current = setInterval(updateCountdowns, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [matches]);

  const handleInputChange = (matchId: number, field: 'home' | 'away', val: string) => {
    if (val !== '' && !/^\d+$/.test(val)) return;

    setInputs((prev) => ({
      ...prev,
      [matchId]: {
        ...prev[matchId],
        [field]: val,
      },
    }));
  };

  const isLocked = (matchTimeStr: string) => {
    const matchTime = new Date(matchTimeStr).getTime();
    const lockTime = matchTime - 2 * 60 * 60 * 1000;
    return Date.now() >= lockTime;
  };

  // Guardar una predicción individual
  const handleSaveIndividual = async (matchId: number) => {
    const input = inputs[matchId];
    if (!input || input.home === '' || input.away === '') return;

    const match = matches.find((m) => m.id === matchId);
    if (!match || isLocked(match.match_time)) {
      showAlert.warning('Advertencia', 'Este partido ya está bloqueado para predicciones.');
      return;
    }

    setSavingIds((prev) => ({ ...prev, [matchId]: true }));
    try {
      let response;
      
      if (match.prediction && match.prediction.id) {
        // Actualización individual
        response = await fetch(`/api/predictions/${match.prediction.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            predictedHome: input.home,
            predictedAway: input.away,
          }),
        });
      } else {
        // Crear nueva predicción (vía bulk pero de un solo elemento)
        response = await fetch('/api/predictions/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entryId: selectedEntryId,
            predictions: [
              {
                matchId: matchId,
                predictedHome: input.home,
                predictedAway: input.away,
              },
            ],
          }),
        });
      }

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Error al guardar el pronóstico');
      }

      // Volver a cargar predicciones del cupo para actualizar IDs
      await fetchMatchesAndPredictions();
    } catch (err: any) {
      showAlert.error('Error', err.message);
    } finally {
      setSavingIds((prev) => ({ ...prev, [matchId]: false }));
    }
  };

  // Guardar todos los partidos vacíos/completados (Bulk)
  const handleSaveBulk = async () => {
    const predictionsToSave = matches
      .filter((m) => !isLocked(m.match_time))
      .map((m) => {
        const input = inputs[m.id];
        return {
          matchId: m.id,
          predictedHome: input?.home || '',
          predictedAway: input?.away || '',
        };
      })
      .filter((p) => p.predictedHome !== '' && p.predictedAway !== '');

    if (predictionsToSave.length === 0) {
      showAlert.warning('Advertencia', 'Completa al menos un marcador antes de guardar.');
      return;
    }

    setBulkSaving(true);
    try {
      const response = await fetch('/api/predictions/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entryId: selectedEntryId,
          predictions: predictionsToSave,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Error al guardar las predicciones');
      }

      showAlert.success('Éxito', '¡Todas tus predicciones se guardaron correctamente!');
      await fetchMatchesAndPredictions();
    } catch (err: any) {
      showAlert.error('Error', err.message);
    } finally {
      setBulkSaving(false);
    }
  };

  // Verificar si hay algún partido sin predicción guardada
  const unpredictedCount = matches.filter((m) => !m.prediction && !isLocked(m.match_time)).length;

  // Agrupar partidos por fecha para orden visual premium
  const groupedMatches: Record<string, Match[]> = {};
  matches.forEach((match) => {
    const dateKey = new Date(match.match_time).toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    if (!groupedMatches[dateKey]) {
      groupedMatches[dateKey] = [];
    }
    groupedMatches[dateKey].push(match);
  });

  return (
    <div className="space-y-6">
      {/* Barra de cabecera con selector de cupo */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 bg-wc-card/90 rounded-2xl border border-wc-border backdrop-blur-sm">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5 font-sports">
            Selecciona tu Cupo
          </label>
          <div className="flex flex-wrap items-center gap-2">
            {userEntries.map((entry) => (
              <button
                key={entry.id}
                onClick={() => setSelectedEntryId(entry.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all duration-200 font-sports cursor-pointer ${
                  selectedEntryId === entry.id
                    ? 'bg-gradient-to-r from-wc-gold to-amber-500 text-slate-950 border-transparent shadow-md shadow-wc-gold/20'
                    : 'bg-wc-dark border-wc-border text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                {entry.display_name}
              </button>
            ))}
          </div>
        </div>

        {unpredictedCount > 0 && !loading && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <span className="text-xs text-wc-gold font-bold bg-wc-gold/10 border border-wc-gold/20 px-3.5 py-2.5 rounded-xl flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 shrink-0 text-wc-gold" strokeWidth={2.5} />
              <span>Tienes {unpredictedCount} pronósticos vacíos</span>
            </span>
            
            <button
              onClick={handleSaveBulk}
              disabled={bulkSaving}
              className="px-5 py-2.5 bg-gradient-to-r from-wc-gold to-amber-500 hover:from-amber-400 hover:to-wc-gold text-slate-950 rounded-xl text-sm font-bold font-sports tracking-wide transition-all shadow-lg shadow-wc-gold/20 disabled:opacity-50 cursor-pointer"
            >
              {bulkSaving ? 'Guardando...' : 'Guardar Todo'}
            </button>
          </div>
        )}
      </div>

      {/* Alerta de Pronóstico de Oro Pendiente */}
      {isGoldPredictionPending && !loading && !error && (
        <div className="warning-box p-5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-pulse-subtle">
          <div className="flex items-start gap-3 text-xs sm:text-sm">
            <Award className="w-6 h-6 shrink-0 mt-0.5" strokeWidth={2.5} />
            <div>
              <h4 className="font-bold font-sports uppercase tracking-wider text-sm">
                ¡Pronóstico de Oro Pendiente!
              </h4>
              <p className="mt-1 text-slate-350 leading-relaxed normal-case">
                Para este cupo ({selectedEntry?.display_name}) aún no has completado tu predicción de desempate.
                Es <strong className="text-white">obligatorio</strong> hacerlo antes del inicio oficial del mundial para poder optar al premio en caso de empate de puntos. No se admitirán cambios posteriores.
              </p>
            </div>
          </div>
          <a
            href="/predictions/oro"
            className="px-6 py-2.5 bg-gradient-to-r from-wc-gold to-amber-500 hover:from-amber-400 hover:to-wc-gold text-slate-950 rounded-xl text-xs font-bold font-sports tracking-wider uppercase transition-all shadow-md shadow-wc-gold/10 shrink-0 text-center hover:-translate-y-0.5"
          >
            Llenar Pronóstico de Oro
          </a>
        </div>
      )}

      {/* Selector de sub-pestañas si es fase de grupos */}
      {phaseSlug === 'grupos' && !loading && !error && (
        <div className="flex justify-center my-4 animate-fade-in">
          <div className="flex bg-wc-dark border border-wc-border rounded-xl p-1 w-full max-w-md shadow-lg">
            <button
              onClick={() => setActiveSubTab('pronosticos')}
              className={`flex-1 px-4 py-2 rounded-lg text-xs font-bold transition-all font-sports uppercase tracking-wider cursor-pointer ${
                activeSubTab === 'pronosticos'
                  ? 'bg-wc-gold text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Mis Pronósticos
            </button>
            <button
              onClick={() => setActiveSubTab('tabla')}
              className={`flex-1 px-4 py-2 rounded-lg text-xs font-bold transition-all font-sports uppercase tracking-wider cursor-pointer ${
                activeSubTab === 'tabla'
                  ? 'bg-wc-gold text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Tabla Simulada
            </button>
            <button
              onClick={() => setActiveSubTab('llave')}
              className={`flex-1 px-4 py-2 rounded-lg text-xs font-bold transition-all font-sports uppercase tracking-wider cursor-pointer ${
                activeSubTab === 'llave'
                  ? 'bg-wc-gold text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Llave Simulada
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center p-16 space-y-4 bg-wc-card/20 rounded-2xl border border-wc-border">
          <Loader2 className="w-10 h-10 animate-spin text-wc-gold" strokeWidth={2.5} />
          <p className="text-slate-400 text-sm">Cargando partidos y pronósticos...</p>
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl bg-red-950/20 border border-wc-red/40 text-center flex flex-col items-center justify-center space-y-3">
          <AlertTriangle className="w-10 h-10 text-wc-red" strokeWidth={2.5} />
          <p className="text-red-400 font-semibold text-sm">{error}</p>
          <button
            onClick={fetchMatchesAndPredictions}
            className="px-4 py-2 rounded-xl bg-wc-red/20 hover:bg-wc-red/40 text-red-200 text-xs font-semibold border border-wc-red/35 transition-colors font-sports tracking-wide cursor-pointer"
          >
            Reintentar
          </button>
        </div>
      ) : (
        <>
          {activeSubTab === 'pronosticos' || phaseSlug !== 'grupos' ? (
            <div className="space-y-8 animate-fade-in">
              {Object.entries(groupedMatches).map(([dateLabel, dateMatches]) => (
                <div key={dateLabel} className="space-y-3">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 border-l-3 border-wc-gold pl-2.5 font-sports">
                    {dateLabel}
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {dateMatches.map((match) => {
                      const input = inputs[match.id] || { home: '', away: '' };
                      const locked = isLocked(match.match_time) || match.status !== 'scheduled';
                      const countdown = timeRemaining[match.id] || 'Cargando...';
                      
                      // Comparar si cambió el marcador respecto al guardado
                      const savedHome = match.prediction ? String(match.prediction.predicted_home) : '';
                      const savedAway = match.prediction ? String(match.prediction.predicted_away) : '';
                      const hasChanges = input.home !== savedHome || input.away !== savedAway;
                      const isComplete = input.home !== '' && input.away !== '';
                      const canSaveIndividual = hasChanges && isComplete && !locked;

                      // Cálculo de puntos
                      const pointsEarned = match.prediction?.points_earned;

                      return (
                        <div
                          key={match.id}
                          className={`p-4 rounded-2xl border transition-all duration-300 flex flex-col justify-between ${
                            locked
                              ? 'border-wc-border bg-wc-dark/30 opacity-90'
                              : hasChanges
                              ? 'border-wc-gold/30 bg-wc-gold/5 animate-pulse'
                              : match.prediction
                              ? 'border-wc-gold/25 bg-wc-card/50'
                              : 'border-wc-border bg-wc-card'
                          }`}
                        >
                          {/* Fila superior: Info de Partido y Countdown */}
                          <div className="flex justify-between items-center text-xs text-slate-500 mb-3 border-b border-wc-border pb-2">
                            <div className="flex items-center gap-1.5">
                              <span className="font-sports bg-wc-dark px-2 py-0.5 rounded text-slate-300 border border-wc-border">
                                #{match.match_number}
                              </span>
                              {match.group_name && (
                                <span className="font-bold text-slate-400 font-sports uppercase tracking-wider">{match.group_name}</span>
                              )}
                            </div>

                            {/* Estado o cuenta regresiva */}
                            <div className="flex items-center gap-1.5 font-bold text-xs">
                              {match.status === 'live' ? (
                                <span className="px-2 py-0.5 bg-wc-red/10 text-wc-red rounded-md border border-wc-red/20 animate-pulse text-xs uppercase tracking-wider flex items-center gap-1 font-sports">
                                  <span className="w-1.5 h-1.5 rounded-full bg-wc-red inline-block animate-ping"></span>
                                  <span>En vivo</span>
                                </span>
                              ) : match.status === 'finished' ? (
                                <span className="px-2 py-0.5 bg-wc-dark text-slate-400 rounded-md border border-wc-border text-xs uppercase tracking-wider font-sports">
                                  Fin
                                </span>
                              ) : (
                                <span className={`flex items-center gap-1 font-sports ${locked ? 'text-wc-red' : 'text-wc-gold'}`}>
                                  {locked ? (
                                    <Lock className="w-4 h-4 shrink-0 text-wc-red" strokeWidth={2.5} />
                                  ) : (
                                    <Clock className="w-4 h-4 shrink-0 text-wc-gold animate-pulse" strokeWidth={2.5} />
                                  )}
                                  <span>{countdown}</span>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Fila central: Marcador del Partido y Predicción */}
                          <div className="flex items-center justify-between gap-3 my-2">
                            {/* Local */}
                            <div className="flex-1 min-w-0 pr-1">
                              <div className="flex items-center justify-end gap-2">
                                <span className="font-bold text-white text-sm sm:text-base truncate" title={match.home_team}>
                                  {match.home_team}
                                </span>
                                {getTeamFlagUrl(match.home_team) && (
                                  <img
                                    src={getTeamFlagUrl(match.home_team)!}
                                    alt={`Bandera de ${match.home_team}`}
                                    className="w-6 h-4 sm:w-7 sm:h-5 object-cover rounded shadow border border-slate-700/50 flex-shrink-0"
                                  />
                                )}
                              </div>
                            </div>

                            {/* Marcador Real (si está jugando o terminado) */}
                            {locked && (match.status === 'finished' || match.status === 'live') && (
                              <div className="px-3 py-1.5 bg-wc-dark rounded-lg border border-wc-border text-white font-bold text-sm font-sports tracking-widest">
                                {match.home_score} - {match.away_score}
                              </div>
                            )}

                            {/* Pronóstico Inputs */}
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <input
                                type="text"
                                maxLength={2}
                                value={input.home}
                                onChange={(e) => handleInputChange(match.id, 'home', e.target.value)}
                                disabled={locked}
                                placeholder="-"
                                className={`w-11 h-11 rounded-xl bg-wc-dark text-center text-lg font-bold font-sports border focus:outline-none focus:ring-2 focus:ring-wc-gold/40 transition-all ${
                                  locked
                                    ? 'border-wc-border text-slate-500 cursor-not-allowed bg-wc-dark/55'
                                    : 'border-wc-border text-wc-gold focus:border-wc-gold'
                                }`}
                              />

                              <span className="text-slate-600 font-bold text-lg font-sports">:</span>

                              <input
                                type="text"
                                maxLength={2}
                                value={input.away}
                                onChange={(e) => handleInputChange(match.id, 'away', e.target.value)}
                                disabled={locked}
                                placeholder="-"
                                className={`w-11 h-11 rounded-xl bg-wc-dark text-center text-lg font-bold font-sports border focus:outline-none focus:ring-2 focus:ring-wc-gold/40 transition-all ${
                                  locked
                                    ? 'border-wc-border text-slate-500 cursor-not-allowed bg-wc-dark/55'
                                    : 'border-wc-border text-wc-gold focus:border-wc-gold'
                                }`}
                              />
                            </div>

                            {/* Visitante */}
                            <div className="flex-1 min-w-0 pl-1">
                              <div className="flex items-center justify-start gap-2">
                                {getTeamFlagUrl(match.away_team) && (
                                  <img
                                    src={getTeamFlagUrl(match.away_team)!}
                                    alt={`Bandera de ${match.away_team}`}
                                    className="w-6 h-4 sm:w-7 sm:h-5 object-cover rounded shadow border border-slate-700/50 flex-shrink-0"
                                  />
                                )}
                                <span className="font-bold text-white text-sm sm:text-base truncate" title={match.away_team}>
                                  {match.away_team}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Fila inferior: Puntuación ganada o Botón Guardar */}
                          <div className="flex justify-between items-center mt-3 pt-2.5 border-t border-wc-border">
                            {/* Puntuación ganada */}
                            <div className="text-xs">
                              {match.status === 'finished' && match.prediction ? (
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold border font-sports text-sm tracking-wider uppercase ${
                                  pointsEarned === 3
                                    ? 'bg-wc-gold/10 border-wc-gold/25 text-wc-gold'
                                    : pointsEarned === 1
                                    ? 'bg-wc-blue/10 border-wc-blue/25 text-wc-blue'
                                    : 'bg-wc-dark border-wc-border text-slate-500'
                                }`}>
                                  <Award className="w-4 h-4" strokeWidth={2.5} />
                                  <span>{pointsEarned} {pointsEarned === 1 ? 'punto' : 'puntos'}</span>
                                </span>
                              ) : match.status === 'finished' && !match.prediction ? (
                                <span className="text-slate-500 font-medium font-sports tracking-wide uppercase">Sin pronóstico (0 pts)</span>
                              ) : match.prediction ? (
                                <span className="text-xs text-slate-400 font-bold flex items-center gap-1.5 font-sports uppercase tracking-wider">
                                  <CheckCircle2 className="w-4.5 h-4.5 text-wc-gold animate-pulse" strokeWidth={2.5} />
                                  <span>Guardado</span>
                                </span>
                              ) : (
                                <span className="text-xs text-wc-gold font-bold flex items-center gap-1.5 font-sports uppercase tracking-wider">
                                  <AlertTriangle className="w-4.5 h-4.5 text-wc-gold" strokeWidth={2.5} />
                                  <span>Sin pronóstico</span>
                                </span>
                              )}
                            </div>

                            {/* Botón guardar individual */}
                            {canSaveIndividual && (
                              <button
                                type="button"
                                onClick={() => handleSaveIndividual(match.id)}
                                disabled={savingIds[match.id]}
                                className="px-4 py-1.5 bg-gradient-to-r from-wc-gold to-amber-500 hover:from-amber-400 hover:to-wc-gold text-slate-950 font-bold rounded-lg text-xs font-sports uppercase tracking-wider transition-all cursor-pointer shadow-sm shadow-wc-gold/10"
                              >
                                {savingIds[match.id] ? '...' : 'Guardar'}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : activeSubTab === 'tabla' ? (
            // Simulated standings tab
            <div className="space-y-8 animate-fade-in">
              <div className="bg-wc-card/90 border border-wc-border p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="text-center md:text-left">
                  <h4 className="text-wc-gold font-bold uppercase font-sports tracking-wider text-lg">Simulador de Posiciones</h4>
                  <p className="text-sm sm:text-base text-slate-400 mt-1.5 leading-relaxed">
                    Esta tabla simula las posiciones en tiempo real en base a tus pronósticos actuales (guardados o modificados temporalmente arriba) combinados con los marcadores oficiales de los partidos jugados.
                  </p>
                </div>
              </div>

              {/* Standings Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-6">
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
                          {teams.map((team, idx) => renderSimulatedTeamRow(team, idx, false))}
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

              {/* Third Places Comparison */}
              <div className="space-y-4">
                <div className="gold-banner p-4 rounded-xl flex items-start gap-3">
                  <Award className="w-6 h-6 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold uppercase font-sports tracking-wider">Clasificación Simulada de Terceros</h4>
                    <p className="text-sm leading-relaxed mt-1">
                      En base a tus pronósticos actuales, se compara a las selecciones en el 3er lugar de cada grupo. Los <strong>8 mejores terceros</strong> avanzan a la siguiente ronda (Dieciseisavos).
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
                        {thirdPlaces.map((team, idx) => renderSimulatedTeamRow(team, idx, true))}
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
            </div>
          ) : (
            <div className="animate-fade-in">
              <KnockoutBracket groupStandings={groupStandings} thirdPlaces={thirdPlaces} isSimulation={true} />
            </div>
          )}
        </>
      )}

      {showFloatingSave && unpredictedCount > 0 && !loading && (
        <button
          onClick={handleSaveBulk}
          disabled={bulkSaving}
          className="fixed bottom-6 right-6 z-50 flex items-center justify-center bg-gradient-to-r from-wc-gold to-amber-500 hover:from-amber-400 hover:to-wc-gold text-slate-950 font-bold font-sports shadow-xl shadow-wc-gold/30 rounded-full md:rounded-xl md:px-5 md:py-3 w-12 h-12 md:w-auto md:h-auto transition-all duration-300 transform hover:scale-105 active:scale-95 disabled:opacity-50 cursor-pointer animate-fade-in"
          title="Guardar Todo"
        >
          {bulkSaving ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <Save className="w-5 h-5 md:mr-2" strokeWidth={2.5} />
              <span className="hidden md:inline">Guardar Todo</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}
