import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase-browser';
import { Activity } from 'lucide-react';
import { getTeamFlagUrl } from '../../utils/flags';

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

export default function LiveMatchWidget() {
  const [liveMatches, setLiveMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLiveMatches = async () => {
    try {
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .eq('status', 'live')
        .order('match_time', { ascending: true });

      if (error) throw error;
      setLiveMatches(data || []);
    } catch (e) {
      console.error('Error al cargar partidos en vivo:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveMatches();

    // Suscribirse a cambios en la tabla 'matches' en tiempo real
    const channel = supabase
      .channel('public:matches-sidebar-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches' },
        (payload) => {
          // Volver a consultar para asegurar el estado correcto de todos los partidos
          fetchLiveMatches();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return (
      <div className="p-5 rounded-2xl bg-wc-card border border-wc-border/50 animate-pulse space-y-4">
        <div className="flex justify-between items-center border-b border-wc-border pb-2.5">
          <div className="h-4 bg-wc-border rounded w-1/3"></div>
          <div className="h-4 bg-wc-border rounded w-1/6"></div>
        </div>
        <div className="h-12 bg-wc-border rounded w-full"></div>
      </div>
    );
  }

  if (liveMatches.length === 0) {
    return null; // Ocultar por completo si no hay partidos en vivo
  }

  return (
    <div className="space-y-4">
      {liveMatches.map((match) => (
        <div
          key={match.id}
          className="p-5 rounded-2xl bg-gradient-to-br from-wc-card to-slate-900 border border-wc-red/35 backdrop-blur-sm relative overflow-hidden shadow-lg shadow-wc-red/5"
        >
          {/* Decoración de fondo */}
          <div className="absolute top-0 right-0 w-24 h-24 bg-wc-red/10 rounded-full blur-2xl pointer-events-none"></div>
          <div className="absolute -bottom-10 -left-10 w-28 h-28 bg-wc-blue/5 rounded-full blur-2xl pointer-events-none"></div>

          {/* Header */}
          <div className="flex justify-between items-center border-b border-wc-border/50 pb-2.5 mb-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-350 flex items-center gap-1.5 font-sports">
              <Activity className="w-4 h-4 text-wc-red animate-pulse" strokeWidth={2.5} />
              Partido en Vivo
            </h3>
            <span className="px-2 py-0.5 rounded bg-wc-red/15 text-wc-red border border-wc-red/25 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1 animate-pulse font-sports">
              <span className="w-1.5 h-1.5 rounded-full bg-wc-red"></span>
              En Vivo
            </span>
          </div>

          {/* Contenido Principal: Marcador Grande */}
          <div className="flex items-center justify-between gap-4 my-2">
            {/* Local */}
            <div className="flex-1 flex flex-col items-center text-center min-w-0">
              {getTeamFlagUrl(match.home_team) && (
                <img
                  src={getTeamFlagUrl(match.home_team)!}
                  alt={`Bandera de ${match.home_team}`}
                  className="w-10 h-7 object-cover rounded-md shadow-md border border-slate-700/60 transition-transform hover:scale-105"
                />
              )}
              <span className="font-extrabold text-slate-200 text-xs sm:text-sm font-sports tracking-wide uppercase mt-2 truncate max-w-full" title={match.home_team}>
                {match.home_team}
              </span>
            </div>

            {/* Score */}
            <div className="flex flex-col items-center justify-center flex-shrink-0">
              <div className="flex items-center gap-2 px-4 py-2 bg-slate-950/80 rounded-2xl border border-wc-border font-sports font-black text-xl text-slate-100 min-w-[5.5rem] justify-center shadow-inner">
                <span className="text-wc-red animate-pulse">{match.home_score}</span>
                <span className="text-slate-600 font-normal">:</span>
                <span className="text-wc-red animate-pulse">{match.away_score}</span>
              </div>
              <span className="text-[9px] font-sports font-bold tracking-wider uppercase text-slate-500 mt-1.5 bg-wc-dark px-1.5 py-0.5 rounded border border-wc-border/50">
                M#{match.match_number}
              </span>
            </div>

            {/* Visitante */}
            <div className="flex-1 flex flex-col items-center text-center min-w-0">
              {getTeamFlagUrl(match.away_team) && (
                <img
                  src={getTeamFlagUrl(match.away_team)!}
                  alt={`Bandera de ${match.away_team}`}
                  className="w-10 h-7 object-cover rounded-md shadow-md border border-slate-700/60 transition-transform hover:scale-105"
                />
              )}
              <span className="font-extrabold text-slate-200 text-xs sm:text-sm font-sports tracking-wide uppercase mt-2 truncate max-w-full" title={match.away_team}>
                {match.away_team}
              </span>
            </div>
          </div>

          {/* Footer: Grupo */}
          {match.group_name && (
            <div className="text-[10px] text-slate-500 font-bold text-center mt-3 pt-2.5 border-t border-wc-border/30 font-sports tracking-wider uppercase">
              {match.group_name}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
