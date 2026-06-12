import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase-browser';
import { Trophy } from 'lucide-react';

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
      <div className="w-full p-4 rounded-xl bg-slate-900/40 border border-slate-800 animate-pulse flex items-center justify-center gap-5">
        <div className="w-10 h-10 rounded-full bg-slate-800 shrink-0"></div>
        <div className="flex flex-col gap-2 w-32">
          <div className="h-3 bg-slate-800 rounded w-full"></div>
          <div className="h-6 bg-slate-800 rounded w-full"></div>
        </div>
      </div>
    );
  }

  const pool = data?.totalPool || 0;

  return (
    <div className="w-full p-4 rounded-xl bg-gradient-to-r from-slate-900/90 to-wc-dark border border-wc-gold/20 shadow-xl relative overflow-hidden flex items-center justify-center gap-5 backdrop-blur-md animate-fade-in">
      {/* Decorative shine */}
      <div className="absolute -top-12 -left-12 w-24 h-24 bg-wc-gold/10 rounded-full blur-2xl pointer-events-none"></div>

      <div className="w-10 h-10 rounded-full bg-wc-gold/10 border border-wc-gold/30 flex items-center justify-center shadow-inner shadow-wc-gold/5 select-none shrink-0 z-10">
        <Trophy className="w-5 h-5 text-wc-gold" strokeWidth={2.5} />
      </div>

      <div className="flex flex-col text-left z-10">
        <h3 className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-slate-400 font-sports leading-none">
          Pote Acumulado Oficial
        </h3>
        <div className="text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-wc-gold via-amber-400 to-yellow-300 tracking-wider font-sports select-none mt-1">
          {pool.toLocaleString('es-ES', { minimumFractionDigits: 0 })} USDT
        </div>
      </div>
    </div>
  );
}
