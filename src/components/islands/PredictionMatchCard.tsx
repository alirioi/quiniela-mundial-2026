import React from 'react';
import { AlertTriangle, CheckCircle2, Award, Lock, Clock } from 'lucide-react';

interface PredictionMatchCardProps {
  matchKey: string | number;

  // Header Info
  headerLabel: string;
  matchStatus: 'scheduled' | 'live' | 'finished';
  countdown?: string;
  locked: boolean;
  matchTime?: string;

  // Teams
  homeTeam: string;
  awayTeam: string;
  homeFlag?: string | null;
  awayFlag?: string | null;
  isPlaceholder?: boolean;

  // Inputs
  currentHomeStr: string;
  currentAwayStr: string;
  onScoreChange: (side: 'home' | 'away', val: string) => void;

  // Prediction status
  hasChanges: boolean;
  hasSavedPrediction: boolean;

  // Match results
  realHomeScore?: number | null;
  realAwayScore?: number | null;
  pointsEarned?: number | null;
}

export const PredictionMatchCard: React.FC<PredictionMatchCardProps> = ({
  matchKey,
  headerLabel,
  matchStatus,
  countdown,
  locked,
  matchTime,
  homeTeam,
  awayTeam,
  homeFlag,
  awayFlag,
  isPlaceholder,
  currentHomeStr,
  currentAwayStr,
  onScoreChange,
  hasChanges,
  hasSavedPrediction,
  realHomeScore,
  realAwayScore,
  pointsEarned,
}) => {
  const inputDisabled = locked || isPlaceholder;

  return (
    <div
      className={`p-4 sm:p-5 rounded-2xl border transition-all duration-300 flex flex-col justify-between ${
        locked
          ? 'border-wc-border bg-wc-dark/30 opacity-90'
          : hasChanges
          ? 'border-wc-gold/30 bg-wc-gold/5 animate-pulse'
          : hasSavedPrediction
          ? 'border-wc-gold/25 bg-wc-card/50'
          : 'border-wc-border bg-wc-card'
      }`}
    >
      {/* Header: Etiqueta + Estado */}
      <div className="flex justify-between items-center text-xs text-slate-500 mb-4 pb-2.5 border-b border-wc-border/50 min-w-0 w-full">
        <div className="flex flex-col gap-0.5 min-w-0 flex-1 pr-2">
          <span className="font-bold text-slate-300 font-sports uppercase tracking-wider text-[11px] sm:text-xs truncate block" title={headerLabel}>
            {headerLabel}
          </span>
          {matchTime && (
            <span className="text-[10px] text-slate-450 font-medium whitespace-nowrap">
              {(() => {
                try {
                  const date = new Date(matchTime);
                  const options: Intl.DateTimeFormatOptions = {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                  };
                  let formatted = date.toLocaleDateString('es-ES', options);
                  formatted = formatted.replace(/\s*[ap]\.?\s*m\.?/i, (m) => {
                    return m.toLowerCase().includes('p') ? ' pm' : ' am';
                  });
                  return formatted;
                } catch (e) {
                  return matchTime;
                }
              })()}
            </span>
          )}
        </div>

        {/* Estado o cuenta regresiva */}
        <div className="flex items-center gap-1.5 font-bold text-xs">
          {matchStatus === 'live' ? (
            <span className="px-2.5 py-1 bg-wc-red/10 text-wc-red rounded-lg border border-wc-red/20 animate-pulse text-xs uppercase tracking-wider flex items-center gap-1 font-sports">
              <span className="w-1.5 h-1.5 rounded-full bg-wc-red inline-block animate-ping"></span>
              <span>En vivo</span>
            </span>
          ) : matchStatus === 'finished' ? (
            <span className="px-2.5 py-1 bg-wc-dark text-slate-400 rounded-lg border border-wc-border text-xs uppercase tracking-wider font-sports font-bold">
              Finalizado
            </span>
          ) : (
            <span className={`flex items-center gap-1 font-sports ${locked ? 'text-wc-red' : 'text-wc-gold'}`}>
              {locked ? (
                <Lock className="w-3.5 h-3.5 shrink-0 text-wc-red" strokeWidth={2.5} />
              ) : (
                <Clock className="w-3.5 h-3.5 shrink-0 text-wc-gold animate-pulse" strokeWidth={2.5} />
              )}
              {countdown && <span className="text-[11px]">{countdown}</span>}
            </span>
          )}
        </div>
      </div>

      {/* Equipos y Marcador */}
      <div className="flex items-start justify-between gap-2 sm:gap-4 my-1">
        {/* Local */}
        <div className="flex-1 flex flex-col items-center text-center min-w-0 gap-1.5">
          {homeFlag ? (
            <img
              src={homeFlag}
              alt={homeTeam}
              className="w-10 h-7 sm:w-12 sm:h-8 object-cover rounded-md shadow-md border border-slate-700/50"
            />
          ) : (
            <div className="w-10 h-7 sm:w-12 sm:h-8 bg-slate-700 rounded-md" />
          )}
          <span
            className="font-bold text-slate-200 text-[11px] sm:text-xs md:text-sm font-sports uppercase tracking-wide leading-tight text-center max-w-[95px] sm:max-w-[130px]"
            title={homeTeam}
          >
            {homeTeam}
          </span>
        </div>

        {/* Inputs de pronóstico */}
        <div className="flex flex-col items-center justify-center flex-shrink-0 gap-0.5 pt-0.5">
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={2}
              value={currentHomeStr}
              onChange={(e) => onScoreChange('home', e.target.value)}
              disabled={inputDisabled}
              placeholder="-"
              className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-wc-dark text-center text-base sm:text-lg font-bold font-sports border focus:outline-none focus:ring-2 focus:ring-wc-gold/40 transition-all ${
                inputDisabled
                  ? 'border-wc-border text-slate-400 cursor-not-allowed bg-wc-dark/55'
                  : 'border-wc-border text-wc-gold focus:border-wc-gold'
              }`}
            />
            <span className="text-slate-500 font-bold text-base font-sports">-</span>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={2}
              value={currentAwayStr}
              onChange={(e) => onScoreChange('away', e.target.value)}
              disabled={inputDisabled}
              placeholder="-"
              className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-wc-dark text-center text-base sm:text-lg font-bold font-sports border focus:outline-none focus:ring-2 focus:ring-wc-gold/40 transition-all ${
                inputDisabled
                  ? 'border-wc-border text-slate-400 cursor-not-allowed bg-wc-dark/55'
                  : 'border-wc-border text-wc-gold focus:border-wc-gold'
              }`}
            />
          </div>
        </div>

        {/* Visitante */}
        <div className="flex-1 flex flex-col items-center text-center min-w-0 gap-1.5">
          {awayFlag ? (
            <img
              src={awayFlag}
              alt={awayTeam}
              className="w-10 h-7 sm:w-12 sm:h-8 object-cover rounded-md shadow-md border border-slate-700/50"
            />
          ) : (
            <div className="w-10 h-7 sm:w-12 sm:h-8 bg-slate-700 rounded-md" />
          )}
          <span
            className="font-bold text-slate-200 text-[11px] sm:text-xs md:text-sm font-sports uppercase tracking-wide leading-tight text-center max-w-[95px] sm:max-w-[130px]"
            title={awayTeam}
          >
            {awayTeam}
          </span>
        </div>
      </div>

      {/* Footer: Estado del pronóstico / Resultado real / Puntos */}
      <div className="mt-4 pt-3 border-t border-wc-border/50 flex items-center justify-between gap-3">
        {/* Izquierda: Estado */}
        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-bold font-sports uppercase tracking-wider shrink-0">
          {matchStatus === 'live' || matchStatus === 'finished' ? (
            <span>Resultado:</span>
          ) : hasSavedPrediction ? (
            <span className="text-slate-400 font-bold flex items-center gap-1 font-sports uppercase tracking-wider text-[10px] sm:text-xs">
              <CheckCircle2 className="w-4 h-4 text-wc-gold" strokeWidth={2.5} />
              <span className="hidden sm:inline">Pronóstico Guardado</span>
            </span>
          ) : (
            <span className="text-wc-gold font-bold flex items-center gap-1 font-sports uppercase tracking-wider text-[10px] sm:text-xs">
              <AlertTriangle className="w-4 h-4 text-wc-gold animate-pulse" strokeWidth={2.5} />
              <span className="hidden sm:inline">Sin Pronóstico</span>
            </span>
          )}
        </div>

        {/* Centro: Marcador real */}
        {(matchStatus === 'live' || matchStatus === 'finished') && (
          <div className="flex items-center gap-2 px-2.5 py-1 bg-wc-dark rounded-xl border border-wc-border font-sports font-black text-xs sm:text-sm text-slate-200 shadow-inner">
            <span className={matchStatus === 'live' ? 'text-wc-red animate-pulse' : ''}>{realHomeScore}</span>
            <span className="text-slate-500 font-normal">vs</span>
            <span className={matchStatus === 'live' ? 'text-wc-red animate-pulse' : ''}>{realAwayScore}</span>
          </div>
        )}

        {/* Derecha: Puntos obtenidos */}
        <div className="text-xs shrink-0">
          {matchStatus === 'finished' && hasSavedPrediction ? (
            <span
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg font-bold border font-sports text-[11px] sm:text-xs tracking-wider uppercase ${
                pointsEarned === 3
                  ? 'bg-wc-gold/10 border-wc-gold/25 text-wc-gold'
                  : pointsEarned === 1
                  ? 'bg-wc-blue/10 border-wc-blue/25 text-wc-blue'
                  : 'bg-wc-dark border-wc-border text-slate-500'
              }`}
            >
              <Award className="w-3.5 h-3.5" strokeWidth={2.5} />
              <span>{pointsEarned ?? 0} pts</span>
            </span>
          ) : matchStatus === 'finished' && !hasSavedPrediction ? (
            <span className="text-slate-500 font-medium font-sports tracking-wide uppercase text-[10px] sm:text-xs">
              0 pts
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
};
