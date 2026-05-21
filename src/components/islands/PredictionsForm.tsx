import React, { useState, useEffect, useRef } from 'react';

interface Prediction {
  id?: number;
  predicted_home: number;
  predicted_away: number;
  points_earned?: number;
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
}

interface PredictionsFormProps {
  phaseSlug: string;
  userEntries: Entry[];
}

export default function PredictionsForm({ phaseSlug, userEntries }: PredictionsFormProps) {
  const [selectedEntryId, setSelectedEntryId] = useState<number>(userEntries[0]?.id || 0);
  const [phase, setPhase] = useState<Phase | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Estado local para los inputs: record de matchId -> { home, away }
  const [inputs, setInputs] = useState<Record<number, { home: string; away: string }>>({});
  const [savingIds, setSavingIds] = useState<Record<number, boolean>>({});
  const [bulkSaving, setBulkSaving] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<Record<number, string>>({});

  const timerRef = useRef<NodeJS.Timeout | null>(null);

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
          remaining[match.id] = '🔒 Bloqueado';
        } else {
          const diff = lockTime - now;
          const days = Math.floor(diff / (24 * 60 * 60 * 1000));
          const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
          const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
          const seconds = Math.floor((diff % (60 * 1000)) / 1000);

          if (days > 0) {
            remaining[match.id] = `⏳ Cierra en ${days}d ${hours}h`;
          } else if (hours > 0) {
            remaining[match.id] = `⏳ Cierra en ${hours}h ${minutes}m`;
          } else {
            remaining[match.id] = `⏳ Cierra en ${minutes}m ${seconds}s`;
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
      alert('Este partido ya está bloqueado para predicciones.');
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
      alert(`Error: ${err.message}`);
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
      alert('Completa al menos un marcador antes de guardar.');
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

      alert('¡Todas tus predicciones se guardaron correctamente!');
      await fetchMatchesAndPredictions();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 bg-slate-900/60 rounded-2xl border border-slate-800/80 backdrop-blur-sm">
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
            Selecciona tu Cupo
          </label>
          <div className="flex items-center space-x-2">
            {userEntries.map((entry) => (
              <button
                key={entry.id}
                onClick={() => setSelectedEntryId(entry.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all duration-200 ${
                  selectedEntryId === entry.id
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 border-transparent shadow-md shadow-emerald-950/20'
                    : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                {entry.display_name}
              </button>
            ))}
          </div>
        </div>

        {unpredictedCount > 0 && !loading && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-amber-400 font-semibold bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-xl">
              ⚠️ Tienes {unpredictedCount} pronósticos vacíos en esta fase
            </span>
            
            <button
              onClick={handleSaveBulk}
              disabled={bulkSaving}
              className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-950/20 disabled:opacity-50"
            >
              {bulkSaving ? 'Guardando...' : 'Guardar Todo'}
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center p-16 space-y-4 bg-slate-900/20 rounded-2xl border border-slate-800/60">
          <div className="animate-spin text-4xl">⚽</div>
          <p className="text-slate-500 text-sm">Cargando partidos y pronósticos...</p>
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl bg-red-950/20 border border-red-900/40 text-center space-y-3">
          <div className="text-3xl">⚠️</div>
          <p className="text-red-400 font-semibold text-sm">{error}</p>
          <button
            onClick={fetchMatchesAndPredictions}
            className="px-4 py-2 rounded-xl bg-red-900/20 hover:bg-red-900/40 text-red-300 text-xs font-semibold border border-red-800/40 transition-colors"
          >
            Reintentar
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedMatches).map(([dateLabel, dateMatches]) => (
            <div key={dateLabel} className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-l-2 border-emerald-500 pl-2.5">
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
                          ? 'border-slate-900 bg-slate-950/20 opacity-90'
                          : hasChanges
                          ? 'border-amber-500/30 bg-amber-950/5'
                          : match.prediction
                          ? 'border-emerald-500/10 bg-slate-900/10'
                          : 'border-slate-800/80 bg-slate-900/40'
                      }`}
                    >
                      {/* Fila superior: Info de Partido y Countdown */}
                      <div className="flex justify-between items-center text-[10px] text-slate-500 mb-3 border-b border-slate-950 pb-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono bg-slate-950 px-1.5 py-0.5 rounded text-slate-400 border border-slate-900">
                            #{match.match_number}
                          </span>
                          {match.group_name && (
                            <span className="font-medium text-slate-400">{match.group_name}</span>
                          )}
                        </div>

                        {/* Estado o cuenta regresiva */}
                        <div className="flex items-center gap-1.5 font-semibold">
                          {match.status === 'live' ? (
                            <span className="px-2 py-0.5 bg-red-500/10 text-red-400 rounded-md border border-red-500/20 animate-pulse text-[9px] uppercase tracking-wider">
                              🔴 En vivo
                            </span>
                          ) : match.status === 'finished' ? (
                            <span className="px-2 py-0.5 bg-slate-900 text-slate-400 rounded-md border border-slate-850 text-[9px] uppercase tracking-wider">
                              Fin
                            </span>
                          ) : (
                            <span className={locked ? 'text-red-400' : 'text-emerald-400'}>
                              {countdown}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Fila central: Marcador del Partido y Predicción */}
                      <div className="flex items-center justify-between gap-3">
                        {/* Local */}
                        <div className="flex-1 text-right min-w-0 pr-1">
                          <div className="font-bold text-slate-200 text-sm truncate" title={match.home_team}>
                            {match.home_team}
                          </div>
                        </div>

                        {/* Marcador Real (si está jugando o terminado) */}
                        {locked && (match.status === 'finished' || match.status === 'live') && (
                          <div className="px-2.5 py-1 bg-slate-900/80 rounded-lg border border-slate-850 text-slate-200 font-bold text-xs font-mono">
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
                            className={`w-9 h-9 rounded-xl bg-slate-950 text-center text-sm font-bold border focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all ${
                              locked
                                ? 'border-slate-900 text-slate-500 cursor-not-allowed bg-slate-950/20'
                                : 'border-slate-800 text-emerald-400 focus:border-emerald-500'
                            }`}
                          />

                          <span className="text-slate-600 font-bold text-xs">:</span>

                          <input
                            type="text"
                            maxLength={2}
                            value={input.away}
                            onChange={(e) => handleInputChange(match.id, 'away', e.target.value)}
                            disabled={locked}
                            placeholder="-"
                            className={`w-9 h-9 rounded-xl bg-slate-950 text-center text-sm font-bold border focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all ${
                              locked
                                ? 'border-slate-900 text-slate-500 cursor-not-allowed bg-slate-950/20'
                                : 'border-slate-800 text-emerald-400 focus:border-emerald-500'
                            }`}
                          />
                        </div>

                        {/* Visitante */}
                        <div className="flex-1 text-left min-w-0 pl-1">
                          <div className="font-bold text-slate-200 text-sm truncate" title={match.away_team}>
                            {match.away_team}
                          </div>
                        </div>
                      </div>

                      {/* Fila inferior: Puntuación ganada o Botón Guardar */}
                      <div className="flex justify-between items-center mt-3 pt-2.5 border-t border-slate-950/60">
                        {/* Puntuación ganada */}
                        <div className="text-xs">
                          {match.status === 'finished' && match.prediction ? (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-lg font-bold border ${
                              pointsEarned === 3
                                ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                                : pointsEarned === 1
                                ? 'bg-teal-500/10 border-teal-500/25 text-teal-400'
                                : 'bg-slate-900 border-slate-800 text-slate-500'
                            }`}>
                              🏆 {pointsEarned} {pointsEarned === 1 ? 'punto' : 'puntos'}
                            </span>
                          ) : match.status === 'finished' && !match.prediction ? (
                            <span className="text-slate-650 font-medium">Sin pronóstico (0 pts)</span>
                          ) : match.prediction ? (
                            <span className="text-[10px] text-slate-500 font-semibold flex items-center gap-1">
                              ✓ Pronóstico guardado
                            </span>
                          ) : (
                            <span className="text-[10px] text-amber-500/80 font-medium flex items-center gap-1">
                              ⚠️ Sin pronosticar
                            </span>
                          )}
                        </div>

                        {/* Botón guardar individual */}
                        {canSaveIndividual && (
                          <button
                            type="button"
                            onClick={() => handleSaveIndividual(match.id)}
                            disabled={savingIds[match.id]}
                            className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-[10px] transition-all"
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
      )}
    </div>
  );
}
