import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase-browser';
import { Trophy, Lock, BarChart3, AlertTriangle, ArrowUp, ArrowDown, Minus } from 'lucide-react';

interface StandingEntry {
  id: number;
  display_name: string;
  total_points: number;
  created_at: string;
  previous_rank: number | null;
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
  const [currentPage, setCurrentPage] = useState(1);

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

    let timeoutId: NodeJS.Timeout;
    const debouncedFetch = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(fetchStandings, 2000);
    };

    const channel = supabase
      .channel('public:entries-standings')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'entries' },
        () => {
          debouncedFetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      clearTimeout(timeoutId);
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
      <div className="flex flex-col items-center justify-center p-12 space-y-4 bg-wc-card/20 rounded-2xl border border-wc-border">
        <div className="w-8 h-8 border-3 border-wc-gold border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-400 text-sm font-sports uppercase tracking-wider">Cargando clasificación...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-xl bg-wc-red/10 border border-wc-red/20 text-center text-xs text-red-200 flex items-center justify-center gap-1.5">
        <AlertTriangle className="w-4.5 h-4.5 text-wc-red" strokeWidth={2.5} />
        <span>{error}</span>
      </div>
    );
  }

  if (!tournamentStarted) {
    let formattedDate = '';
    if (firstMatchTime) {
      const firstDate = new Date(firstMatchTime);
      const dateStr = firstDate.toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      const timeStr = firstDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
      const capitalizedDateStr = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
      formattedDate = `${capitalizedDateStr} a las ${timeStr}`;
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base sm:text-lg font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2 font-sports">
            <BarChart3 className="w-5 h-5 text-wc-gold" strokeWidth={2.5} />
            <span>Clasificación General</span>
          </h3>
          <span className="text-xs sm:text-sm text-slate-400 font-sports uppercase tracking-wider">Privacidad Activa</span>
        </div>

        <div className="p-8 text-center bg-wc-card border border-wc-border shadow-2xl relative overflow-hidden flex flex-col items-center justify-center gap-6 rounded-2xl">
          <div className="absolute top-0 right-0 w-32 h-32 bg-wc-gold/5 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="w-14 h-14 rounded-full bg-wc-gold/10 border border-wc-gold/20 flex items-center justify-center shadow-inner select-none animate-pulse">
            <Lock className="w-6 h-6 text-wc-gold" strokeWidth={2.5} />
          </div>

          <div className="max-w-md space-y-2">
            <h4 className="text-xl font-bold text-white font-sports uppercase tracking-wider">Clasificación Privada</h4>
            <p className="text-sm sm:text-base text-slate-350 leading-relaxed">
              Para garantizar una competencia justa, los nombres de los participantes y la clasificación general se revelarán públicamente al comenzar el primer partido del mundial.
            </p>
          </div>

          {/* Countdown Container */}
          <div className="grid grid-cols-4 gap-2 sm:gap-3 max-w-sm w-full pt-2">
            <div className="bg-wc-dark border border-wc-border rounded-xl p-2 sm:p-3 flex flex-col items-center">
              <span className="text-3xl sm:text-4xl font-bold text-wc-gold tracking-wider font-sports">
                {timeLeft.days.toString().padStart(2, '0')}
              </span>
              <span className="text-[9px] sm:text-xs uppercase tracking-wider text-slate-400 font-sports mt-1">Días</span>
            </div>
            <div className="bg-wc-dark border border-wc-border rounded-xl p-2 sm:p-3 flex flex-col items-center">
              <span className="text-3xl sm:text-4xl font-bold text-wc-blue tracking-wider font-sports">
                {timeLeft.hours.toString().padStart(2, '0')}
              </span>
              <span className="text-[9px] sm:text-xs uppercase tracking-wider text-slate-400 font-sports mt-1">Horas</span>
            </div>
            <div className="bg-wc-dark border border-wc-border rounded-xl p-2 sm:p-3 flex flex-col items-center">
              <span className="text-3xl sm:text-4xl font-bold text-white tracking-wider font-sports">
                {timeLeft.minutes.toString().padStart(2, '0')}
              </span>
              <span className="text-[9px] sm:text-xs uppercase tracking-wider text-slate-400 font-sports mt-1">Minutos</span>
            </div>
            <div className="bg-wc-dark border border-wc-border rounded-xl p-2 sm:p-3 flex flex-col items-center">
              <span className="text-3xl sm:text-4xl font-bold text-wc-red tracking-wider font-sports">
                {timeLeft.seconds.toString().padStart(2, '0')}
              </span>
              <span className="text-[9px] sm:text-xs uppercase tracking-wider text-slate-400 font-sports mt-1">Segundos</span>
            </div>
          </div>

          {formattedDate && (
            <p className="text-sm sm:text-base text-slate-350 font-bold uppercase tracking-wider font-sports">
              El torneo inicia el: <span className="capitalize text-white">{formattedDate}</span>
            </p>
          )}
        </div>
      </div>
    );
  }

  const rankedStandings: (StandingEntry & { rank: number })[] = [];
  let currentRank = 1;
  for (let i = 0; i < standings.length; i++) {
    if (i > 0 && standings[i].total_points !== standings[i - 1].total_points) {
      currentRank = i + 1;
    }
    rankedStandings.push({
      ...standings[i],
      rank: currentRank
    });
  }


  // Filtrar cupos propios
  const myRankedEntries = rankedStandings.filter(entry => myEntryIds.includes(entry.id));

  // Paginación local
  const itemsPerPage = Math.max(1, Math.ceil(rankedStandings.length / 2));
  const totalPages = Math.max(1, Math.ceil(rankedStandings.length / itemsPerPage));
  const activePage = Math.min(currentPage, totalPages);
  const paginatedStandings = rankedStandings.slice((activePage - 1) * itemsPerPage, activePage * itemsPerPage);

  return (
    <div className="space-y-6">
      {/* Tus Posiciones (Parte Superior) */}
      {myRankedEntries.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-wc-gold flex items-center gap-1.5 font-sports">
              <Trophy className="w-4 h-4 text-wc-gold" strokeWidth={2.5} />
              <span>Mis Cupos en la Clasificación</span>
            </h4>
          </div>
          <div className="overflow-hidden rounded-2xl border border-wc-gold/20 bg-wc-gold/5 shadow-inner">
            <table className="w-full text-left border-collapse">
              <tbody className="divide-y divide-wc-border/30 text-sm font-medium">
                {myRankedEntries.map((entry) => {
                  const position = entry.rank;
                  let medal: React.ReactNode = null;
                  let posColor = 'text-slate-355';
                  if (position === 1) {
                    medal = <Trophy className="w-4.5 h-4.5 text-wc-gold fill-wc-gold/10 mx-auto" strokeWidth={2.5} />;
                    posColor = 'text-wc-gold font-bold';
                  }

                  return (
                    <tr key={entry.id} className="bg-wc-gold/5 border-l-4 border-l-wc-gold">
                      <td className="p-3.5 w-16 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {medal ? (
                            <div className="flex justify-center">{medal}</div>
                          ) : (
                            <span className={`font-sports text-xs sm:text-sm ${posColor}`}>{position}</span>
                          )}

                           {/* Rank movement trend indicator */}
                          <span className="flex items-center text-[10px] font-bold select-none gap-0.5" title={`Posición anterior: ${entry.previous_rank || 'Ninguna'}`}>
                            {entry.previous_rank !== null && entry.previous_rank !== undefined ? (
                              position < entry.previous_rank ? (
                                <>
                                  <ArrowUp className="w-3 h-3 text-green-500 animate-bounce" strokeWidth={3} />
                                  <span className="text-green-500 font-sports">{entry.previous_rank - position}</span>
                                </>
                              ) : position > entry.previous_rank ? (
                                <>
                                  <ArrowDown className="w-3.5 h-3.5 text-red-500" strokeWidth={3} />
                                  <span className="text-red-500 font-sports">{position - entry.previous_rank}</span>
                                </>
                              ) : (
                                <Minus className="w-3.5 h-3.5 text-slate-500" strokeWidth={3} />
                              )
                            ) : (
                              <Minus className="w-3.5 h-3.5 text-slate-500" strokeWidth={3} />
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="p-3.5">
                        <span className="font-bold text-wc-gold">{entry.display_name}</span>
                      </td>
                      <td className="p-3.5 text-right font-sports text-sm sm:text-base tracking-wider text-wc-gold font-bold w-24">
                        {entry.total_points} Pts
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Clasificación General (Parte Inferior) */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5 font-sports">
            <BarChart3 className="w-4.5 h-4.5 text-wc-gold" strokeWidth={2.5} />
            <span>Clasificación General</span>
          </h3>
          <span className="text-[10px] text-slate-400 font-sports uppercase tracking-wider">En tiempo real</span>
        </div>

        {standings.length === 0 ? (
          <div className="p-8 text-center bg-wc-card/45 border border-wc-border text-slate-400 text-xs flex flex-col items-center justify-center gap-3 rounded-2xl">
            <Trophy className="w-8 h-8 text-slate-655" strokeWidth={2.5} />
            <p>La clasificación se generará una vez que comiencen los partidos y se aprueben los cupos.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-wc-border bg-wc-card shadow-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-wc-border text-xs uppercase font-bold tracking-wider text-slate-350 bg-wc-dark/50 font-sports">
                  <th className="p-4 w-16 text-center">Pos</th>
                  <th className="p-4">Participante / Cupo</th>
                  <th className="p-4 text-right w-24">Puntos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-wc-border/50 text-sm font-medium">
                {paginatedStandings.map((entry) => {
                  const isMyEntry = myEntryIds.includes(entry.id);
                  const position = entry.rank;
                  
                  let medal: React.ReactNode = null;
                  let posColor = 'text-slate-450';
                  if (position === 1) {
                    medal = <Trophy className="w-4.5 h-4.5 text-wc-gold fill-wc-gold/10 mx-auto" strokeWidth={2.5} />;
                    posColor = 'text-wc-gold font-bold';
                  }

                  return (
                    <tr
                      key={entry.id}
                      className={`transition-all duration-200 hover:bg-wc-dark/30 ${
                        isMyEntry
                          ? 'bg-wc-gold/5 hover:bg-wc-gold/10 border-l-4 border-l-wc-gold'
                          : ''
                      }`}
                    >
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {medal ? (
                            <div className="flex justify-center">{medal}</div>
                          ) : (
                            <span className={`font-sports text-sm ${posColor}`}>{position}</span>
                          )}
                          
                          {/* Rank movement trend indicator */}
                          <span className="flex items-center text-[10px] font-bold select-none gap-0.5" title={`Posición anterior: ${entry.previous_rank || 'Ninguna'}`}>
                            {entry.previous_rank !== null && entry.previous_rank !== undefined ? (
                              position < entry.previous_rank ? (
                                <>
                                  <ArrowUp className="w-3 h-3 text-green-500 animate-bounce" strokeWidth={3} />
                                  <span className="text-green-500 font-sports">{entry.previous_rank - position}</span>
                                </>
                              ) : position > entry.previous_rank ? (
                                <>
                                  <ArrowDown className="w-3.5 h-3.5 text-red-500" strokeWidth={3} />
                                  <span className="text-red-500 font-sports">{position - entry.previous_rank}</span>
                                </>
                              ) : (
                                <Minus className="w-3.5 h-3.5 text-slate-500" strokeWidth={3} />
                              )
                            ) : (
                              <Minus className="w-3.5 h-3.5 text-slate-500" strokeWidth={3} />
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 flex items-center gap-2">
                        <span className={isMyEntry ? 'font-bold text-wc-gold' : 'text-slate-200 font-medium'}>
                          {entry.display_name}
                        </span>
                        {isMyEntry && (
                          <span className="px-2 py-0.5 rounded bg-wc-gold/15 text-wc-gold text-[9px] font-bold uppercase border border-wc-gold/20 font-sports tracking-wider">
                            Tú
                          </span>
                        )}
                      </td>
                      <td className={`p-4 text-right font-sports text-sm sm:text-base tracking-wider ${
                        isMyEntry ? 'text-wc-gold font-bold' : 'text-slate-250 font-medium'
                      }`}>
                        {entry.total_points}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Paginador */}
            {totalPages > 1 && (
              <div className="px-5 py-4 border-t border-wc-border bg-wc-dark/40 flex items-center justify-between gap-4 text-xs font-sports tracking-wider uppercase select-none">
                <button
                  type="button"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={activePage === 1}
                  className="px-3.5 py-1.5 rounded-lg border border-wc-border hover:border-wc-gold text-slate-450 hover:text-wc-gold disabled:opacity-40 disabled:hover:text-slate-450 disabled:hover:border-wc-border transition-all cursor-pointer font-bold"
                >
                  Anterior
                </button>
                <span className="text-slate-450 text-[10px] sm:text-xs">
                  Página <strong className="text-white font-sans text-xs sm:text-sm">{activePage}</strong> de <strong className="text-white font-sans text-xs sm:text-sm">{totalPages}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={activePage === totalPages}
                  className="px-3.5 py-1.5 rounded-lg border border-wc-border hover:border-wc-gold text-slate-450 hover:text-wc-gold disabled:opacity-40 disabled:hover:text-slate-450 disabled:hover:border-wc-border transition-all cursor-pointer font-bold"
                >
                  Siguiente
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
