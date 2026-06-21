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
  const [selectedEntryId, setSelectedEntryId] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const entryIdParam = params.get('entry');
      if (entryIdParam) {
        const parsed = parseInt(entryIdParam);
        if (userEntries.some((e) => e.id === parsed)) {
          return parsed;
        }
      }
    }
    return userEntries[0]?.id || 0;
  });

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
  const [activeGroup, setActiveGroup] = useState<string>('Grupo A');
  const [viewMode, setViewMode] = useState<'grupos' | 'cronologico' | 'fechas'>('grupos');
  const [activeDate, setActiveDate] = useState<string>('');
  
  // Estado local para los inputs: record de matchId -> { home, away }
  const [inputs, setInputs] = useState<Record<number, { home: string; away: string }>>({});
  const [savingIds, setSavingIds] = useState<Record<number, boolean>>({});
  const [bulkSaving, setBulkSaving] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<Record<number, string>>({});
  const [showFloatingSave, setShowFloatingSave] = useState(false);

  // Estado para el autoguardado
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saving-pending' | 'saving' | 'saved' | 'error'>('idle');
  const autosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
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

  // Helper para identificar predicciones modificadas completas
  const getUnsavedPredictions = () => {
    return matches
      .filter((m) => !isLocked(m.match_time))
      .map((m) => {
        const input = inputs[m.id];
        const savedHome = m.prediction ? String(m.prediction.predicted_home) : '';
        const savedAway = m.prediction ? String(m.prediction.predicted_away) : '';
        const hasChanges = input && (input.home !== savedHome || input.away !== savedAway);
        const isComplete = input && input.home !== '' && input.away !== '';
        
        if (hasChanges && isComplete) {
          return {
            matchId: m.id,
            predictedHome: input.home,
            predictedAway: input.away,
          };
        }
        return null;
      })
      .filter((p): p is { matchId: number; predictedHome: string; predictedAway: string } => p !== null);
  };

  // Efecto de autoguardado (debounce de 1.5 segundos)
  useEffect(() => {
    const unsaved = getUnsavedPredictions();
    
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
      autosaveTimeoutRef.current = null;
    }

    if (unsaved.length > 0) {
      setAutosaveStatus('saving-pending');
      autosaveTimeoutRef.current = setTimeout(async () => {
        setAutosaveStatus('saving');
        try {
          const response = await fetch('/api/predictions/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              entryId: selectedEntryId,
              predictions: unsaved,
            }),
          });

          if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || 'Error al guardar automáticamente');
          }

          // Actualizar datos de partidos sin disparar spinner global
          await fetchMatchesAndPredictions(true);
          setAutosaveStatus('saved');
          
          // Ocultar mensaje flotante de éxito tras 3 segundos
          setTimeout(() => {
            setAutosaveStatus(current => current === 'saved' ? 'idle' : current);
          }, 3000);
        } catch (err: any) {
          console.error('Autosave error:', err);
          setAutosaveStatus('error');
        }
      }, 1500);
    } else {
      setAutosaveStatus(prev => prev === 'saving-pending' ? 'idle' : prev);
    }

    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }
    };
  }, [inputs, matches, selectedEntryId]);

  const fetchMatchesAndPredictions = async (isSilent = false) => {
    if (!selectedEntryId) return;
    if (!isSilent) setLoading(true);
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

      // Rellenar inputs iniciales manteniendo cambios locales
      setInputs((prevInputs) => {
        const mergedInputs: Record<number, { home: string; away: string }> = {};
        data.matches.forEach((match: Match) => {
          const matchId = match.id;
          const oldMatch = matches.find(m => m.id === matchId);
          const oldPredictionHome = oldMatch?.prediction ? String(oldMatch.prediction.predicted_home) : '';
          const oldPredictionAway = oldMatch?.prediction ? String(oldMatch.prediction.predicted_away) : '';
          
          const prevVal = prevInputs[matchId];
          const hasLocalChanges = prevVal && (prevVal.home !== oldPredictionHome || prevVal.away !== oldPredictionAway);

          if (hasLocalChanges) {
            mergedInputs[matchId] = prevVal;
          } else {
            mergedInputs[matchId] = {
              home: match.prediction ? String(match.prediction.predicted_home) : '',
              away: match.prediction ? String(match.prediction.predicted_away) : '',
            };
          }
        });
        return mergedInputs;
      });
      return data.matches;
    } catch (err: any) {
      if (!isSilent) setError(err.message || 'Error de conexión');
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatchesAndPredictions();
  }, [selectedEntryId]);

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



  // Actualizar temporizadores (countdown de 5 minutos antes de cada partido)
  useEffect(() => {
    const updateCountdowns = () => {
      const remaining: Record<number, string> = {};
      matches.forEach((match) => {
        const matchTime = new Date(match.match_time).getTime();
        const lockTime = matchTime - 5 * 60 * 1000; // 5 minutos antes
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

  function isLocked(matchTimeStr: string) {
    const matchTime = new Date(matchTimeStr).getTime();
    const lockTime = matchTime - 5 * 60 * 1000;
    return Date.now() >= lockTime;
  }

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
      await fetchMatchesAndPredictions(true);
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

      const updatedMatches = await fetchMatchesAndPredictions(true);
      if (updatedMatches) {
        const remaining = updatedMatches.filter((m: any) => !m.prediction && !isLocked(m.match_time)).length;
        if (remaining === 0) {
          showAlert.success('¡Completado!', '¡Todas tus predicciones se guardaron correctamente! Has llenado todos los pronósticos para esta fase.');
        } else {
          showAlert.success(
            '¡Guardado!',
            `Tus predicciones se guardaron correctamente. Te queda${remaining === 1 ? ' solo' : 'n'} ${remaining} pronóstico${remaining === 1 ? '' : 's'} por llenar.`
          );
        }
      } else {
        showAlert.success('Éxito', '¡Todas tus predicciones se guardaron correctamente!');
      }
    } catch (err: any) {
      showAlert.error('Error', err.message);
    } finally {
      setBulkSaving(false);
    }
  };

  // Verificar si hay algún partido sin predicción guardada
  const unpredictedCount = matches.filter((m) => !m.prediction && !isLocked(m.match_time)).length;

  // Obtener la lista de fechas únicas con partidos de manera ordenada
  const dateTabs = useMemo(() => {
    const todayStr = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

    // Set today at 00:00:00 to filter matches strictly from today onwards
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const dateList: { key: string; label: string }[] = [];
    const seen = new Set<string>();

    const sorted = [...matches].sort((a, b) => new Date(a.match_time).getTime() - new Date(b.match_time).getTime());

    sorted.forEach((m) => {
      const matchDate = new Date(m.match_time);
      // Solo mostrar los días desde hoy en adelante
      if (matchDate.getTime() < todayStart.getTime()) {
        return;
      }

      const dateKey = matchDate.toLocaleDateString('es-ES', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      });
      if (!seen.has(dateKey)) {
        seen.add(dateKey);
        let label = dateKey;
        // Capitalizar la primera letra
        label = label.charAt(0).toUpperCase() + label.slice(1);
        
        // Etiquetas relativas amigables
        if (dateKey === todayStr) {
          label = `Hoy (${label})`;
        } else if (dateKey === tomorrowStr) {
          label = `Mañana (${label})`;
        }
        
        dateList.push({ key: dateKey, label });
      }
    });
    
    return dateList;
  }, [matches]);

  // Inicializar activeDate dinámicamente
  useEffect(() => {
    if (viewMode === 'fechas' && dateTabs.length > 0) {
      const todayStr = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
      const hasToday = dateTabs.find(d => d.key === todayStr);
      if (hasToday) {
        setActiveDate(hasToday.key);
      } else {
        // Si no hay partidos de "hoy", seleccionar la primera pestaña disponible (que será el día más cercano del futuro)
        setActiveDate(dateTabs[0].key);
      }
    }
  }, [viewMode, dateTabs]);

  // Filtrar partidos por grupo si estamos en fase de grupos o aplicar orden cronológico / fechas
  const filteredMatches = useMemo(() => {
    if (phaseSlug !== 'grupos') return matches;
    if (viewMode === 'cronologico') {
      return [...matches].sort((a, b) => new Date(a.match_time).getTime() - new Date(b.match_time).getTime());
    }
    if (viewMode === 'fechas') {
      return matches.filter((m) => {
        const dateKey = new Date(m.match_time).toLocaleDateString('es-ES', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        });
        return dateKey === activeDate;
      });
    }
    return matches.filter((m) => m.group_name === activeGroup);
  }, [matches, phaseSlug, activeGroup, viewMode, activeDate]);

  // Agrupar partidos por fecha para orden visual premium
  const groupedMatches: Record<string, Match[]> = {};
  filteredMatches.forEach((match) => {
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
              {phaseSlug === 'grupos' && activeSubTab === 'pronosticos' && (
                <div className="space-y-4">
                  {/* Selector de modo de ordenamiento */}
                  <div className="flex items-center gap-3 border-l-2 border-wc-blue/40 pl-3">
                    <span className="text-[10px] uppercase font-sports tracking-wider text-slate-500 font-bold hidden xs:inline">
                      Visualizar:
                    </span>
                    <div className="flex bg-wc-dark/95 border border-wc-border rounded-xl p-1 shadow-inner w-fit">
                      <button
                        type="button"
                        onClick={() => setViewMode('grupos')}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold font-sports uppercase tracking-wider transition-all cursor-pointer ${
                          viewMode === 'grupos'
                            ? 'bg-wc-blue text-slate-900 shadow-md font-extrabold'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Por Grupos
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode('cronologico')}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold font-sports uppercase tracking-wider transition-all cursor-pointer ${
                          viewMode === 'cronologico'
                            ? 'bg-wc-blue text-slate-900 shadow-md font-extrabold'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Cronológico
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode('fechas')}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold font-sports uppercase tracking-wider transition-all cursor-pointer ${
                          viewMode === 'fechas'
                            ? 'bg-wc-blue text-slate-900 shadow-md font-extrabold'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Por Fechas
                      </button>
                    </div>
                  </div>

                  {/* Barra de grupos (solo visible en modo 'grupos') */}
                  {viewMode === 'grupos' && (
                    <div className="flex items-center gap-2 overflow-x-auto pb-3 border-b border-wc-border/30 custom-scrollbar animate-fade-in">
                      {['Grupo A', 'Grupo B', 'Grupo C', 'Grupo D', 'Grupo E', 'Grupo F', 'Grupo G', 'Grupo H', 'Grupo I', 'Grupo J', 'Grupo K', 'Grupo L'].map((groupName) => (
                        <button
                          key={groupName}
                          type="button"
                          onClick={() => setActiveGroup(groupName)}
                          className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border whitespace-nowrap transition-all duration-200 font-sports cursor-pointer shrink-0 ${
                            activeGroup === groupName
                              ? 'bg-gradient-to-r from-wc-gold to-amber-500 text-slate-950 border-transparent shadow-md shadow-wc-gold/20'
                              : 'bg-wc-dark border-wc-border text-slate-400 hover:text-slate-200 hover:border-slate-700'
                          }`}
                        >
                          {groupName}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Barra de fechas (solo visible en modo 'fechas') */}
                  {viewMode === 'fechas' && (
                    <div className="flex items-center gap-2 overflow-x-auto pb-3 border-b border-wc-border/30 custom-scrollbar animate-fade-in">
                      {dateTabs.map((dateObj) => (
                        <button
                          key={dateObj.key}
                          type="button"
                          onClick={() => setActiveDate(dateObj.key)}
                          className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border whitespace-nowrap transition-all duration-200 font-sports cursor-pointer shrink-0 ${
                            activeDate === dateObj.key
                              ? 'bg-gradient-to-r from-wc-gold to-amber-500 text-slate-950 border-transparent shadow-md shadow-wc-gold/20'
                              : 'bg-wc-dark border-wc-border text-slate-400 hover:text-slate-200 hover:border-slate-700'
                          }`}
                        >
                          {dateObj.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
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
                          className={`p-4 sm:p-5 rounded-2xl border transition-all duration-300 flex flex-col justify-between ${
                            locked
                              ? 'border-wc-border bg-wc-dark/30 opacity-90'
                              : hasChanges
                              ? 'border-wc-gold/30 bg-wc-gold/5 animate-pulse'
                              : match.prediction
                              ? 'border-wc-gold/25 bg-wc-card/50'
                              : 'border-wc-border bg-wc-card'
                          }`}
                        >
                          {/* Header: Grupo + Estado */}
                          <div className="flex justify-between items-center text-xs text-slate-500 mb-4 pb-2.5 border-b border-wc-border/50">
                            <div className="flex items-center gap-2">
                              {match.group_name && (
                                <span className="font-bold text-slate-300 font-sports uppercase tracking-wider text-xs sm:text-sm">{match.group_name}</span>
                              )}
                            </div>

                            {/* Estado o cuenta regresiva */}
                            <div className="flex items-center gap-1.5 font-bold text-xs">
                              {match.status === 'live' ? (
                                <span className="px-2.5 py-1 bg-wc-red/10 text-wc-red rounded-lg border border-wc-red/20 animate-pulse text-xs uppercase tracking-wider flex items-center gap-1 font-sports">
                                  <span className="w-1.5 h-1.5 rounded-full bg-wc-red inline-block animate-ping"></span>
                                  <span>En vivo</span>
                                </span>
                              ) : match.status === 'finished' ? (
                                <span className="px-2.5 py-1 bg-wc-dark text-slate-400 rounded-lg border border-wc-border text-xs uppercase tracking-wider font-sports font-bold">
                                  Finalizado
                                </span>
                              ) : (
                                <span className={`flex items-center gap-1 font-sports ${locked ? 'text-wc-red' : 'text-wc-gold'}`}>
                                  {locked ? (
                                    <Lock className="w-3.5 h-3.5 shrink-0 text-wc-red" strokeWidth={2.5} />
                                  ) : (
                                    <Clock className="w-3.5 h-3.5 shrink-0 text-wc-gold animate-pulse" strokeWidth={2.5} />
                                  )}
                                  <span className="text-[11px]">{countdown}</span>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Equipos y Marcador - Layout vertical para mobile */}
                          <div className="flex items-start justify-between gap-2 sm:gap-4 my-1">
                            {/* Local - Vertical: Bandera encima, nombre debajo */}
                            <div className="flex-1 flex flex-col items-center text-center min-w-0 gap-1.5">
                              {getTeamFlagUrl(match.home_team) ? (
                                <img
                                  src={getTeamFlagUrl(match.home_team)!}
                                  alt={`Bandera de ${match.home_team}`}
                                  className="w-10 h-7 sm:w-12 sm:h-8 object-cover rounded-md shadow-md border border-slate-700/50"
                                />
                              ) : (
                                <div className="w-10 h-7 sm:w-12 sm:h-8 bg-slate-700 rounded-md"></div>
                              )}
                              <span
                                className="font-bold text-slate-200 text-[11px] sm:text-xs md:text-sm font-sports uppercase tracking-wide leading-tight text-center max-w-[95px] sm:max-w-[130px]"
                                title={match.home_team}
                              >
                                {match.home_team}
                              </span>
                            </div>

                            {/* Marcador Central / Pronóstico */}
                            <div className="flex flex-col items-center justify-center flex-shrink-0 gap-0.5 pt-0.5">
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  maxLength={2}
                                  value={input.home}
                                  onChange={(e) => handleInputChange(match.id, 'home', e.target.value)}
                                  disabled={locked}
                                  placeholder="-"
                                  className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-wc-dark text-center text-base sm:text-lg font-bold font-sports border focus:outline-none focus:ring-2 focus:ring-wc-gold/40 transition-all ${
                                    locked
                                      ? 'border-wc-border text-slate-400 cursor-not-allowed bg-wc-dark/55'
                                      : 'border-wc-border text-wc-gold focus:border-wc-gold'
                                  }`}
                                />
                                <span className="text-slate-500 font-bold text-base font-sports">-</span>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  maxLength={2}
                                  value={input.away}
                                  onChange={(e) => handleInputChange(match.id, 'away', e.target.value)}
                                  disabled={locked}
                                  placeholder="-"
                                  className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-wc-dark text-center text-base sm:text-lg font-bold font-sports border focus:outline-none focus:ring-2 focus:ring-wc-gold/40 transition-all ${
                                    locked
                                      ? 'border-wc-border text-slate-400 cursor-not-allowed bg-wc-dark/55'
                                      : 'border-wc-border text-wc-gold focus:border-wc-gold'
                                  }`}
                                />
                              </div>
                            </div>

                            {/* Visitante - Vertical: Bandera encima, nombre debajo */}
                            <div className="flex-1 flex flex-col items-center text-center min-w-0 gap-1.5">
                              {getTeamFlagUrl(match.away_team) ? (
                                <img
                                  src={getTeamFlagUrl(match.away_team)!}
                                  alt={`Bandera de ${match.away_team}`}
                                  className="w-10 h-7 sm:w-12 sm:h-8 object-cover rounded-md shadow-md border border-slate-700/50"
                                />
                              ) : (
                                <div className="w-10 h-7 sm:w-12 sm:h-8 bg-slate-700 rounded-md"></div>
                              )}
                              <span
                                className="font-bold text-slate-200 text-[11px] sm:text-xs md:text-sm font-sports uppercase tracking-wide leading-tight text-center max-w-[95px] sm:max-w-[130px]"
                                title={match.away_team}
                              >
                                {match.away_team}
                              </span>
                            </div>
                          </div>

                          {/* Sección de Resultado Real / Estado del Pronóstico */}
                          <div className="mt-4 pt-3 border-t border-wc-border/50 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-bold font-sports uppercase tracking-wider shrink-0">
                              {match.status === 'live' || match.status === 'finished' ? (
                                <span>Resultado:</span>
                              ) : match.prediction ? (
                                <span className="text-slate-400 font-bold flex items-center gap-1 font-sports uppercase tracking-wider text-[10px] sm:text-xs">
                                  <CheckCircle2 className="w-4 h-4 text-wc-gold" strokeWidth={2.5} />
                                  <span className="hidden sm:inline">Pronóstico Guardado</span>
                                </span>
                              ) : (
                                <span className="text-wc-gold font-bold flex items-center gap-1 font-sports uppercase tracking-wider text-[10px] sm:text-xs">
                                  <AlertTriangle className="w-4 h-4 text-wc-gold animate-pulse" strokeWidth={2.5} />
                                  <span className="hidden sm:inline">Sin Pronóstico</span>
                                </span>
                              )}
                            </div>

                            {/* Marcador Real */}
                            {(match.status === 'live' || match.status === 'finished') && (
                              <div className="flex items-center gap-2 px-2.5 py-1 bg-wc-dark rounded-xl border border-wc-border font-sports font-black text-xs sm:text-sm text-slate-200 shadow-inner">
                                <span className={match.status === 'live' ? 'text-wc-red animate-pulse' : ''}>{match.home_score}</span>
                                <span className="text-slate-500 font-normal">vs</span>
                                <span className={match.status === 'live' ? 'text-wc-red animate-pulse' : ''}>{match.away_score}</span>
                              </div>
                            )}

                            {/* Puntuación o Estado */}
                            <div className="text-xs shrink-0">
                              {match.status === 'finished' && match.prediction ? (
                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg font-bold border font-sports text-[11px] sm:text-xs tracking-wider uppercase ${
                                  pointsEarned === 3
                                    ? 'bg-wc-gold/10 border-wc-gold/25 text-wc-gold'
                                    : pointsEarned === 1
                                    ? 'bg-wc-blue/10 border-wc-blue/25 text-wc-blue'
                                    : 'bg-wc-dark border-wc-border text-slate-500'
                                }`}>
                                  <Award className="w-3.5 h-3.5" strokeWidth={2.5} />
                                  <span>{pointsEarned} pts</span>
                                </span>
                              ) : match.status === 'finished' && !match.prediction ? (
                                <span className="text-slate-500 font-medium font-sports tracking-wide uppercase text-[10px] sm:text-xs">0 pts</span>
                              ) : null}
                            </div>
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

      {showFloatingSave && !loading && (unpredictedCount > 0 || getUnsavedPredictions().length > 0) && (
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

      {/* Toast de Autoguardado */}
      {autosaveStatus !== 'idle' && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 md:left-auto md:right-6 md:translate-x-0 transition-all duration-300 animate-fade-in w-[90%] max-w-xs sm:max-w-sm">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-2xl bg-wc-card/95 ${
            autosaveStatus === 'saved'
              ? 'border-wc-green/70 text-wc-green'
              : autosaveStatus === 'saving' || autosaveStatus === 'saving-pending'
              ? 'border-wc-gold/70 text-wc-gold animate-pulse'
              : 'border-wc-red/70 text-wc-red'
          }`}>
            {autosaveStatus === 'saved' ? (
              <>
                <CheckCircle2 className="w-5 h-5 text-wc-green shrink-0 animate-bounce" strokeWidth={2.5} />
                <span className="text-xs sm:text-sm font-bold font-sports uppercase tracking-wider">Pronósticos guardados</span>
              </>
            ) : autosaveStatus === 'saving' || autosaveStatus === 'saving-pending' ? (
              <>
                <Loader2 className="w-5 h-5 text-wc-gold shrink-0 animate-spin" strokeWidth={2.5} />
                <span className="text-xs sm:text-sm font-bold font-sports uppercase tracking-wider">Guardando...</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-5 h-5 text-wc-red shrink-0" strokeWidth={2.5} />
                <span className="text-xs sm:text-sm font-bold font-sports uppercase tracking-wider">Error al guardar</span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
