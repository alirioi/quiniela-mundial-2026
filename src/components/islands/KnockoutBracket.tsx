import React, { useState, useMemo } from 'react';
import { Trophy, Calendar, MapPin, AlertCircle } from 'lucide-react';
import { getTeamFlagUrl } from '../../utils/flags';
import { calculateKnockoutBracket } from '../../utils/knockout';
import type { KnockoutMatch, TeamStats } from '../../utils/knockout';

interface Props {
  groupStandings: Record<string, TeamStats[]>;
  thirdPlaces: TeamStats[];
  isSimulation?: boolean;
}

type RoundType = 'r32' | 'r16' | 'qf' | 'sf' | 'final';

export default function KnockoutBracket({ groupStandings, thirdPlaces, isSimulation = false }: Props) {
  const [activeRound, setActiveRound] = useState<RoundType>('r32');
  const [hoveredTeam, setHoveredTeam] = useState<string | null>(null);

  const bracketData = useMemo(() => {
    return calculateKnockoutBracket(groupStandings, thirdPlaces);
  }, [groupStandings, thirdPlaces]);

  const roundsInfo = [
    { id: 'r32' as RoundType, label: 'Dieciseisavos', count: 16 },
    { id: 'r16' as RoundType, label: 'Octavos', count: 8 },
    { id: 'qf' as RoundType, label: 'Cuartos', count: 4 },
    { id: 'sf' as RoundType, label: 'Semifinal', count: 2 },
    { id: 'final' as RoundType, label: 'Final', count: 1 }
  ];

  const getRoundMatches = (round: RoundType): KnockoutMatch[] => {
    switch (round) {
      case 'r32':
        return Object.values(bracketData.r32);
      case 'r16':
        return Object.values(bracketData.r16);
      case 'qf':
        return Object.values(bracketData.qf);
      case 'sf':
        return Object.values(bracketData.sf);
      case 'final':
        return [bracketData.finalMatch];
      default:
        return [];
    }
  };

  const currentMatches = getRoundMatches(activeRound);

  const isPlaceholder = (teamName: string) => {
    return teamName.startsWith('1º') || 
           teamName.startsWith('2º') || 
           teamName.startsWith('3º') || 
           teamName.startsWith('Ganador');
  };

  const renderMatchCard = (match: KnockoutMatch) => {
    const isHomePlaceholder = isPlaceholder(match.homeTeam);
    const isAwayPlaceholder = isPlaceholder(match.awayTeam);

    const homeFlag = isHomePlaceholder ? null : getTeamFlagUrl(match.homeTeam);
    const awayFlag = isAwayPlaceholder ? null : getTeamFlagUrl(match.awayTeam);

    const isHoveredHome = hoveredTeam && hoveredTeam === match.homeTeam;
    const isHoveredAway = hoveredTeam && hoveredTeam === match.awayTeam;

    return (
      <div 
        key={match.matchNumber} 
        className="bg-wc-card border border-wc-border/80 hover:border-wc-gold/40 transition-all duration-300 rounded-2xl p-4 flex flex-col relative overflow-hidden group shadow-lg"
      >
        {/* Top Info */}
        <div className="flex items-center justify-between text-[11px] font-sports uppercase tracking-wider text-slate-500 mb-3 border-b border-wc-border/30 pb-2">
          <span>Match {match.matchNumber}</span>
          <span className="text-wc-gold font-bold">{match.dateStr}</span>
        </div>

        {/* Teams & Scores */}
        <div className="space-y-3.5">
          {/* Home Team */}
          <div 
            className={`flex items-center justify-between transition-all rounded-lg p-1.5 ${
              isHoveredHome ? 'bg-wc-gold/10 text-wc-gold shadow-sm' : 'text-slate-200'
            }`}
            onMouseEnter={() => !isHomePlaceholder && setHoveredTeam(match.homeTeam)}
            onMouseLeave={() => setHoveredTeam(null)}
          >
            <div className="flex items-center gap-2 min-w-0">
              {homeFlag ? (
                <img src={homeFlag} alt={match.homeTeam} className="w-6 h-4 object-cover rounded shadow-sm flex-shrink-0 border border-slate-700/30" />
              ) : (
                <div className="w-6 h-4 bg-wc-dark/80 border border-wc-border rounded flex-shrink-0 flex items-center justify-center text-[10px] text-slate-450 font-bold font-sports select-none">
                  ?
                </div>
              )}
              <span className={`text-xs font-bold truncate ${isHomePlaceholder ? 'text-slate-500 font-medium italic' : ''}`}>
                {match.homeTeam}
              </span>
            </div>
            {/* Score placeholder or real score */}
            {!isHomePlaceholder && match.homeScore !== undefined && match.homeScore !== null && (
              <span className="font-sports font-bold text-base px-2 bg-wc-dark rounded">{match.homeScore}</span>
            )}
          </div>

          {/* Away Team */}
          <div 
            className={`flex items-center justify-between transition-all rounded-lg p-1.5 ${
              isHoveredAway ? 'bg-wc-gold/10 text-wc-gold shadow-sm' : 'text-slate-200'
            }`}
            onMouseEnter={() => !isAwayPlaceholder && setHoveredTeam(match.awayTeam)}
            onMouseLeave={() => setHoveredTeam(null)}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {awayFlag ? (
                <img src={awayFlag} alt={match.awayTeam} className="w-6 h-4 object-cover rounded shadow-sm flex-shrink-0 border border-slate-700/30" />
              ) : (
                <div className="w-6 h-4 bg-wc-dark/80 border border-wc-border rounded flex-shrink-0 flex items-center justify-center text-[10px] text-slate-450 font-bold font-sports select-none">
                  ?
                </div>
              )}
              <span className={`text-xs font-bold truncate ${isAwayPlaceholder ? 'text-slate-500 font-medium italic' : ''}`}>
                {match.awayTeam}
              </span>
            </div>
            {/* Score placeholder or real score */}
            {!isAwayPlaceholder && match.awayScore !== undefined && match.awayScore !== null && (
              <span className="font-sports font-bold text-base px-2 bg-wc-dark rounded">{match.awayScore}</span>
            )}
          </div>
        </div>

        {/* Match Footer */}
        <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-wc-border/30 text-[10px] text-slate-400">
          <MapPin className="w-3.5 h-3.5 text-slate-500" />
          <span className="truncate">{match.venue}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Notice Banner */}
      <div className="info-banner p-4 rounded-2xl flex items-start gap-3 shadow-lg backdrop-blur-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-wc-blue/5 rounded-full blur-2xl pointer-events-none"></div>
        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div>
          <h4 className="font-bold uppercase font-sports tracking-wider text-xs sm:text-sm">
            {isSimulation ? 'Llave de Clasificación Simulada' : 'Llave de Clasificación Oficial (Provisional)'}
          </h4>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mt-1">
            {isSimulation 
              ? 'Esta llave muestra cómo quedarían los cruces de Dieciseisavos de final en base a tus pronósticos simulados.'
              : 'Esta sección muestra los cruces de la fase eliminatoria basados en los marcadores y posiciones reales hasta el momento.'
            }
            <span className="block mt-1 font-semibold text-wc-gold">Nota: Los cruces definitivos dependen de las combinaciones oficiales de terceros y se irán bloqueando conforme finalicen los partidos.</span>
          </p>
        </div>
      </div>

      {/* Tabs navigation for Mobile/Tablet */}
      <div className="flex items-center justify-between bg-wc-dark/60 p-1.5 rounded-2xl border border-wc-border">
        {roundsInfo.map(round => (
          <button
            key={round.id}
            onClick={() => setActiveRound(round.id)}
            className={`flex-1 py-3 px-1 sm:px-3 rounded-xl text-[10px] sm:text-xs md:text-sm font-bold font-sports uppercase tracking-wider transition-all duration-300 text-center ${
              activeRound === round.id 
                ? 'bg-wc-gold text-slate-950 shadow-md' 
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <span className="block sm:inline">{round.label}</span>
            <span className="block sm:inline sm:ml-1 text-[9px] opacity-70">({round.count})</span>
          </button>
        ))}
      </div>

      {/* Matches Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-fade-in">
        {currentMatches.map(renderMatchCard)}
      </div>

      {/* Bracket Tree Visual Aid on large screens */}
      <div className="hidden xl:block bg-wc-card/50 border border-wc-border/40 rounded-2xl p-6 text-center shadow-inner">
        <Trophy className="w-7 h-7 mx-auto mb-2 text-wc-gold opacity-80" />
        <p className="text-xs text-slate-400 font-sports uppercase tracking-wider">Mundial 2026 • Llave Camino a la Gloria</p>
      </div>
    </div>
  );
}
