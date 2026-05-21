import React, { useState, useEffect } from 'react';

interface Phase {
  id: number;
  name: string;
  slug: string;
  order: number;
  is_active: boolean;
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

interface MatchEditState {
  home_score: string;
  away_score: string;
  status: 'scheduled' | 'live' | 'finished';
}

export default function AdminMatchResults() {
  const [phases, setPhases] = useState<Phase[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPhaseId, setSelectedPhaseId] = useState<number | null>(null);
  const [editStates, setEditStates] = useState<Record<number, MatchEditState>>({});
  const [savingId, setSavingId] = useState<number | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/matches');
      if (!response.ok) {
        throw new Error('Error al obtener los partidos');
      }
      const data = await response.json();
      setPhases(data.phases);
      setMatches(data.matches);

      if (data.phases.length > 0) {
        // Seleccionar la primera fase por defecto o la activa
        const activePhase = data.phases.find((p: Phase) => p.is_active);
        setSelectedPhaseId(activePhase ? activePhase.id : data.phases[0].id);
      }

      // Inicializar el estado de edición para cada partido
      const initialEdits: Record<number, MatchEditState> = {};
      data.matches.forEach((m: Match) => {
        initialEdits[m.id] = {
          home_score: m.home_score !== null ? String(m.home_score) : '',
          away_score: m.away_score !== null ? String(m.away_score) : '',
          status: m.status,
        };
      });
      setEditStates(initialEdits);
    } catch (err: any) {
      setError(err.message || 'Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleScoreChange = (matchId: number, field: 'home' | 'away', val: string) => {
    // Solo permitir números o string vacía
    if (val !== '' && !/^\d+$/.test(val)) return;
    
    setEditStates((prev) => ({
      ...prev,
      [matchId]: {
        ...prev[matchId],
        [`${field}_score`]: val,
      },
    }));
  };

  const handleStatusChange = (matchId: number, status: 'scheduled' | 'live' | 'finished') => {
    setEditStates((prev) => ({
      ...prev,
      [matchId]: {
        ...prev[matchId],
        status,
        // Si cambia a finalizado o vivo y los campos de marcador están vacíos, autocompletar con 0
        home_score: status !== 'scheduled' && prev[matchId].home_score === '' ? '0' : prev[matchId].home_score,
        away_score: status !== 'scheduled' && prev[matchId].away_score === '' ? '0' : prev[matchId].away_score,
      },
    }));
  };

  const handleSaveMatch = async (matchId: number) => {
    const state = editStates[matchId];
    if (!state) return;

    setSavingId(matchId);
    try {
      const homeScoreVal = state.home_score === '' ? null : parseInt(state.home_score, 10);
      const awayScoreVal = state.away_score === '' ? null : parseInt(state.away_score, 10);

      const response = await fetch(`/api/admin/matches/${matchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          homeScore: homeScoreVal,
          awayScore: awayScoreVal,
          status: state.status,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al guardar los datos del partido');
      }

      // Actualizar localmente la lista de partidos
      setMatches((prev) =>
        prev.map((m) =>
          m.id === matchId
            ? { ...m, home_score: homeScoreVal, away_score: awayScoreVal, status: state.status }
            : m
        )
      );

      alert('Partido actualizado con éxito. ¡Los puntos se han recalculado en la base de datos!');
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setSavingId(null);
    }
  };

  const activePhase = phases.find((p) => p.id === selectedPhaseId);
  const filteredMatches = matches.filter((m) => m.phase_id === selectedPhaseId);

  return (
    <div className="space-y-6">
      {/* Pestañas de fases */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-900/40 rounded-2xl border border-slate-800/80 backdrop-blur-sm">
        <div className="flex items-center space-x-2">
          {phases.map((phase) => (
            <button
              key={phase.id}
              onClick={() => setSelectedPhaseId(phase.id)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all duration-200 border ${
                selectedPhaseId === phase.id
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-slate-950/40 border-transparent hover:border-slate-800 text-slate-500 hover:text-slate-300'
              }`}
            >
              {phase.name} {!phase.is_active && '🔒'}
            </button>
          ))}
        </div>

