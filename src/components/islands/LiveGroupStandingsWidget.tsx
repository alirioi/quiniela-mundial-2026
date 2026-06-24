import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase-browser';
import { BarChart3 } from 'lucide-react';
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
  phase_id: number;
}

interface TeamStats {
  team: string;
  group: string;
  pj: number;
  g: number;
  e: number;
  p: number;
  gf: number;
  gc: number;
  dg: number;
  pts: number;
}

interface Props {
  initialMatches: Match[];
}

export default function LiveGroupStandingsWidget({ initialMatches }: Props) {
  const [matches, setMatches] = useState<Match[]>(initialMatches);

  // Suscribirse a cambios en tiempo real en los partidos
  useEffect(() => {
    const channel = supabase
      .channel('public:matches-live-standings-widget')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches' },
        (payload) => {
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

  // 1. Encontrar el grupo activo (en vivo o el siguiente)
  const activeGroup = useMemo(() => {
    // Buscar primero partidos en vivo en fase de grupos (phase_id === 1)
    const liveGroupMatch = matches.find(m => m.status === 'live' && m.group_name && m.phase_id === 1);
    if (liveGroupMatch) {
      return liveGroupMatch.group_name;
    }

    // Si no hay partidos en vivo, buscar el siguiente programado en fase de grupos
    const now = new Date().getTime();
    const groupMatches = matches.filter(m => m.phase_id === 1 && m.group_name);
    
    const nextGroupMatch = groupMatches
      .filter(m => m.status === 'scheduled' && new Date(m.match_time).getTime() > now)
      .sort((a, b) => new Date(a.match_time).getTime() - new Date(b.match_time).getTime())[0];

    if (nextGroupMatch) {
      return nextGroupMatch.group_name;
    }

    // Si no hay partidos en vivo ni futuros, buscar el último partido de grupos que terminó
    const finishedGroupMatches = groupMatches.filter(m => m.status === 'finished');
    if (finishedGroupMatches.length > 0) {
      // Ordenar por hora descendente para obtener el más reciente
      const lastFinished = finishedGroupMatches.sort((a, b) => new Date(b.match_time).getTime() - new Date(a.match_time).getTime())[0];
      return lastFinished.group_name;
    }

    return 'Grupo A'; // Fallback
  }, [matches]);

  // 2. Procesar las tablas de posiciones del grupo activo
  const standings = useMemo(() => {
    if (!activeGroup) return [];

    const stats: Record<string, TeamStats> = {};

    const currentGroupMatches = matches.filter(m => m.group_name === activeGroup && m.phase_id === 1);

    currentGroupMatches.forEach(match => {
      const home = match.home_team;
      const away = match.away_team;

      if (!stats[home]) {
        stats[home] = { team: home, group: activeGroup, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, dg: 0, pts: 0 };
      }
      if (!stats[away]) {
        stats[away] = { team: away, group: activeGroup, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, dg: 0, pts: 0 };
      }

      if ((match.status === 'finished' || match.status === 'live') && match.home_score !== null && match.away_score !== null) {
        stats[home].pj++;
        stats[away].pj++;
        stats[home].gf += match.home_score;
        stats[home].gc += match.away_score;
        stats[away].gf += match.away_score;
        stats[away].gc += match.home_score;

        if (match.home_score > match.away_score) {
          stats[home].g++;
          stats[home].pts += 3;
          stats[away].p++;
        } else if (match.home_score < match.away_score) {
          stats[away].g++;
          stats[away].pts += 3;
          stats[home].p++;
        } else {
          stats[home].e++;
          stats[away].e++;
          stats[home].pts += 1;
          stats[away].pts += 1;
        }
      }
    });

    const teams = Object.values(stats);
    teams.forEach(t => t.dg = t.gf - t.gc);

    // Ordenar según criterios FIFA (pts -> dg -> gf)
    teams.sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      if (b.dg !== a.dg) return b.dg - a.dg;
      if (b.gf !== a.gf) return b.gf - a.gf;
      return a.team.localeCompare(b.team);
    });

    return teams;
  }, [matches, activeGroup]);

  return (
    <div className="p-5 rounded-2xl bg-wc-card border border-wc-border backdrop-blur-sm space-y-4 relative overflow-hidden flex flex-col">
      <div className="absolute top-0 right-0 w-20 h-20 bg-wc-gold/5 rounded-full blur-xl pointer-events-none"></div>
      
      <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center justify-between border-b border-wc-border pb-2.5 font-sports">
        <span className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-wc-gold" strokeWidth={2.5} /> Estadísticas en Vivo
        </span>
        {activeGroup && (
          <span className="text-[10px] bg-wc-gold/15 text-wc-gold px-2 py-0.5 rounded-full border border-wc-gold/20 font-bold uppercase tracking-widest">
            {activeGroup}
          </span>
        )}
      </h3>

      {standings.length === 0 ? (
        <div className="text-center py-6 text-xs text-slate-400 font-sports uppercase tracking-wider">
          No hay datos del grupo disponibles.
        </div>
      ) : (
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-wc-dark/30 text-[10px] uppercase font-sports tracking-wider text-slate-500 border-b border-wc-border/30">
                <th className="px-1 py-1.5 text-center w-6">#</th>
                <th className="px-1 py-1.5">Equipo</th>
                <th className="px-1 py-1.5 text-center w-8" title="Partidos Jugados">PJ</th>
                <th className="px-1 py-1.5 text-center w-8" title="Diferencia de Goles">DG</th>
                <th className="px-1 py-1.5 text-center w-8 text-wc-gold" title="Puntos">PTS</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((team, idx) => {
                const flagUrl = getTeamFlagUrl(team.team);
                const isQualifier = idx < 2;
                
                return (
                  <tr key={team.team} className="border-b border-wc-border/10 hover:bg-white/5 transition-colors text-xs">
                    <td className="px-1 py-2 text-center">
                      <span className={`font-sports font-bold ${isQualifier ? 'text-wc-green' : 'text-slate-450'}`}>
                        {idx + 1}
                      </span>
                    </td>
                    <td className="px-1 py-2 font-bold text-slate-200">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {flagUrl ? (
                          <img src={flagUrl} alt="" className="w-4 h-3 object-cover rounded-[1px] shadow-sm flex-shrink-0" />
                        ) : (
                          <div className="w-4 h-3 bg-slate-700 rounded-[1px] flex-shrink-0"></div>
                        )}
                        <span className="truncate max-w-[100px]">{team.team}</span>
                      </div>
                    </td>
                    <td className="px-1 py-2 text-center text-slate-350 font-medium">{team.pj}</td>
                    <td className="px-1 py-2 text-center font-medium text-slate-350">
                      {team.dg > 0 ? `+${team.dg}` : team.dg}
                    </td>
                    <td className="px-1 py-2 text-center font-bold text-wc-gold">{team.pts}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="pt-2 flex flex-col gap-2">
        <p className="text-[11px] text-slate-400 text-center leading-relaxed">
          Puedes ver más estadísticas en este botón (goleadores, todos los grupos, calendario completo).
        </p>
        <a
          href="/mundial"
          className="w-full py-2.5 text-center bg-wc-dark hover:bg-slate-800 text-slate-200 hover:text-white rounded-xl text-xs font-bold font-sports tracking-wider uppercase border border-wc-border hover:border-wc-gold/40 transition-all flex items-center justify-center gap-1.5"
        >
          Ver Estadísticas
        </a>
      </div>
    </div>
  );
}
