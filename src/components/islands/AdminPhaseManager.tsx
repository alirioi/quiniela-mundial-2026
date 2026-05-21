import React, { useState, useEffect } from 'react';

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
      alert(`Error: ${err.message}`);
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center p-4 bg-slate-900/40 rounded-2xl border border-slate-800/80 backdrop-blur-sm">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
          ⚙️ Fases de la Quiniela
        </h3>
        <button
          onClick={fetchPhases}
          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all duration-200 text-xs font-semibold"
          disabled={loading}
        >
          🔄 Recargar Fases
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 space-y-4 bg-slate-900/20 rounded-2xl border border-slate-800/60">
          <div className="animate-spin text-3xl">🔄</div>
          <p className="text-slate-500 text-sm">Cargando fases...</p>
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl bg-red-950/20 border border-red-900/40 text-center space-y-3">
          <div className="text-3xl">⚠️</div>
          <p className="text-red-400 font-semibold text-sm">{error}</p>
          <button
            onClick={fetchPhases}
            className="px-4 py-2 rounded-xl bg-red-900/20 hover:bg-red-900/40 text-red-300 text-xs font-semibold border border-red-800/40 transition-colors"
          >
            Reintentar
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {phases.map((phase) => (
            <div
              key={phase.id}
              className={`p-5 rounded-2xl border transition-all duration-300 flex flex-col justify-between h-40 ${
                phase.is_active
                  ? 'border-emerald-500/30 bg-emerald-950/5 shadow-md shadow-emerald-950/5'
                  : 'border-slate-800 bg-slate-950/20'
              }`}
            >
              {/* Info de la fase */}
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Orden #{phase.order}
                  </span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      phase.is_active
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                        : 'bg-slate-900 border-slate-800 text-slate-500'
                    }`}
                  >
                    {phase.is_active ? '● Activa' : '○ Cerrada'}
                  </span>
                </div>
                
                <h4 className="text-lg font-bold text-slate-200 mt-2.5">
                  {phase.name}
                </h4>
              </div>

              {/* Botón de control */}
              <div className="flex items-center justify-between border-t border-slate-900/80 pt-3 mt-auto">
                <span className="text-xs text-slate-400">
                  {phase.is_active ? 'Acepta predicciones' : 'Pronósticos bloqueados'}
                </span>

                <button
                  type="button"
                  onClick={() => handleTogglePhase(phase.id, phase.is_active)}
                  disabled={togglingId === phase.id}
                  className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 focus:outline-none flex items-center ${
                    phase.is_active ? 'bg-emerald-500 justify-end' : 'bg-slate-800 justify-start'
                  } ${togglingId === phase.id ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
                >
                  <span className="bg-slate-950 w-4 h-4 rounded-full shadow-md transition-transform duration-200"></span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
