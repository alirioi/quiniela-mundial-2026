import React, { useState, useEffect } from 'react';

interface EntryWithPending {
  id: number;
  display_name: string;
  entry_number: number;
  pendingPredictions: number;
  activePhases: { id: number; name: string; slug: string }[];
}

export default function PredictionWarningBanner() {
  const [entries, setEntries] = useState<EntryWithPending[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPendingStatus = async () => {
      try {
        const response = await fetch('/api/user/entries');
        if (response.ok) {
          const data = await response.json();
          setEntries(data);
        }
      } catch (e) {
        console.error('Error al verificar alertas de predicciones:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchPendingStatus();
  }, []);

  if (loading) return null;

  // Filtrar entradas que tengan pronósticos pendientes y fases activas
  const pendingEntries = entries.filter((e) => e.pendingPredictions > 0 && e.activePhases.length > 0);

  if (pendingEntries.length === 0) return null;

  return (
    <div className="space-y-3">
      {pendingEntries.map((entry) => {
        const activePhase = entry.activePhases[0]; // Tomar la primera fase activa por defecto
        
        return (
          <div
            key={entry.id}
            className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-pulse-subtle shadow-lg shadow-amber-950/5 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl pointer-events-none"></div>

            <div className="flex items-start space-x-3">
              <span className="text-xl mt-0.5">⚠️</span>
              <div>
                <h4 className="text-sm font-bold text-amber-400">
                  Pronósticos Incompletos - Cupo "{entry.display_name}"
                </h4>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  Te faltan <span className="font-bold text-white">{entry.pendingPredictions}</span> pronósticos en la phase <span className="font-semibold text-amber-300">{activePhase.name}</span>. Recuerda que no completar todos los marcadores te impedirá sumar puntos de esos partidos.
                </p>
              </div>
            </div>

            <a
              href={`/predictions/${activePhase.slug}`}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold transition-all shadow-md shadow-amber-950/20 hover:-translate-y-0.5 text-center flex-shrink-0"
            >
              Completar Pronósticos ✍️
            </a>
          </div>
        );
      })}
    </div>
  );
}
