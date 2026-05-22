import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase-browser';

interface PrizePool {
  totalPool: number;
  approvedEntriesCount: number;
}

export default function PrizePoolDisplay() {
  const [data, setData] = useState<PrizePool | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPool = async () => {
    try {
      const response = await fetch('/api/prize-pool');
      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (e) {
      console.error('Error al cargar el pote de premios:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPool();

    // Suscribirse a cambios en la tabla 'entries' en vivo usando Supabase Realtime
    const channel = supabase
      .channel('public:entries')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'entries' },
        () => {
          fetchPool();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return (
      <div className="w-full p-6 rounded-2xl bg-slate-900/40 border border-slate-800 animate-pulse flex items-center justify-between">
        <div className="h-4 bg-slate-800 rounded w-1/3"></div>
        <div className="h-8 bg-slate-800 rounded w-1/4"></div>
      </div>
    );
  }

  const pool = data?.totalPool || 0;
  const count = data?.approvedEntriesCount || 0;

  return (
    <div className="w-full p-6 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-indigo-500/10 border border-emerald-500/20 shadow-2xl relative overflow-hidden flex flex-col sm:flex-row items-center justify-between gap-6 backdrop-blur-md">
      {/* Decorative shine */}
      <div className="absolute -top-12 -left-12 w-32 h-32 bg-emerald-400/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-indigo-400/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="flex items-center space-x-4">
        <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-3xl shadow-inner shadow-emerald-500/5 select-none animate-pulse-subtle">
          🏆
        </div>
        <div className="text-center sm:text-left">
          <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-400">
            Pote Acumulado Oficial
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            El 100% de este pote acumulado se entregará al primer lugar (único ganador) al finalizar el torneo. ({count} {count === 1 ? 'cupo aprobado' : 'cupos aprobados'})
          </p>
        </div>
      </div>

      <div className="text-center sm:text-right flex-shrink-0">
        <div className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-indigo-400 tracking-tight font-mono">
          {pool.toLocaleString('es-ES', { minimumFractionDigits: 0 })} USDT
        </div>
      </div>
    </div>
  );
}
