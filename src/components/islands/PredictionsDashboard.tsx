import React, { useState, useEffect } from 'react';
import { Star, TrendingUp, Target, BarChart2, Compass, Trophy, Award, ArrowRight, Loader2 } from 'lucide-react';

interface Entry {
  id: number;
  entry_number: number;
  display_name: string;
  status: string;
}

interface HistoryItem {
  matchId: number;
  homeTeam: string;
  awayTeam: string;
  predictedHome: number;
  predictedAway: number;
  actualHome: number;
  actualAway: number;
  pointsEarned: number;
  matchTime: string;
}

interface StatsData {
  totalPoints: number;
  ranking: number | null;
  totalParticipants: number;
  totalPredictions: number;
  correctPredictions: number;
  exactPredictions: number;
  accuracyRate: number;
  history: HistoryItem[];
}

interface PredictionsDashboardProps {
  userEntries: Entry[];
}

export default function PredictionsDashboard({ userEntries }: PredictionsDashboardProps) {
  const [selectedEntryId, setSelectedEntryId] = useState<number>(userEntries[0]?.id || 0);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedEntryId) return;

    const fetchStats = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/user/stats?entryId=${selectedEntryId}`);
        if (!res.ok) {
          throw new Error('Error al obtener estadísticas');
        }
        const data = await res.json();
        setStats(data);
      } catch (err: any) {
        setError(err.message || 'Error de conexión');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [selectedEntryId]);

  return (
    <div className="space-y-10">
      {/* Selector de cupo (si hay múltiples) */}
      {userEntries.length > 1 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-wc-card/50 border border-wc-border backdrop-blur-sm">
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider font-sports">Selecciona tu Cupo</h4>
            <p className="text-xs text-slate-400">Cambia de cupo para ver sus estadísticas individuales y realizar pronósticos correspondientes.</p>
          </div>
          <select
            value={selectedEntryId}
            onChange={(e) => setSelectedEntryId(parseInt(e.target.value))}
            className="bg-wc-dark border border-wc-border text-slate-200 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-wc-gold/80 transition-all font-sans font-medium"
          >
            {userEntries.map((entry) => (
              <option key={entry.id} value={entry.id}>
                Cupo #{entry.entry_number}: {entry.display_name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Panel de estadísticas */}
      <div className="pt-6 sm:pt-10">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-350 font-sports mb-5">Estadísticas de Pronósticos</h2>
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 rounded-2xl bg-wc-card/30 border border-wc-border flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
              </div>
            ))}
          </div>
        ) : error || !stats ? (
          <div className="p-4 rounded-xl bg-wc-red/10 border border-wc-red/20 text-center text-xs text-red-200">
            {error || 'Error al cargar estadísticas.'}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {/* Tarjeta 1: Puntos Totales */}
            <div className="p-4 sm:p-5 rounded-2xl bg-wc-card border border-wc-border flex items-center justify-between relative overflow-hidden group hover:border-wc-gold/30 transition-all duration-300">
              <div className="absolute top-0 right-0 w-24 h-24 bg-wc-gold/5 rounded-full blur-xl group-hover:bg-wc-gold/10 transition-all"></div>
              <div className="space-y-1">
                <span className="text-[10px] text-slate-450 uppercase font-sports tracking-wider block">Puntos Totales</span>
                <span className="text-3xl font-black text-white font-sports tracking-wide block">{stats.totalPoints}</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-wc-gold/10 border border-wc-gold/20 flex items-center justify-center text-wc-gold">
                <Star className="w-5 h-5" fill="currentColor" />
              </div>
            </div>

            {/* Tarjeta 2: Clasificación (Ranking) */}
            <div className="p-4 sm:p-5 rounded-2xl bg-wc-card border border-wc-border flex items-center justify-between relative overflow-hidden group hover:border-sky-500/30 transition-all duration-300">
              <div className="absolute top-0 right-0 w-24 h-24 bg-sky-550/5 rounded-full blur-xl group-hover:bg-sky-550/10 transition-all"></div>
              <div className="space-y-1">
                <span className="text-[10px] text-slate-450 uppercase font-sports tracking-wider block">Clasificación</span>
                <span className="text-3xl font-black text-white font-sports tracking-wide block">
                  {stats.ranking ? `#${stats.ranking}` : '-'}
                </span>
                <span className="text-[10px] text-slate-500 block">de {stats.totalParticipants}</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>

            {/* Tarjeta 3: Predicciones */}
            <div className="p-4 sm:p-5 rounded-2xl bg-wc-card border border-wc-border flex items-center justify-between relative overflow-hidden group hover:border-emerald-500/30 transition-all duration-300">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-550/5 rounded-full blur-xl group-hover:bg-emerald-550/10 transition-all"></div>
              <div className="space-y-1">
                <span className="text-[10px] text-slate-450 uppercase font-sports tracking-wider block">Predicciones</span>
                <span className="text-3xl font-black text-white font-sports tracking-wide block">{stats.totalPredictions}</span>
                <span className="text-[10px] text-slate-500 block">{stats.correctPredictions} correctas</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-550/10 border border-emerald-550/20 flex items-center justify-center text-emerald-450">
                <Target className="w-5 h-5" />
              </div>
            </div>

            {/* Tarjeta 4: Tasa de Acierto */}
            <div className="p-4 sm:p-5 rounded-2xl bg-wc-card border border-wc-border flex items-center justify-between relative overflow-hidden group hover:border-amber-500/30 transition-all duration-300">
              <div className="absolute top-0 right-0 w-24 h-24 bg-amber-550/5 rounded-full blur-xl group-hover:bg-amber-550/10 transition-all"></div>
              <div className="space-y-1">
                <span className="text-[10px] text-slate-450 uppercase font-sports tracking-wider block">Tasa de Acierto</span>
                <span className="text-3xl font-black text-white font-sports tracking-wide block">{stats.accuracyRate.toFixed(2)}%</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                <BarChart2 className="w-5 h-5" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Opciones de Fase (Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* CARD 1: Fase de Grupos */}
        <a
          href={`/predictions/grupos?entry=${selectedEntryId}`}
          className="group p-8 rounded-3xl bg-wc-card border border-wc-border hover:border-wc-gold/45 transition-all duration-300 flex flex-col justify-between hover:shadow-[0_0_20px_rgba(212,175,55,0.08)] relative overflow-hidden"
        >
          <div className="absolute -top-12 -right-12 w-36 h-36 bg-wc-gold/5 rounded-full blur-2xl pointer-events-none group-hover:bg-wc-gold/10 transition-all duration-300"></div>
          <div>
            <div className="w-12 h-12 rounded-2xl bg-wc-gold/10 border border-wc-gold/20 flex items-center justify-center text-wc-gold mb-6 group-hover:scale-110 transition-transform duration-300">
              <Compass className="w-6 h-6" strokeWidth={2} />
            </div>
            <h3 className="text-2xl font-bold text-white font-sports uppercase tracking-wide">Fase de Grupos</h3>
            <p className="text-xs sm:text-sm text-slate-450 mt-3 leading-relaxed">
              Pronostica los 72 partidos de la fase inicial. Organiza tus marcadores de los grupos A al L y simula la tabla de posiciones en vivo.
            </p>
          </div>
          <div className="mt-8 flex items-center justify-between">
            <span className="text-xs font-bold text-wc-gold uppercase tracking-wider font-sports">Ir a Pronosticar</span>
            <div className="w-8 h-8 rounded-xl bg-wc-dark flex items-center justify-center text-wc-gold border border-wc-border group-hover:translate-x-1.5 transition-transform">
              <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
            </div>
          </div>
        </a>

        {/* CARD 2: Fase Eliminatoria */}
        <a
          href={`/predictions/eliminatoria?entry=${selectedEntryId}`}
          className="group p-8 rounded-3xl bg-wc-card border border-wc-border hover:border-sky-500/30 transition-all duration-300 flex flex-col justify-between hover:shadow-[0_0_20px_rgba(56,189,248,0.08)] relative overflow-hidden"
        >
          <div className="absolute -top-12 -right-12 w-36 h-36 bg-sky-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-sky-500/10 transition-all duration-300"></div>
          <div>
            <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 mb-6 group-hover:scale-110 transition-transform duration-300">
              <Trophy className="w-6 h-6" strokeWidth={2} />
            </div>
            <h3 className="text-2xl font-bold text-white font-sports uppercase tracking-wide flex items-center gap-2">
              Fase Eliminatoria
              <span className="text-[10px] bg-wc-gold/15 text-wc-gold border border-wc-gold/25 px-2 py-0.5 rounded-full uppercase tracking-widest font-sports font-black">
                Prev
              </span>
            </h3>
            <p className="text-xs sm:text-sm text-slate-450 mt-3 leading-relaxed">
              Visualiza el cuadro de emparejamientos y el camino al trofeo. Esta fase se encuentra bloqueada en previsualización de ejemplo y abrirá al finalizar la fase de grupos.
            </p>
          </div>
          <div className="mt-8 flex items-center justify-between">
            <span className="text-xs font-bold text-sky-400 uppercase tracking-wider font-sports group-hover:text-sky-300 transition-colors">
              Previsualizar Llave
            </span>
            <div className="w-8 h-8 rounded-xl bg-wc-dark flex items-center justify-center text-sky-400 border border-wc-border group-hover:border-sky-500/30 group-hover:translate-x-1.5 transition-all">
              <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
            </div>
          </div>
        </a>

        {/* CARD 3: Pronóstico de Oro */}
        <a
          href={`/predictions/oro?entry=${selectedEntryId}`}
          className="group p-8 rounded-3xl bg-wc-card border border-wc-border hover:border-wc-gold/45 transition-all duration-300 flex flex-col justify-between hover:shadow-[0_0_20px_rgba(212,175,55,0.08)] relative overflow-hidden"
        >
          <div className="absolute -top-12 -right-12 w-36 h-36 bg-wc-gold/5 rounded-full blur-2xl pointer-events-none group-hover:bg-wc-gold/10 transition-all duration-300"></div>
          <div>
            <div className="w-12 h-12 rounded-2xl bg-wc-gold/10 border border-wc-gold/20 flex items-center justify-center text-wc-gold mb-6 group-hover:scale-110 transition-transform duration-300">
              <Award className="w-6 h-6" strokeWidth={2} />
            </div>
            <h3 className="text-2xl font-bold text-white font-sports uppercase tracking-wide">Pronóstico de Oro</h3>
            <p className="text-xs sm:text-sm text-slate-450 mt-3 leading-relaxed">
              Criterio clave de desempate: pronostica el Campeón del Mundo, sus goles y los de la final. Debe llenarse antes de comenzar el torneo.
            </p>
          </div>
          <div className="mt-8 flex items-center justify-between">
            <span className="text-xs font-bold text-wc-gold uppercase tracking-wider font-sports">Ir al Desempate</span>
            <div className="w-8 h-8 rounded-xl bg-wc-dark flex items-center justify-center text-wc-gold border border-wc-border group-hover:translate-x-1.5 transition-transform">
              <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
            </div>
          </div>
        </a>
      </div>

      {/* Historial de predicciones */}
      {!loading && stats && stats.history.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 font-sports">Historial de Predicciones</h2>
          <div className="overflow-hidden rounded-2xl border border-wc-border bg-wc-card/30 backdrop-blur-md">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-wc-border bg-wc-dark/30 text-slate-450 font-sports tracking-wider uppercase">
                    <th className="p-4">Partido</th>
                    <th className="p-4 text-center">Tu Pronóstico</th>
                    <th className="p-4 text-center">Resultado Real</th>
                    <th className="p-4 text-center">Puntos Ganados</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-wc-border/50 text-slate-200">
                  {stats.history.map((item) => (
                    <tr key={item.matchId} className="hover:bg-wc-card/50 transition-colors">
                      <td className="p-4 font-medium">
                        {item.homeTeam} vs {item.awayTeam}
                      </td>
                      <td className="p-4 text-center font-mono font-bold">
                        {item.predictedHome} - {item.predictedAway}
                      </td>
                      <td className="p-4 text-center font-mono font-bold text-slate-400">
                        {item.actualHome} - {item.actualAway}
                      </td>
                      <td className="p-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-bold font-sports ${
                            item.pointsEarned === 3
                              ? 'bg-wc-green/10 text-wc-green border border-wc-green/20'
                              : item.pointsEarned === 1
                              ? 'bg-wc-blue/10 text-wc-blue border border-wc-blue/20'
                              : 'bg-slate-800 text-slate-500'
                          }`}
                        >
                          +{item.pointsEarned} pt
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
