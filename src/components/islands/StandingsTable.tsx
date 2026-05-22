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
  const [tournamentStarted, setTournamentStarted] = useState(true);
  const [firstMatchTime, setFirstMatchTime] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  const fetchStandings = async () => {
    try {
      const response = await fetch('/api/standings');
      if (!response.ok) {
        throw new Error('Error al cargar la tabla de posiciones');
      }
      const data = await response.json();
      setTournamentStarted(data.tournamentStarted);
      setFirstMatchTime(data.firstMatchTime || null);
      setStandings(data.standings || []);
    } catch (err: any) {
      setError(err.message || 'Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStandings();

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

  useEffect(() => {
    if (tournamentStarted || !firstMatchTime) return;

    const targetDate = new Date(firstMatchTime);

    const calculateTimeLeft = () => {
      const difference = targetDate.getTime() - Date.now();
      if (difference <= 0) {
        fetchStandings();
        return;
      }

      setTimeLeft({
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60)
      });
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [tournamentStarted, firstMatchTime]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4 bg-slate-900/20 rounded-2xl border border-slate-800/60">
        <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
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

  if (!tournamentStarted) {
    const formattedDate = firstMatchTime
      ? new Date(firstMatchTime).toLocaleDateString('es-ES', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      : '';

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <span>📊</span> Clasificación General
          </h3>
          <span className="text-[10px] text-slate-500 font-mono">Privacidad Activa</span>
        </div>

        <div className="p-8 text-center bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 shadow-2xl relative overflow-hidden flex flex-col items-center justify-center gap-6">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-3xl shadow-inner select-none animate-pulse-subtle">
            🔒
          </div>

          <div className="max-w-md space-y-2">
            <h4 className="text-md font-bold text-slate-200">Clasificación Privada</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Para garantizar una competencia justa, los nombres de los participantes y la clasificación general se revelarán públicamente al comenzar el primer partido del mundial.
            </p>
          </div>

          {/* Countdown Container */}
          <div className="grid grid-cols-4 gap-3 max-w-sm w-full pt-2">
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col items-center">
              <span className="text-2xl font-black text-emerald-400 tracking-tight font-mono">
                {timeLeft.days.toString().padStart(2, '0')}
              </span>
              <span className="text-[8px] uppercase tracking-wider text-slate-500 font-bold mt-1">Días</span>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col items-center">
              <span className="text-2xl font-black text-teal-400 tracking-tight font-mono">
                {timeLeft.hours.toString().padStart(2, '0')}
              </span>
              <span className="text-[8px] uppercase tracking-wider text-slate-500 font-bold mt-1">Horas</span>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col items-center">
              <span className="text-2xl font-black text-indigo-400 tracking-tight font-mono">
                {timeLeft.minutes.toString().padStart(2, '0')}
              </span>
              <span className="text-[8px] uppercase tracking-wider text-slate-500 font-bold mt-1">Minutos</span>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col items-center">
              <span className="text-2xl font-black text-rose-400 tracking-tight font-mono">
                {timeLeft.seconds.toString().padStart(2, '0')}
              </span>
              <span className="text-[8px] uppercase tracking-wider text-slate-500 font-bold mt-1">Segundos</span>
            </div>
          </div>

          {formattedDate && (
            <p className="text-[10px] text-slate-500 font-medium">
              El torneo inicia el: <span className="capitalize text-slate-400">{formattedDate}</span>
            </p>
          )}
        </div>
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
              {(() => {
                let currentRank = 1;
                return standings.map((entry, index) => {
                  if (index > 0 && entry.total_points < standings[index - 1].total_points) {
                    currentRank = index + 1;
                  }
                  
                  const isMyEntry = myEntryIds.includes(entry.id);
                  const position = currentRank;
                  
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
              })
            })()}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
