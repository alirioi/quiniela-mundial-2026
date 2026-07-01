import React, { useState } from 'react';
import { showAlert } from '../../utils/alerts';
import { getTeamFlagUrl } from '../../utils/flags';
import { isPlaceholderName } from '../../utils/knockout';
import { Lock, RefreshCw, AlertTriangle, Award } from 'lucide-react';
import { useFetch } from '../../hooks/useFetch';

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
  penalty_winner?: string | null;
}

interface MatchEditState {
  home_score: string;
  away_score: string;
  status: 'scheduled' | 'live' | 'finished';
  penalty_winner: string | null;
}

export default function AdminMatchResults() {
  const [phases, setPhases] = useState<Phase[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedPhaseId, setSelectedPhaseId] = useState<number | 'today' | null>(null);
  const [editStates, setEditStates] = useState<Record<number, MatchEditState>>({});
  const [savingId, setSavingId] = useState<number | null>(null);

  const { loading, error, execute: fetchData } = useFetch({
    url: '/api/admin/matches',
    onSuccess: (data) => {
      setPhases(data.phases || []);
      setMatches(data.matches || []);

      if (data.phases?.length > 0 && selectedPhaseId === null) {
        // Seleccionar la primera fase por defecto o la activa solo en la primera carga
        const activePhase = data.phases.find((p: Phase) => p.is_active);
        setSelectedPhaseId(activePhase ? activePhase.id : data.phases[0].id);
      }

      // Inicializar el estado de edición para cada partido solo si no estaban editándose
      setEditStates((prev) => {
        const newEdits: Record<number, MatchEditState> = { ...prev };
        (data.matches || []).forEach((m: Match) => {
          if (!newEdits[m.id]) {
            newEdits[m.id] = {
              home_score: m.home_score !== null ? String(m.home_score) : '',
              away_score: m.away_score !== null ? String(m.away_score) : '',
              status: m.status,
              penalty_winner: m.penalty_winner || null,
            };
          }
        });
        return newEdits;
      });
    }
  });
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

  const handlePenaltyWinnerChange = (matchId: number, team: string | null) => {
    setEditStates((prev) => ({
      ...prev,
      [matchId]: {
        ...prev[matchId],
        penalty_winner: team,
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
          penaltyWinner: state.penalty_winner,
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
            ? { ...m, home_score: homeScoreVal, away_score: awayScoreVal, status: state.status, penalty_winner: state.penalty_winner }
            : m
        )
      );

      showAlert.success('Éxito', 'Partido actualizado con éxito. ¡Los puntos se han recalculado en la base de datos!');
    } catch (err: any) {
      showAlert.error('Error', err.message);
    } finally {
      setSavingId(null);
    }
  };

  const activePhase = phases.find((p) => p.id === selectedPhaseId);
  const filteredMatches = selectedPhaseId === 'today'
    ? matches.filter((m) => {
        const matchDate = new Date(m.match_time);
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);

        const isToday =
          matchDate.getDate() === today.getDate() &&
          matchDate.getMonth() === today.getMonth() &&
          matchDate.getFullYear() === today.getFullYear();

        const isTomorrowMidnight =
          matchDate.getDate() === tomorrow.getDate() &&
          matchDate.getMonth() === tomorrow.getMonth() &&
          matchDate.getFullYear() === tomorrow.getFullYear() &&
          matchDate.getHours() === 0;

        return isToday || isTomorrowMidnight;
      })
    : matches.filter((m) => m.phase_id === selectedPhaseId);

  return (
    <div className="space-y-6">
      {/* Pestañas de fases */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-wc-card/50 rounded-2xl border border-wc-border backdrop-blur-md relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-wc-gold/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex flex-wrap items-center gap-2 relative z-10">
          <button
            onClick={() => setSelectedPhaseId('today')}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 border flex items-center gap-1.5 font-sports relative z-10 ${
              selectedPhaseId === 'today'
                ? 'bg-wc-gold/10 border-wc-gold/30 text-wc-gold shadow-md shadow-wc-gold/5'
                : 'bg-wc-dark/40 border-wc-border hover:border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Partidos de Hoy</span>
          </button>

          {phases.map((phase) => (
            <button
              key={phase.id}
              onClick={() => setSelectedPhaseId(phase.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 border flex items-center gap-1.5 font-sports relative z-10 ${
                selectedPhaseId === phase.id
                  ? 'bg-wc-green/10 border-wc-green/30 text-wc-green shadow-md shadow-wc-green/5'
                  : 'bg-wc-dark/40 border-wc-border hover:border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>{phase.name}</span>
              {!phase.is_active && <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" strokeWidth={2.5} />}
            </button>
          ))}
        </div>

        <button
          onClick={fetchData}
          className="p-2 px-3.5 rounded-xl bg-wc-dark hover:bg-wc-card text-slate-300 hover:text-white border border-wc-border transition-all duration-200 text-xs font-bold font-sports tracking-wider uppercase flex items-center gap-1.5 relative z-10"
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} strokeWidth={2.5} />
          <span>Recargar Partidos</span>
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 space-y-4 bg-wc-card/40 rounded-2xl border border-wc-border">
          <RefreshCw className="w-9 h-9 animate-spin text-wc-gold" strokeWidth={2.5} />
          <p className="text-slate-400 text-xs font-sports tracking-wider uppercase">Cargando fixture...</p>
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl bg-wc-red/10 border border-wc-red/20 text-center space-y-3">
          <AlertTriangle className="w-9 h-9 text-wc-red mx-auto" strokeWidth={2.5} />
          <p className="text-wc-red font-bold text-xs uppercase font-sports tracking-wider">{error.message || 'Error de conexión'}</p>
          <button
            onClick={fetchData}
            className="px-4 py-2 rounded-xl bg-wc-red/20 hover:bg-wc-red/35 text-white text-xs font-bold font-sports tracking-wider uppercase border border-wc-red/30 transition-colors"
          >
            Reintentar
          </button>
        </div>
      ) : filteredMatches.length === 0 ? (
        <div className="p-12 text-center bg-wc-card/40 rounded-2xl border border-wc-border text-slate-550 text-sm flex flex-col items-center justify-center gap-2">
          <Award className="w-9 h-9 text-slate-450" strokeWidth={2.5} />
          <p className="font-sports text-xs uppercase tracking-wider">No hay partidos registrados para esta fase.</p>
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
                className={`p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden ${
                  hasChanges
                    ? 'border-wc-gold/40 bg-wc-card shadow-lg shadow-wc-gold/5'
                    : 'border-wc-border bg-wc-card/40'
                }`}
              >
                {/* Decorative background when changes are made */}
                {hasChanges && (
                  <div className="absolute -top-10 -right-10 w-20 h-20 bg-wc-gold/5 rounded-full blur-2xl pointer-events-none"></div>
                )}

                {/* Header de la tarjeta */}
                <div className="flex justify-between items-center text-xs text-slate-400 mb-3.5 border-b border-wc-border pb-2 relative z-10 font-medium">
                  <div className="flex items-center gap-2">
                    {match.group_name && (
                      <span className="font-bold text-slate-400 font-sports tracking-wider uppercase">{match.group_name}</span>
                    )}
                  </div>
                  <div className="font-bold font-sports tracking-wider uppercase text-slate-450">
                    {`${matchTime.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} • ${matchTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`}
                  </div>
                </div>
 
                {/* Grid del Formulario de Marcador */}
                <div className="flex items-center justify-between gap-4 relative z-10">
                  {/* Local */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-end gap-2">
                      <span className="font-bold text-white text-sm font-sports tracking-wide uppercase truncate" title={isPlaceholderName(match.home_team) ? 'Por definir' : match.home_team}>
                        {isPlaceholderName(match.home_team) ? 'Por definir' : match.home_team}
                      </span>
                      {!isPlaceholderName(match.home_team) && getTeamFlagUrl(match.home_team) && (
                        <img
                          src={getTeamFlagUrl(match.home_team)!}
                          alt={`Bandera de ${match.home_team}`}
                          className="w-6 h-4 sm:w-7 sm:h-5 object-cover rounded shadow border border-slate-700/50 flex-shrink-0"
                        />
                      )}
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
                      placeholder="- "
                      className={`w-11 h-11 rounded-xl bg-wc-dark text-center text-lg font-bold border focus:outline-none focus:ring-2 focus:ring-wc-gold/50 transition-all font-mono ${
                        editState.status === 'scheduled'
                          ? 'border-wc-border text-slate-600 cursor-not-allowed bg-wc-dark/30'
                          : 'border-wc-border text-wc-gold focus:border-wc-gold'
                      }`}
                    />
                    
                    <span className="text-wc-border font-bold">:</span>
 
                    <input
                      type="text"
                      maxLength={2}
                      value={editState.away_score}
                      onChange={(e) => handleScoreChange(match.id, 'away', e.target.value)}
                      disabled={editState.status === 'scheduled'}
                      placeholder="- "
                      className={`w-11 h-11 rounded-xl bg-wc-dark text-center text-lg font-bold border focus:outline-none focus:ring-2 focus:ring-wc-gold/50 transition-all font-mono ${
                        editState.status === 'scheduled'
                          ? 'border-wc-border text-slate-600 cursor-not-allowed bg-wc-dark/30'
                          : 'border-wc-border text-wc-gold focus:border-wc-gold'
                      }`}
                    />
                  </div>
 
                  {/* Visitante */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-start gap-2">
                      {!isPlaceholderName(match.away_team) && getTeamFlagUrl(match.away_team) && (
                        <img
                          src={getTeamFlagUrl(match.away_team)!}
                          alt={`Bandera de ${match.away_team}`}
                          className="w-6 h-4 sm:w-7 sm:h-5 object-cover rounded shadow border border-slate-700/50 flex-shrink-0"
                        />
                      )}
                      <span className="font-bold text-white text-sm font-sports tracking-wide uppercase truncate" title={isPlaceholderName(match.away_team) ? 'Por definir' : match.away_team}>
                        {isPlaceholderName(match.away_team) ? 'Por definir' : match.away_team}
                      </span>
                    </div>
                  </div>
                </div>
                {/* Selector de Penales (solo en eliminatorias si hay empate) */}
                {match.phase_id > 1 &&
                  editState.status === 'finished' &&
                  editState.home_score !== '' &&
                  editState.home_score === editState.away_score && (
                    <div className="mt-4 pt-3.5 border-t border-wc-border relative z-10 flex flex-col gap-2">
                      <label className="text-xs font-sports uppercase tracking-wider text-slate-400">
                        Ganador en Penales
                      </label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handlePenaltyWinnerChange(match.id, match.home_team)}
                          className={`flex-1 p-2 rounded-lg text-xs font-bold font-sports uppercase tracking-wider transition-all border ${
                            editState.penalty_winner === match.home_team
                              ? 'bg-wc-gold/20 border-wc-gold text-wc-gold shadow-sm shadow-wc-gold/10'
                              : 'bg-wc-dark/40 border-wc-border text-slate-400 hover:text-white hover:border-slate-500'
                          }`}
                        >
                          {match.home_team}
                        </button>
                        <button
                          onClick={() => handlePenaltyWinnerChange(match.id, match.away_team)}
                          className={`flex-1 p-2 rounded-lg text-xs font-bold font-sports uppercase tracking-wider transition-all border ${
                            editState.penalty_winner === match.away_team
                              ? 'bg-wc-gold/20 border-wc-gold text-wc-gold shadow-sm shadow-wc-gold/10'
                              : 'bg-wc-dark/40 border-wc-border text-slate-400 hover:text-white hover:border-slate-500'
                          }`}
                        >
                          {match.away_team}
                        </button>
                      </div>
                    </div>
                  )}
 
                {/* Footer de la tarjeta con selector de estado y botón guardar */}
                <div className="flex items-center justify-between gap-4 mt-4 pt-3.5 border-t border-wc-border relative z-10">
                  {/* Selector de Estado */}
                  <div className="flex gap-1 bg-wc-dark p-1 rounded-xl border border-wc-border">
                    {(['scheduled', 'live', 'finished'] as const).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => handleStatusChange(match.id, st)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center font-sports ${
                          editState.status === st
                            ? st === 'live'
                              ? 'bg-wc-red/15 text-wc-red border border-wc-red/20'
                              : st === 'finished'
                              ? 'bg-wc-green/15 text-wc-green border border-wc-green/20'
                              : 'bg-wc-blue/15 text-wc-blue border border-wc-blue/20'
                            : 'text-slate-500 hover:text-slate-350'
                        }`}
                      >
                        {st === 'scheduled' && 'Prog'}
                        {st === 'live' && (
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-wc-red inline-block animate-pulse"></span>
                            <span>Vivo</span>
                          </span>
                        )}
                        {st === 'finished' && 'Fin'}
                      </button>
                    ))}
                  </div>
 
                  {/* Botón de Guardar */}
                  <button
                    onClick={() => handleSaveMatch(match.id)}
                    disabled={!hasChanges || savingId === match.id}
                    className={`px-4 py-1.5 rounded-xl text-xs font-bold font-sports tracking-wider uppercase transition-all ${
                      savingId === match.id
                        ? 'bg-wc-dark text-slate-505 cursor-wait'
                        : hasChanges
                        ? 'bg-wc-green hover:bg-green-500 text-white shadow-md shadow-wc-green/10 hover:-translate-y-0.5'
                        : 'bg-wc-dark text-slate-600 border border-wc-border cursor-not-allowed'
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
