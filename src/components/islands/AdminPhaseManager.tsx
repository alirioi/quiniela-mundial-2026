import React, { useState, useEffect } from 'react';
import { showAlert } from '../../utils/alerts';
import { Settings, RefreshCw, AlertTriangle } from 'lucide-react';

interface Phase {
  id: number;
  name: string;
  slug: string;
  order: number;
  is_active: boolean;
}

export default function AdminPhaseManager() {
  const [phases, setPhases] = useState<Phase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);

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
    } catch (err: any) {
      setError(err.message || 'Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPhases();
  }, []);

  const handleTogglePhase = async (phaseId: number, currentStatus: boolean) => {
    setTogglingId(phaseId);
    try {
      const newStatus = !currentStatus;
      const response = await fetch(`/api/admin/phases/${phaseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: newStatus }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al cambiar el estado de la fase');
      }

      setPhases((prev) =>
        prev.map((p) => (p.id === phaseId ? { ...p, is_active: newStatus } : p))
      );
    } catch (err: any) {
      showAlert.error('Error', err.message);
    } finally {
      setTogglingId(null);
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
              className={`p-5 rounded-2xl border transition-all duration-300 flex flex-col justify-between h-44 relative overflow-hidden ${
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
              <div className="relative z-10">
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
                
                <h4 className="text-xl font-bold text-white mt-2 font-sports tracking-wide uppercase">
                  {phase.name}
                </h4>
              </div>

              {/* Botón de control */}
              <div className="flex items-center justify-between border-t border-wc-border pt-3 mt-auto relative z-10">
                <span className="text-xs text-slate-400 font-medium">
                  {phase.is_active ? 'Acepta predicciones' : 'Pronósticos bloqueados'}
                </span>

                <button
                  type="button"
                  onClick={() => handleTogglePhase(phase.id, phase.is_active)}
                  disabled={togglingId === phase.id}
                  className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 focus:outline-none flex items-center ${
                    phase.is_active ? 'bg-wc-green justify-end' : 'bg-slate-800 justify-start'
                  } ${togglingId === phase.id ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
                >
                  <span className="bg-slate-955 w-4 h-4 rounded-full shadow-md transition-transform duration-200"></span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