        <button
          onClick={fetchData}
          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all duration-200 text-xs font-semibold"
          disabled={loading}
        >
          🔄 Recargar Partidos
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 space-y-4 bg-slate-900/20 rounded-2xl border border-slate-800/60">
          <div className="animate-spin text-3xl">🔄</div>
          <p className="text-slate-500 text-sm">Cargando fixture...</p>
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl bg-red-950/20 border border-red-900/40 text-center space-y-3">
          <div className="text-3xl">⚠️</div>
          <p className="text-red-400 font-semibold text-sm">{error}</p>
          <button
            onClick={fetchData}
            className="px-4 py-2 rounded-xl bg-red-900/20 hover:bg-red-900/40 text-red-300 text-xs font-semibold border border-red-800/40 transition-colors"
          >
            Reintentar
          </button>
        </div>
      ) : filteredMatches.length === 0 ? (
        <div className="p-12 text-center bg-slate-900/20 rounded-2xl border border-slate-800/60 text-slate-500 text-sm">
          ⚽ No hay partidos registrados para esta fase.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredMatches.map((match) => {
            const editState = editStates[match.id] || { home_score: '', away_score: '', status: 'scheduled' };
            const matchTime = new Date(match.match_time);
            
            // Comprobar si hay cambios pendientes
            const isHomeScoreChanged = String(match.home_score ?? '') !== editState.home_score;
            const isAwayScoreChanged = String(match.away_score ?? '') !== editState.away_score;
            const isStatusChanged = match.status !== editState.status;
            const hasChanges = isHomeScoreChanged || isAwayScoreChanged || isStatusChanged;

            return (
              <div
                key={match.id}
                className={`p-5 rounded-2xl border transition-all duration-300 ${
                  hasChanges
                    ? 'border-amber-500/40 bg-amber-950/5 shadow-md shadow-amber-950/5'
                    : 'border-slate-800 bg-slate-950/30'
                }`}
              >
                {/* Header de la tarjeta */}
                <div className="flex justify-between items-center text-xs text-slate-500 mb-3.5 border-b border-slate-900 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono bg-slate-900 px-2 py-0.5 rounded text-[10px] text-slate-400 border border-slate-800">
                      Partido #{match.match_number}
                    </span>
                    {match.group_name && (
                      <span className="font-medium text-slate-400">{match.group_name}</span>
                    )}
                  </div>
                  <div className="font-medium">
                    {matchTime.toLocaleDateString('es-ES', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>

                {/* Grid del Formulario de Marcador */}
                <div className="flex items-center justify-between gap-4">
                  {/* Local */}
                  <div className="flex-1 text-right min-w-0">
                    <div className="font-bold text-slate-200 truncate" title={match.home_team}>
                      {match.home_team}
                    </div>
                  </div>

                  {/* Inputs de Marcador */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <input
                      type="text"
                      maxLength={2}
                      value={editState.home_score}
                      onChange={(e) => handleScoreChange(match.id, 'home', e.target.value)}
                      disabled={editState.status === 'scheduled'}
                      placeholder="-"
                      className={`w-11 h-11 rounded-xl bg-slate-950 text-center text-lg font-bold border focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all ${
                        editState.status === 'scheduled'
                          ? 'border-slate-900 text-slate-600 cursor-not-allowed bg-slate-950/20'
                          : 'border-slate-800 text-emerald-400 focus:border-emerald-500'
                      }`}
                    />
                    
                    <span className="text-slate-600 font-bold">:</span>

                    <input
                      type="text"
                      maxLength={2}
                      value={editState.away_score}
                      onChange={(e) => handleScoreChange(match.id, 'away', e.target.value)}
                      disabled={editState.status === 'scheduled'}
                      placeholder="-"
                      className={`w-11 h-11 rounded-xl bg-slate-950 text-center text-lg font-bold border focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all ${
                        editState.status === 'scheduled'
                          ? 'border-slate-900 text-slate-600 cursor-not-allowed bg-slate-950/20'
                          : 'border-slate-800 text-emerald-400 focus:border-emerald-500'
                      }`}
                    />
                  </div>

                  {/* Visitante */}
                  <div className="flex-1 text-left min-w-0">
                    <div className="font-bold text-slate-200 truncate" title={match.away_team}>
                      {match.away_team}
                    </div>
                  </div>
                </div>

                {/* Footer de la tarjeta con selector de estado y botón guardar */}
                <div className="flex items-center justify-between gap-4 mt-4 pt-3.5 border-t border-slate-900">
                  {/* Selector de Estado */}
                  <div className="flex gap-1 bg-slate-950 p-1 rounded-xl border border-slate-900">
                    {(['scheduled', 'live', 'finished'] as const).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => handleStatusChange(match.id, st)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${
                          editState.status === st
                            ? st === 'live'
                              ? 'bg-red-500/10 text-red-400'
                              : st === 'finished'
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'bg-slate-800 text-slate-200'
                            : 'text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        {st === 'scheduled' && 'Prog'}
                        {st === 'live' && '🔴 Vivo'}
                        {st === 'finished' && 'Fin'}
                      </button>
                    ))}
                  </div>

                  {/* Botón de Guardar */}
                  <button
                    onClick={() => handleSaveMatch(match.id)}
                    disabled={!hasChanges || savingId === match.id}
                    className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      savingId === match.id
                        ? 'bg-slate-800 text-slate-500 cursor-wait'
                        : hasChanges
                        ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-950/20 hover:-translate-y-0.5'
                        : 'bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed'
                    }`}
                  >
                    {savingId === match.id ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
