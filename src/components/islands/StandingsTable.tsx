import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase-browser';

interface StandingEntry {
  id: number;
  display_name: string;
  total_points: number;
  created_at: string;
}

interface StandingsTableProps {
  myEntryIds: number[];
}

export default function StandingsTable({ myEntryIds }: StandingsTableProps) {
  const [standings, setStandings] = useState<StandingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStandings = async () => {
    try {
      const response = await fetch('/api/standings');
      if (!response.ok) {
        throw new Error('Error al cargar la tabla de posiciones');
      }
      const data = await response.json();
      setStandings(data);
    } catch (err: any) {
      setError(err.message || 'Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStandings();

    // Suscribirse a cambios en la tabla 'entries' en vivo usando Supabase Realtime
    // Esto se dispara cuando el admin actualiza los resultados, y los triggers recalculan los puntos
    const channel = supabase
      .channel('public:entries-standings')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'entries' },
        () => {
          fetchStandings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4 bg-slate-900/20 rounded-2xl border border-slate-800/60">
        <div className="animate-spin text-3xl">🔄</div>
        <p className="text-slate-500 text-sm">Cargando clasificación...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-xl bg-red-950/20 border border-red-900/30 text-center text-xs text-red-400">
        ⚠️ {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <span>📊</span> Clasificación General
        </h3>
        <span className="text-[10px] text-slate-500 font-mono">Actualizado en tiempo real</span>
      </div>

      {standings.length === 0 ? (
        <div className="p-8 text-center bg-slate-900/20 rounded-2xl border border-slate-800/60 text-slate-500 text-sm">
          🏆 La clasificación se generará una vez que comiencen los partidos y se aprueben los cupos.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/40 backdrop-blur-sm shadow-xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[10px] uppercase font-bold tracking-wider text-slate-400 bg-slate-900/20">
                <th className="p-4 w-16 text-center">Pos</th>
                <th className="p-4">Participante / Cupo</th>
                <th className="p-4 text-right w-24">Puntos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40 text-sm font-medium">
              {standings.map((entry, index) => {
                const isMyEntry = myEntryIds.includes(entry.id);
                const position = index + 1;
                
                // Estilo para el top 3
                let medal = '';
                let posColor = 'text-slate-400';
                if (position === 1) {
                  medal = '🥇';
                  posColor = 'text-amber-400 font-bold';
                } else if (position === 2) {
                  medal = '🥈';
                  posColor = 'text-slate-300 font-bold';
                } else if (position === 3) {
                  medal = '🥉';
                  posColor = 'text-amber-600 font-bold';
                }

                return (
                  <tr
                    key={entry.id}
                    className={`transition-all duration-200 hover:bg-slate-900/10 ${
                      isMyEntry
                        ? 'bg-emerald-500/5 hover:bg-emerald-500/10 border-l-4 border-l-emerald-500'
                        : ''
                    }`}
                  >
                    <td className="p-4 text-center">
                      {medal ? (
                        <span className="text-lg">{medal}</span>
                      ) : (
                        <span className={`font-mono text-xs ${posColor}`}>{position}</span>
                      )}
                    </td>
                    <td className="p-4 flex items-center gap-2">
                      <span className={isMyEntry ? 'font-bold text-emerald-400' : 'text-slate-200'}>
                        {entry.display_name}
                      </span>
                      {isMyEntry && (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[9px] font-bold uppercase border border-emerald-500/10">
                          Tú
                        </span>
                      )}
                    </td>
                    <td className={`p-4 text-right font-mono font-bold text-sm ${
                      isMyEntry ? 'text-emerald-400' : 'text-slate-300'
                    }`}>
                      {entry.total_points}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
