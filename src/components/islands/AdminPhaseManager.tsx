import React, { useState, useEffect } from 'react';
import { showAlert } from '../../utils/alerts';
import { Settings, RefreshCw, AlertTriangle, Bell } from 'lucide-react';

interface Phase {
  id: number;
  name: string;
  slug: string;
  order: number;
  is_active: boolean;
}

interface PhaseStats {
  phase_id: number;
  total_matches: number;
  completed_count: number;
  total_approved: number;
}

export default function AdminPhaseManager() {
  const [phases, setPhases] = useState<Phase[]>([]);
  const [stats, setStats] = useState<PhaseStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notifyingId, setNotifyingId] = useState<number | null>(null);

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
    const result = await showAlert.confirm(
      '¿Enviar recordatorios?',
      `Se enviará un correo masivo a todos los participantes que no han completado sus pronósticos para la ${phaseName}.`
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
                  
                  const { completed_count, total_approved, total_matches } = phaseStat;
                  const percentage = total_approved > 0 ? Math.round((completed_count / total_approved) * 100) : 0;
                  
                  return (
                    <div className="mt-4">
                      <div className="flex justify-between items-center text-xs text-slate-400 mb-1 font-medium">
                        <span>Progreso de llenado</span>
                        <span className="font-bold text-slate-300">{completed_count} / {total_approved} cupos</span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-1.5 mb-1 overflow-hidden">
                        <div className="bg-wc-gold h-1.5 rounded-full" style={{ width: `${percentage}%` }}></div>
                      </div>
                      <p className="text-[10px] text-slate-500">{total_matches} partidos en total</p>
                    </div>
                  );
                })()}
              </div>

              {/* Botón de control */}
              <div className="flex items-center justify-between border-t border-wc-border pt-3 mt-auto relative z-10">
                <button
                  type="button"
                  onClick={() => handleNotifyLaggards(phase.id, phase.name)}
                  disabled={notifyingId === phase.id || stats.find(s => s.phase_id === phase.id)?.total_approved === stats.find(s => s.phase_id === phase.id)?.completed_count}
                  className={`w-full py-2 px-3 rounded-lg flex items-center justify-center gap-2 text-xs font-bold font-sports tracking-wider uppercase transition-colors ${
                    stats.find(s => s.phase_id === phase.id)?.total_approved === stats.find(s => s.phase_id === phase.id)?.completed_count
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
