import React, { useState, useEffect, useRef } from 'react';
import { showAlert } from '../../utils/alerts';
import { getTeamFlagUrl } from '../../utils/flags';
import { Lock, Clock, AlertTriangle, Loader2, Award, CheckCircle2 } from 'lucide-react';

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
        <div className="space-y-8">
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
      )}
    </div>
  );
}
