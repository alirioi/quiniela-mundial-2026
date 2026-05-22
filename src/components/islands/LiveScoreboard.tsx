import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase-browser';
import { Trophy } from 'lucide-react';

interface Match {
  id: number;
  home_team: string;
  away_team: string;
  match_time: string;
  home_score: number | null;
  away_score: number | null;
  status: 'scheduled' | 'live' | 'finished';
  group_name: string | null;
  match_number: number;
}

export default function LiveScoreboard() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTodaysMatches = async () => {
    try {
      // Buscar partidos del día de hoy y de mañana para cubrirlos todos.
      // (Filtramos en base al rango de fecha UTC de hoy y mañana +/- 24h para cubrir desfases horarios locales)
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toISOString();
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2).toISOString();

      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .gte('match_time', startOfDay)
        .lte('match_time', endOfDay)
        .order('match_time', { ascending: true });

      if (error) throw error;
      setMatches(data || []);
    } catch (e) {
      console.error('Error al cargar partidos de hoy:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTodaysMatches();

    // Suscribirse a cambios en la tabla 'matches' en vivo
    const channel = supabase
      .channel('public:matches-live')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'matches' },
        (payload) => {
          // Actualizar localmente el partido modificado
          const updatedMatch = payload.new as Match;
          setMatches((prev) =>
            prev.map((m) => (m.id === updatedMatch.id ? updatedMatch : m))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return (
      <div className="w-full p-4 bg-slate-900/40 border border-slate-800 rounded-2xl animate-pulse space-y-3">
        <div className="h-3 bg-slate-800 rounded w-1/4"></div>
        <div className="h-6 bg-slate-800 rounded w-full"></div>
      </div>
    );
  }

  if (matches.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <Trophy className="w-4 h-4 text-emerald-400" /> Partidos de la Jornada
        </h3>
        <span className="flex items-center gap-1 text-[10px] text-slate-500 font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
          Marcadores en Vivo
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {matches.map((match) => {
          const matchTime = new Date(match.match_time);
          const isLive = match.status === 'live';
          const isFinished = match.status === 'finished';
          
          return (
            <div
              key={match.id}
              className={`p-4 rounded-2xl border transition-all duration-300 relative overflow-hidden flex flex-col justify-between ${
                isLive
                  ? 'border-red-500/30 bg-red-950/5 shadow-md shadow-red-950/5'
                  : 'border-slate-800 bg-slate-950/40'
              }`}
            >
              {/* Shine decorativo para partido en vivo */}
              {isLive && (
                <div className="absolute top-0 right-0 w-16 h-16 bg-red-500/5 rounded-full blur-xl pointer-events-none"></div>
              )}

              {/* Header: Número y hora */}
              <div className="flex justify-between items-center text-[9px] text-slate-500 mb-2.5">
                <span className="font-mono bg-slate-900 px-1.5 py-0.5 rounded border border-slate-850">
                  M#{match.match_number}
                </span>

                {isLive ? (
                  <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/10 font-bold uppercase tracking-wider flex items-center gap-1 animate-pulse">
                    <span className="w-1 h-1 rounded-full bg-red-500"></span>
                    En Vivo
                  </span>
                ) : isFinished ? (
                  <span className="px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-850 font-bold uppercase tracking-wider">
                    Finalizado
                  </span>
                ) : (
                  <span className="font-semibold text-slate-400">
                    {matchTime.toLocaleTimeString('es-ES', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                )}
              </div>

              {/* Contenido principal: Equipos y Marcadores */}
              <div className="flex items-center justify-between gap-2 my-1">
                {/* Local */}
                <div className="flex-1 text-right font-bold text-slate-200 text-sm truncate" title={match.home_team}>
                  {match.home_team}
                </div>

                {/* Score */}
                <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-950 rounded-xl border border-slate-900/60 font-mono font-black text-sm text-slate-100 flex-shrink-0">
                  {match.status === 'scheduled' ? (
                    <span className="text-slate-650 text-xs">vs</span>
                  ) : (
                    <>
                      <span className={isLive ? 'text-red-400' : 'text-slate-100'}>
                        {match.home_score}
                      </span>
                      <span className="text-slate-600 font-normal">-</span>
                      <span className={isLive ? 'text-red-400' : 'text-slate-100'}>
                        {match.away_score}
                      </span>
                    </>
                  )}
                </div>

                {/* Visitante */}
                <div className="flex-1 text-left font-bold text-slate-200 text-sm truncate" title={match.away_team}>
                  {match.away_team}
                </div>
              </div>

              {/* Sub-info */}
              {match.group_name && (
                <div className="text-[9px] text-slate-500 font-semibold text-center mt-2 pt-1.5 border-t border-slate-900/40">
                  {match.group_name}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
