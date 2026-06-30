import React, { useState, useEffect } from 'react';
import { showAlert } from '../../utils/alerts';
import { Settings, RefreshCw, AlertTriangle, Bell, Power } from 'lucide-react';

interface Phase {
  id: number;
  name: string;
  slug: string;
  order: number;
  is_active: boolean;
}

interface PhaseStats {
  phase_id: number;
  next_match: {
    id: number;
    home_team: string;
    away_team: string;
    match_time: string;
  } | null;
  missing_users: { id: string; name: string }[];
  total_approved: number;
}

export default function AdminPhaseManager() {
  const [phases, setPhases] = useState<Phase[]>([]);
  const [stats, setStats] = useState<PhaseStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notifyingId, setNotifyingId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [expandedPhaseId, setExpandedPhaseId] = useState<number | null>(null);

  const handleTogglePhase = async (phaseId: number, currentActive: boolean) => {
    const action = currentActive ? 'desactivar' : 'activar';
    const result = await showAlert.confirm(
      `¿${action.charAt(0).toUpperCase() + action.slice(1)} fase?`,
      `¿Estás seguro de que deseas ${action} esta fase del torneo?`
    );
    if (!result.isConfirmed) return;

    setTogglingId(phaseId);
    try {
      const response = await fetch(`/api/admin/phases/${phaseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentActive })
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al cambiar estado de la fase');
      }
      
      showAlert.success('Éxito', `Fase ${currentActive ? 'desactivada' : 'activada'} correctamente.`);
      await fetchPhases();
    } catch (err: any) {
      showAlert.error('Error', err.message);
    } finally {
      setTogglingId(null);
    }
  };

  const fetchPhases = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/matches'); // Reutilizamos esta API que trae fases y partidos
      if (!response.ok) {
        throw new Error('Error al obtener las fases');
      }
      const data = await response.json();
      setPhases(data.phases);
      setStats(data.phasesStats || []);
    } catch (err: any) {
      setError(err.message || 'Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPhases();
  }, []);

  const handleNotifyLaggards = async (phaseId: number, phaseName: string) => {
    const phaseStat = stats.find(s => s.phase_id === phaseId);
    if (!phaseStat || !phaseStat.next_match) return;

    const result = await showAlert.confirm(
      '¿Enviar recordatorios?',
      `Se enviará un correo a ${phaseStat.missing_users.length} participante(s) que no han llenado el partido ${phaseStat.next_match.home_team} vs ${phaseStat.next_match.away_team}.`
    );
    if (!result.isConfirmed) return;

    setNotifyingId(phaseId);
    try {
      const response = await fetch(`/api/admin/phases/${phaseId}/remind`, {
        method: 'POST'
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al enviar recordatorios');
      }
      const data = await response.json();
      showAlert.success('Éxito', `Se enviaron ${data.sentCount} correos exitosamente.`);
    } catch (err: any) {
      showAlert.error('Error', err.message);
    } finally {
      setNotifyingId(null);
    }
  };
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center p-4 bg-wc-card/50 rounded-2xl border border-wc-border backdrop-blur-md relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-wc-gold/5 rounded-full blur-3xl pointer-events-none"></div>
        <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2 font-sports relative z-10">
          <Settings className="w-4.5 h-4.5 text-wc-gold" strokeWidth={2.5} /> Fases de la Quiniela
        </h3>
        <button
          onClick={fetchPhases}
          className="p-2 px-3.5 rounded-xl bg-wc-dark hover:bg-wc-card text-slate-300 hover:text-white border border-wc-border transition-all duration-200 text-xs font-bold font-sports tracking-wider uppercase flex items-center gap-1.5 relative z-10"
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} strokeWidth={2.5} /> Recargar Fases
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 space-y-4 bg-wc-card/40 rounded-2xl border border-wc-border">
          <RefreshCw className="w-9 h-9 text-wc-gold animate-spin" strokeWidth={2.5} />
          <p className="text-slate-400 text-xs font-sports tracking-wider uppercase">Cargando fases...</p>
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl bg-wc-red/10 border border-wc-red/20 text-center space-y-3">
          <AlertTriangle className="w-9 h-9 text-wc-red mx-auto" strokeWidth={2.5} />
          <p className="text-wc-red font-bold text-xs uppercase font-sports tracking-wider">{error}</p>
          <button
            onClick={fetchPhases}
            className="px-4 py-2 rounded-xl bg-wc-red/20 hover:bg-wc-red/35 text-white text-xs font-bold font-sports tracking-wider uppercase border border-wc-red/30 transition-all"
          >
            Reintentar
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {phases.map((phase) => (
            <div
              key={phase.id}
              className={`p-5 rounded-2xl border transition-all duration-300 flex flex-col justify-between relative overflow-hidden ${
                phase.is_active
                  ? 'border-wc-green/30 bg-wc-card shadow-lg shadow-wc-green/5'
                  : 'border-wc-border bg-wc-card/40'
              }`}
            >
              {/* Decorative background when active */}
              {phase.is_active && (
                <div className="absolute -top-10 -right-10 w-24 h-24 bg-wc-green/5 rounded-full blur-2xl pointer-events-none"></div>
              )}

              {/* Info de la fase */}
              <div className="relative z-10 flex-grow">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 font-sports">
                    Orden #{phase.order}
                  </span>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border font-sports tracking-wider uppercase ${
                      phase.is_active
                        ? 'bg-wc-green/10 border-wc-green/20 text-wc-green'
                        : 'bg-wc-dark border-wc-border text-slate-400'
                    }`}
                  >
                    {phase.is_active ? '● Activa' : '○ Cerrada'}
                  </span>
                </div>
                
                <h4 className="text-xl font-bold text-white mt-4 font-sports tracking-wide uppercase">
                  {phase.name}
                </h4>

                {(() => {
                  const phaseStat = stats.find(s => s.phase_id === phase.id);
                  if (!phaseStat) return null;
                  
                  if (!phaseStat.next_match) {
                    return (
                      <div className="mt-4 p-3 bg-wc-green/10 border border-wc-green/20 rounded-lg">
                        <p className="text-xs text-wc-green font-bold text-center">Todos los partidos de esta fase han finalizado.</p>
                      </div>
                    );
                  }

                  const missingCount = phaseStat.missing_users.length;
                  const isExpanded = expandedPhaseId === phase.id;

                  return (
                    <div className="mt-4 bg-wc-dark/60 rounded-xl border border-wc-border p-3">
                      <div className="text-[10px] text-slate-400 font-sports uppercase tracking-wider mb-2">Siguiente Partido a Jugar:</div>
                      <div className="font-bold text-sm text-slate-200 mb-1">{phaseStat.next_match.home_team} vs {phaseStat.next_match.away_team}</div>
                      <div className="text-xs text-slate-500 mb-3">{new Date(phaseStat.next_match.match_time).toLocaleString('es-ES')}</div>
                      
                      <div className="flex justify-between items-center text-xs border-t border-wc-border/50 pt-2">
                        <span className="text-slate-400">Sin pronóstico:</span>
                        <span className={`font-bold ${missingCount > 0 ? 'text-rose-450' : 'text-wc-green'}`}>
                          {missingCount > 0 ? `${missingCount} personas` : 'Ninguna persona'}
                        </span>
                      </div>
                      
                      {missingCount > 0 && (
                        <div className="mt-2">
                          <button 
                            onClick={() => setExpandedPhaseId(isExpanded ? null : phase.id)}
                            className="text-[10px] text-wc-gold hover:underline font-bold"
                          >
                            {isExpanded ? 'Ocultar nombres' : 'Ver nombres faltantes'}
                          </button>
                          
                          {isExpanded && (
                            <div className="mt-2 max-h-32 overflow-y-auto custom-scrollbar p-2 bg-slate-900 rounded border border-slate-700">
                              <ul className="space-y-1">
                                {phaseStat.missing_users.map(u => (
                                  <li key={u.id} className="text-[11px] text-slate-300 flex items-center gap-1.5 before:content-['•'] before:text-wc-red">
                                    {u.name}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Botones de control */}
              <div className="flex flex-col gap-2 border-t border-wc-border pt-3 mt-auto relative z-10">
                <button
                  type="button"
                  onClick={() => handleTogglePhase(phase.id, phase.is_active)}
                  disabled={togglingId === phase.id}
                  className={`w-full py-2 px-3 rounded-lg flex items-center justify-center gap-2 text-xs font-bold font-sports tracking-wider uppercase transition-colors border cursor-pointer ${
                    phase.is_active
                      ? 'bg-rose-500/10 hover:bg-rose-500/25 text-rose-450 border-rose-500/30'
                      : 'bg-wc-green/10 hover:bg-wc-green/25 text-wc-green border-wc-green/30'
                  }`}
                >
                  <Power className="w-4 h-4 shrink-0" strokeWidth={2.5} />
                  {togglingId === phase.id ? 'Cambiando...' : phase.is_active ? 'Desactivar Fase' : 'Activar Fase'}
                </button>

                <button
                  type="button"
                  onClick={() => handleNotifyLaggards(phase.id, phase.name)}
                  disabled={notifyingId === phase.id || stats.find(s => s.phase_id === phase.id)?.missing_users?.length === 0 || !stats.find(s => s.phase_id === phase.id)?.next_match}
                  className={`w-full py-2 px-3 rounded-lg flex items-center justify-center gap-2 text-xs font-bold font-sports tracking-wider uppercase transition-colors cursor-pointer ${
                    stats.find(s => s.phase_id === phase.id)?.missing_users?.length === 0 || !stats.find(s => s.phase_id === phase.id)?.next_match
                      ? 'bg-wc-dark text-slate-500 cursor-not-allowed border border-slate-800'
                      : notifyingId === phase.id 
                      ? 'bg-wc-gold/20 text-wc-gold border border-wc-gold/30 cursor-wait'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                  }`}
                >
                  <Bell className={`w-4 h-4 ${notifyingId === phase.id ? 'animate-pulse' : ''}`} strokeWidth={2.5} /> 
                  {notifyingId === phase.id ? 'Enviando...' : 'Notificar Rezagados'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
