import React, { useState, useEffect } from 'react';
import { AlertTriangle, Edit3 } from 'lucide-react';

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
            className="p-4 rounded-2xl bg-gradient-to-r from-wc-gold/10 via-amber-550/5 to-transparent border border-wc-gold/25 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-pulse-subtle shadow-lg shadow-wc-gold/5 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-wc-gold/5 rounded-full blur-2xl pointer-events-none"></div>

            <div className="flex items-start space-x-3.5">
              <AlertTriangle className="w-5.5 h-5.5 text-wc-gold shrink-0 mt-0.5" strokeWidth={2.5} />
              <div>
                <h4 className="text-sm font-bold text-wc-gold font-sports tracking-wider uppercase">
                  Pronósticos Incompletos - Cupo "{entry.display_name}"
                </h4>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  Te faltan <span className="font-sports tracking-wider text-white bg-wc-dark px-1.5 py-0.5 rounded border border-wc-border text-xs inline-block">{entry.pendingPredictions}</span> pronósticos en la fase <span className="font-semibold text-wc-gold">{activePhase.name}</span>. Recuerda que no completar todos los marcadores te impedirá sumar puntos de esos partidos.
                </p>
              </div>
            </div>

            <a
              href={`/predictions/${activePhase.slug}`}
              className="px-4 py-2.5 bg-gradient-to-r from-wc-gold to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-slate-950 rounded-xl text-xs font-bold uppercase tracking-wider font-sports transition-all shadow-md shadow-wc-gold/20 hover:-translate-y-0.5 text-center flex-shrink-0 flex items-center justify-center gap-1.5"
            >
              <span>Completar Pronósticos</span>
              <Edit3 className="w-4 h-4 text-slate-950" strokeWidth={2.5} />
            </a>
          </div>
        );
      })}
    </div>
  );
}
