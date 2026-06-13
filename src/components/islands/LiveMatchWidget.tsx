import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase-browser';
import { Activity, Calendar, Clock, Lock, Save, Check, Loader2 } from 'lucide-react';
import { getTeamFlagUrl } from '../../utils/flags';
import { showAlert } from '../../utils/alerts';

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
}

interface Entry {
  id: number;
  display_name: string;
}

interface LiveMatchWidgetProps {
  approvedEntries?: Entry[];
}

export default function LiveMatchWidget({ approvedEntries = [] }: LiveMatchWidgetProps) {
  const [liveMatches, setLiveMatches] = useState<Match[]>([]);
  const [nextMatch, setNextMatch] = useState<Match | null>(null);
  const [timeLeft, setTimeLeft] = useState('');
  const [loading, setLoading] = useState(true);

  // Estados para Predicciones
  const [selectedEntryId, setSelectedEntryId] = useState<number>(() => {
    return approvedEntries[0]?.id || 0;
  });
  const [predictionsMap, setPredictionsMap] = useState<Record<number, { id?: number; home: string; away: string }>>({});
  const [inputs, setInputs] = useState<Record<number, { home: string; away: string }>>({});
  const [savingIds, setSavingIds] = useState<Record<number, boolean>>({});
  const [successIds, setSuccessIds] = useState<Record<number, boolean>>({});

  const activeMatchIds = React.useMemo(() => {
    const ids: number[] = [];
    liveMatches.forEach(m => ids.push(m.id));
    if (nextMatch) ids.push(nextMatch.id);
    return ids;
  }, [liveMatches, nextMatch]);

  const fetchMatchesData = async () => {
    try {
      const response = await fetch('/api/matches/live');
      if (!response.ok) throw new Error('Error al consultar /api/matches/live');
      
      const data = await response.json();
      setLiveMatches(data.liveMatches || []);
      setNextMatch(data.nextMatch || null);
    } catch (e) {
      console.error('Error al cargar datos del widget de partidos:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchPredictions = async () => {
    console.log('fetchPredictions started. entryId:', selectedEntryId, 'matchIds:', activeMatchIds);
    if (!selectedEntryId || activeMatchIds.length === 0) {
      console.log('fetchPredictions early return');
      return;
    }
    try {
      const response = await fetch(`/api/predictions/active?entryId=${selectedEntryId}&matchIds=${activeMatchIds.join(',')}`);
      if (!response.ok) throw new Error('Error al consultar /api/predictions/active');
      
      const data = await response.json();
      const predictions = data.predictions || [];

      console.log('fetchPredictions query result:', predictions);

      if (predictions) {
        const mapping: Record<number, { id?: number; home: string; away: string }> = {};
        const newInputs: Record<number, { home: string; away: string }> = {};
        
        predictions.forEach((p: any) => {
          mapping[p.match_id] = {
            id: p.id,
            home: String(p.predicted_home),
            away: String(p.predicted_away)
          };
          newInputs[p.match_id] = {
            home: String(p.predicted_home),
            away: String(p.predicted_away)
          };
        });
        
        setPredictionsMap(mapping);
        setInputs(prev => {
          const merged = { ...prev };
          activeMatchIds.forEach(matchId => {
            const hasSaved = newInputs[matchId];
            if (hasSaved) {
              if (!merged[matchId] || merged[matchId].home === '' || merged[matchId].away === '') {
                merged[matchId] = hasSaved;
              }
            } else if (!merged[matchId]) {
              merged[matchId] = { home: '', away: '' };
            }
          });
          return merged;
        });
      }
    } catch (e) {
      console.error('Error al cargar predicciones para el widget:', e);
    }
  };

  useEffect(() => {
    fetchMatchesData();

    // Polling de respaldo cada 30 segundos para asegurar actualización de marcadores en vivo
    const pollInterval = setInterval(fetchMatchesData, 30000);

    // Suscribirse a cambios en la tabla 'matches' en tiempo real
    const channel = supabase
      .channel('public:matches-sidebar-widget')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches' },
        () => {
          fetchMatchesData();
        }
      )
      .subscribe();

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (approvedEntries.length > 0 && !selectedEntryId) {
      setSelectedEntryId(approvedEntries[0].id);
    }
  }, [approvedEntries]);

  useEffect(() => {
    fetchPredictions();
  }, [selectedEntryId, activeMatchIds.join(',')]);

  // Intervalo de cuenta regresiva para el siguiente partido
  useEffect(() => {
    if (!nextMatch) return;

    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const startTime = new Date(nextMatch.match_time).getTime();
      const diff = startTime - now;

      if (diff <= 0) {
        setTimeLeft('¡Comenzando!');
        fetchMatchesData();
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      let timeStr = '';
      if (days > 0) {
        timeStr = `${days}d ${hours}h ${minutes}m`;
      } else if (hours > 0) {
        timeStr = `${hours}h ${minutes}m ${seconds}s`;
      } else {
        timeStr = `${minutes}m ${seconds}s`;
      }
      setTimeLeft(timeStr);
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [nextMatch]);

  const handleInputChange = (matchId: number, field: 'home' | 'away', val: string) => {
    if (val !== '' && !/^\d+$/.test(val)) return;
    setInputs(prev => ({
      ...prev,
      [matchId]: {
        ...prev[matchId],
        [field]: val
      }
    }));
  };

  const isLocked = (matchTimeStr: string) => {
    const matchTime = new Date(matchTimeStr).getTime();
    const lockTime = matchTime - 30 * 60 * 1000;
    return Date.now() >= lockTime;
  };

  const handleSavePrediction = async (matchId: number) => {
    const input = inputs[matchId];
    if (!input || input.home === '' || input.away === '') return;

    const match = liveMatches.find(m => m.id === matchId) || (nextMatch?.id === matchId ? nextMatch : null);
    if (!match || isLocked(match.match_time)) {
      showAlert.warning('Advertencia', 'Este partido ya está bloqueado para predicciones.');
      return;
    }

    const savedPred = predictionsMap[matchId];
    setSavingIds(prev => ({ ...prev, [matchId]: true }));

    try {
      let response;
      if (savedPred && savedPred.id) {
        response = await fetch(`/api/predictions/${savedPred.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            predictedHome: input.home,
            predictedAway: input.away
          })
        });
      } else {
        response = await fetch('/api/predictions/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entryId: selectedEntryId,
            predictions: [
              {
                matchId: matchId,
                predictedHome: input.home,
                predictedAway: input.away
              }
            ]
          })
        });
      }

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Error al guardar la predicción');
      }

      setSuccessIds(prev => ({ ...prev, [matchId]: true }));
      setTimeout(() => {
        setSuccessIds(prev => ({ ...prev, [matchId]: false }));
      }, 2000);

      await fetchPredictions();
    } catch (e: any) {
      console.error(e);
      showAlert.error('Error', e.message || 'Error al guardar la predicción');
    } finally {
      setSavingIds(prev => ({ ...prev, [matchId]: false }));
    }
  };

  const renderPredictionSection = (match: Match) => {
    if (approvedEntries.length === 0) return null;

    const matchId = match.id;
    const isMatchLocked = match.status !== 'scheduled' || isLocked(match.match_time);
    const savedPred = predictionsMap[matchId];
    const currentInput = inputs[matchId] || { home: '', away: '' };
    const hasPrediction = !!savedPred;
    
    const isInputComplete = currentInput.home !== '' && currentInput.away !== '';
    const isInputChanged =
      !savedPred ||
      currentInput.home !== String(savedPred.home) ||
      currentInput.away !== String(savedPred.away);
      
    const isSaving = !!savingIds[matchId];
    const isSuccess = !!successIds[matchId];

    return (
      <div className="mt-4 pt-3.5 border-t border-wc-border/30">
        {approvedEntries.length > 1 && (
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] uppercase font-bold text-slate-400 font-sports tracking-wider">
              Predicción de cupo:
            </span>
            <select
              value={selectedEntryId}
              onChange={(e) => setSelectedEntryId(Number(e.target.value))}
              className="text-xs bg-wc-dark border border-wc-border rounded-lg px-2 py-1 text-slate-250 font-bold font-sports cursor-pointer focus:outline-none focus:border-wc-gold/50"
            >
              {approvedEntries.map(entry => (
                <option key={entry.id} value={entry.id}>
                  {entry.display_name}
                </option>
              ))}
            </select>
          </div>
        )}

        {isMatchLocked ? (
          <div className="flex items-center justify-between bg-wc-dark/30 border border-wc-border/20 rounded-xl px-3.5 py-2 text-xs">
            <span className="text-slate-400 flex items-center gap-1.5 font-medium">
              <Lock className="w-3.5 h-3.5 text-slate-500" />
              Tu Pronóstico:
            </span>
            <span className="font-extrabold text-slate-200 font-sports">
              {hasPrediction ? `${savedPred.home} - ${savedPred.away}` : 'Sin pronóstico'}
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-slate-400 font-bold font-sports shrink-0">Tu Pronóstico:</span>
            
            <div className="flex items-center gap-1.5 ml-auto">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={currentInput.home}
                onChange={(e) => handleInputChange(matchId, 'home', e.target.value)}
                className="w-10 h-8 text-center bg-wc-dark border border-wc-border rounded-lg text-sm font-bold text-slate-100 font-sports focus:outline-none focus:border-wc-gold transition-colors"
                placeholder="-"
              />
              <span className="text-slate-500 font-bold">:</span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={currentInput.away}
                onChange={(e) => handleInputChange(matchId, 'away', e.target.value)}
                className="w-10 h-8 text-center bg-wc-dark border border-wc-border rounded-lg text-sm font-bold text-slate-100 font-sports focus:outline-none focus:border-wc-gold transition-colors"
                placeholder="-"
              />
              
              <button
                onClick={() => handleSavePrediction(matchId)}
                disabled={isSaving || !isInputComplete || (!isInputChanged && hasPrediction)}
                className={`p-2 rounded-lg transition-all duration-200 flex items-center justify-center shrink-0 cursor-pointer ${
                  isSuccess
                    ? 'bg-wc-green/20 text-wc-green border border-wc-green/30'
                    : isInputChanged && isInputComplete
                    ? 'bg-gradient-to-r from-wc-gold to-amber-500 hover:from-amber-400 hover:to-wc-gold text-slate-950 shadow-md shadow-wc-gold/15'
                    : 'bg-wc-dark text-slate-500 border border-wc-border opacity-60 cursor-not-allowed'
                }`}
                title="Guardar pronóstico"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                ) : isSuccess ? (
                  <Check className="w-4 h-4 text-wc-green" strokeWidth={3} />
                ) : (
                  <Save className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="p-5 rounded-2xl bg-wc-card border border-wc-border/50 animate-pulse space-y-4">
        <div className="flex justify-between items-center border-b border-wc-border pb-2.5">
          <div className="h-4 bg-wc-border rounded w-1/3"></div>
          <div className="h-4 bg-wc-border rounded w-1/6"></div>
        </div>
        <div className="h-12 bg-wc-border rounded w-full"></div>
      </div>
    );
  }

  // Caso 1: Hay partidos en vivo
  if (liveMatches.length > 0) {
    return (
      <div className="space-y-4">
        {liveMatches.map((match) => (
          <div
            key={match.id}
            className="p-5 rounded-2xl bg-gradient-to-br from-wc-card to-wc-dark/10 border border-wc-red/35 backdrop-blur-sm relative overflow-hidden shadow-lg shadow-wc-red/5"
          >
            {/* Decoración de fondo */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-wc-red/10 rounded-full blur-2xl pointer-events-none"></div>
            <div className="absolute -bottom-10 -left-10 w-28 h-28 bg-wc-blue/5 rounded-full blur-2xl pointer-events-none"></div>

            {/* Header */}
            <div className="flex justify-between items-center border-b border-wc-border/50 pb-2.5 mb-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 font-sports">
                <Activity className="w-4 h-4 text-wc-red animate-pulse" strokeWidth={2.5} />
                Partido en Vivo
              </h3>
              <span className="px-2 py-0.5 rounded bg-wc-red/15 text-wc-red border border-wc-red/25 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1 animate-pulse font-sports">
                <span className="w-1.5 h-1.5 rounded-full bg-wc-red"></span>
                En Vivo
              </span>
            </div>

            {/* Contenido Principal: Marcador Grande */}
            <div className="flex items-center justify-between gap-4 my-2">
              {/* Local */}
              <div className="flex-1 flex flex-col items-center text-center min-w-0">
                {getTeamFlagUrl(match.home_team) && (
                  <img
                    src={getTeamFlagUrl(match.home_team)!}
                    alt={`Bandera de ${match.home_team}`}
                    className="w-10 h-7 object-cover rounded-md shadow-md border border-slate-700/60 transition-transform hover:scale-105"
                  />
                )}
                <span className="font-extrabold text-slate-200 text-xs sm:text-sm font-sports tracking-wide uppercase mt-2 whitespace-normal text-center max-w-full" title={match.home_team}>
                  {match.home_team}
                </span>
              </div>

              {/* Score */}
              <div className="flex flex-col items-center justify-center flex-shrink-0">
                <div className="flex items-center gap-2 px-4 py-2 bg-wc-dark/90 rounded-2xl border border-wc-border font-sports font-black text-xl text-slate-100 min-w-[5.5rem] justify-center shadow-inner">
                  <span className="text-wc-red animate-pulse">{match.home_score}</span>
                  <span className="text-slate-455 font-normal">:</span>
                  <span className="text-wc-red animate-pulse">{match.away_score}</span>
                </div>
              </div>

              {/* Visitante */}
              <div className="flex-1 flex flex-col items-center text-center min-w-0">
                {getTeamFlagUrl(match.away_team) && (
                  <img
                    src={getTeamFlagUrl(match.away_team)!}
                    alt={`Bandera de ${match.away_team}`}
                    className="w-10 h-7 object-cover rounded-md shadow-md border border-slate-700/60 transition-transform hover:scale-105"
                  />
                )}
                <span className="font-extrabold text-slate-200 text-xs sm:text-sm font-sports tracking-wide uppercase mt-2 whitespace-normal text-center max-w-full" title={match.away_team}>
                  {match.away_team}
                </span>
              </div>
            </div>

            {/* Sección de Pronóstico */}
            {renderPredictionSection(match)}

            {/* Botón Ver Pronósticos */}
            <div className="mt-3">
              <a
                href="/dashboard/live"
                className="w-full py-2 px-4 rounded-xl bg-wc-dark hover:bg-wc-card text-wc-gold border border-wc-border hover:text-white transition-all duration-200 text-xs font-bold font-sports tracking-wider uppercase flex items-center justify-center gap-1.5"
              >
                <Activity className="w-4 h-4 text-wc-gold" />
                <span>Ver pronósticos del partido</span>
              </a>
            </div>

            {/* Footer: Grupo */}
            {match.group_name && (
              <div className="text-[10px] text-slate-500 font-bold text-center mt-3 pt-2.5 border-t border-wc-border/30 font-sports tracking-wider uppercase">
                {match.group_name}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  // Caso 2: No hay partidos en vivo pero hay un siguiente partido programado
  if (nextMatch) {
    const nextMatchTime = new Date(nextMatch.match_time);
    return (
      <div className="p-5 rounded-2xl bg-wc-card border border-wc-border backdrop-blur-sm relative overflow-hidden shadow-lg shadow-black/5 flex flex-col justify-between">
        {/* Decoración de fondo */}
        <div className="absolute top-0 right-0 w-20 h-20 bg-wc-gold/5 rounded-full blur-xl pointer-events-none"></div>
        <div className="absolute -bottom-8 -left-8 w-20 h-20 bg-slate-500/5 rounded-full blur-xl pointer-events-none"></div>

        {/* Header */}
        <div className="flex justify-between items-center border-b border-wc-border/50 pb-2.5 mb-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-355 flex items-center gap-1.5 font-sports">
            <Calendar className="w-4 h-4 text-wc-gold" strokeWidth={2.5} />
            Siguiente Partido
          </h3>
          <span className="px-2 py-0.5 rounded bg-wc-dark text-slate-450 border border-wc-border font-bold uppercase tracking-wider text-[10px] font-sports">
            Próximamente
          </span>
        </div>

        {/* Contenido Principal: Equipos */}
        <div className="flex items-center justify-between gap-4 my-2">
          {/* Local */}
          <div className="flex-1 flex flex-col items-center text-center min-w-0">
            {getTeamFlagUrl(nextMatch.home_team) && (
              <img
                src={getTeamFlagUrl(nextMatch.home_team)!}
                alt={`Bandera de ${nextMatch.home_team}`}
                className="w-10 h-7 object-cover rounded-md shadow-md border border-slate-700/60"
              />
            )}
            <span className="font-extrabold text-slate-200 text-xs sm:text-sm font-sports tracking-wide uppercase mt-2 whitespace-normal text-center max-w-full" title={nextMatch.home_team}>
              {nextMatch.home_team}
            </span>
          </div>

          {/* VS */}
          <div className="flex flex-col items-center justify-center flex-shrink-0">
            <span className="text-white font-sports font-black text-sm uppercase px-3 py-1 bg-wc-dark rounded-xl border border-wc-border">
              VS
            </span>
          </div>

          {/* Visitante */}
          <div className="flex-1 flex flex-col items-center text-center min-w-0">
            {getTeamFlagUrl(nextMatch.away_team) && (
              <img
                src={getTeamFlagUrl(nextMatch.away_team)!}
                alt={`Bandera de ${nextMatch.away_team}`}
                className="w-10 h-7 object-cover rounded-md shadow-md border border-slate-700/60"
              />
            )}
            <span className="font-extrabold text-slate-200 text-xs sm:text-sm font-sports tracking-wide uppercase mt-2 whitespace-normal text-center max-w-full" title={nextMatch.away_team}>
              {nextMatch.away_team}
            </span>
          </div>
        </div>

        {/* Sección de Pronóstico */}
        {renderPredictionSection(nextMatch)}

        {/* Botón Ver Pronósticos */}
        <div className="mt-3 w-full">
          <a
            href="/dashboard/live"
            className="w-full py-2 px-4 rounded-xl bg-wc-dark hover:bg-wc-card text-wc-gold border border-wc-border hover:text-white transition-all duration-200 text-xs font-bold font-sports tracking-wider uppercase flex items-center justify-center gap-1.5"
          >
            <Activity className="w-4 h-4 text-wc-gold" />
            <span>Ver pronósticos del partido</span>
          </a>
        </div>

        {/* Countdown / Fecha */}
        <div className="mt-4 pt-3 border-t border-wc-border/30 flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-1.5 text-xs text-wc-gold font-bold font-sports bg-wc-gold/5 border border-wc-gold/20 px-3 py-1 rounded-full shadow-inner animate-pulse">
            <Clock className="w-3.5 h-3.5" strokeWidth={2.5} />
            <span>Comienza en: {timeLeft}</span>
          </div>
          <span className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase font-sports mt-0.5">
            {nextMatchTime.toLocaleString('es-ES', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
      </div>
    );
  }

  // Caso 3: No hay partidos programados ni en vivo (fin del mundial / error de datos)
  return (
    <div className="p-5 rounded-2xl bg-wc-card border border-wc-border backdrop-blur-sm space-y-3 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-20 h-20 bg-slate-500/5 rounded-full blur-xl pointer-events-none"></div>
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-355 flex items-center gap-1.5 border-b border-wc-border/50 pb-2.5 font-sports">
        <Activity className="w-4 h-4 text-slate-500" strokeWidth={2.5} /> Partido en Vivo
      </h3>
      <p className="text-xs md:text-sm text-slate-400 leading-relaxed">
        No hay partidos programados ni en juego por ahora.
      </p>
    </div>
  );
}
