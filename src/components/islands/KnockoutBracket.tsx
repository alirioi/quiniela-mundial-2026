import React, { useState, useMemo } from 'react';
import { Trophy, Calendar, MapPin, AlertCircle } from 'lucide-react';
import { getTeamFlagUrl } from '../../utils/flags';
import { calculateKnockoutBracket } from '../../utils/knockout';
import type { KnockoutMatch, TeamStats } from '../../utils/knockout';

interface Props {
  groupStandings: Record<string, TeamStats[]>;
  thirdPlaces: TeamStats[];
  isSimulation?: boolean;
  dbMatches?: any[];
}

type RoundType = 'r32' | 'r16' | 'qf' | 'sf' | 'final';

export default function KnockoutBracket({ groupStandings, thirdPlaces, isSimulation = false, dbMatches = [] }: Props) {
  const [activeRound, setActiveRound] = useState<RoundType>('r32');
  const [hoveredTeam, setHoveredTeam] = useState<string | null>(null);

  const bracketData = useMemo(() => {
    return calculateKnockoutBracket(groupStandings, thirdPlaces, undefined, dbMatches);
  }, [groupStandings, thirdPlaces, dbMatches]);

  const roundsInfo = [
    { id: 'r32' as RoundType, label: 'Dieciseisavos', count: 16 },
    { id: 'r16' as RoundType, label: 'Octavos', count: 8 },
    { id: 'qf' as RoundType, label: 'Cuartos', count: 4 },
    { id: 'sf' as RoundType, label: 'Semifinal', count: 2 },
    { id: 'final' as RoundType, label: 'Final / 3er Puesto', count: 2 }
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
        return [bracketData.finalMatch, bracketData.thirdPlaceMatch].filter(Boolean);
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

    const formatMatchDateTime = (m: KnockoutMatch) => {
      const dbMatch = dbMatches.find(dbM => dbM.match_number === m.matchNumber);
      if (dbMatch && dbMatch.match_time) {
        const matchTime = new Date(dbMatch.match_time);
        const day = matchTime.getDate();
        const monthStr = matchTime.toLocaleDateString('es-ES', { month: 'short' }).toUpperCase().replace('.', '');
        const timeStr = matchTime.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit', hour12: true });
        return `${day} ${monthStr} • ${timeStr}`;
      }
      return m.dateStr;
    };

    const isHoveredHome = hoveredTeam && hoveredTeam === match.homeTeam;
    const isHoveredAway = hoveredTeam && hoveredTeam === match.awayTeam;

    return (
      <div 
        key={match.matchNumber} 
        className="bg-wc-card border border-wc-border/80 hover:border-wc-gold/40 transition-all duration-300 rounded-2xl p-4 flex flex-col relative overflow-hidden group shadow-lg"
      >
        {/* Top Info */}
        <div className="flex items-center justify-between text-[11px] font-sports uppercase tracking-wider text-slate-500 mb-3 border-b border-wc-border/30 pb-2">
          {match.matchNumber === 104 ? (
            <span className="text-wc-gold font-black tracking-widest bg-wc-gold/15 px-1.5 py-0.5 rounded border border-wc-gold/25">Gran Final</span>
          ) : match.matchNumber === 103 ? (
            <span className="text-wc-blue font-black tracking-widest bg-wc-blue/15 px-1.5 py-0.5 rounded border border-wc-blue/25">3er Puesto</span>
          ) : (
            <span>Match {match.matchNumber}</span>
          )}
          <span className="text-wc-gold font-bold">{formatMatchDateTime(match)}</span>
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

  const renderListMatchCard = (match: KnockoutMatch) => {
    const isHomePlaceholder = isPlaceholder(match.homeTeam);
    const isAwayPlaceholder = isPlaceholder(match.awayTeam);

    const homeFlag = isHomePlaceholder ? null : getTeamFlagUrl(match.homeTeam);
    const awayFlag = isAwayPlaceholder ? null : getTeamFlagUrl(match.awayTeam);

    const dbMatch = dbMatches.find(dbM => dbM.match_number === match.matchNumber);
    
    let dateStr = match.dateStr;
    let timeStr = "";
    if (dbMatch && dbMatch.match_time) {
      const matchTime = new Date(dbMatch.match_time);
      dateStr = matchTime.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase();
      timeStr = matchTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }

    const roundLabel = match.matchNumber === 104 ? 'Gran Final' : match.matchNumber === 103 ? '3er Puesto' : `Partido ${match.matchNumber}`;
    const status = dbMatch?.status || 'scheduled';

    return (
      <div key={match.matchNumber} className="bg-wc-card border border-wc-border hover:border-wc-gold/40 transition-all rounded-xl p-4 flex flex-col justify-center">
        <div className="flex items-center justify-between mb-3 text-xs font-sports uppercase tracking-wider">
          <span className="text-slate-400 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" /> {dateStr} {timeStr ? `• ${timeStr}` : ''}
          </span>
          <span className="text-wc-gold font-bold">{roundLabel}</span>
        </div>
        
        <div className="flex items-center justify-between gap-2">
          {/* Home Team */}
          <div className="flex flex-col sm:flex-row items-center gap-1.5 sm:gap-3 flex-1 min-w-0">
            {homeFlag ? (
              <img src={homeFlag} alt={match.homeTeam} className="w-8 h-6 sm:w-10 sm:h-7 object-cover rounded shadow-md flex-shrink-0" />
            ) : (
              <div className="w-8 h-6 sm:w-10 sm:h-7 bg-slate-800 rounded flex-shrink-0"></div>
            )}
            <span className={`font-bold text-slate-200 text-xs sm:text-sm md:text-base truncate w-full text-center sm:text-left ${isHomePlaceholder ? 'text-slate-500 font-medium italic' : ''}`}>{match.homeTeam}</span>
          </div>
          
          {/* Score */}
          <div className="px-2 sm:px-4 flex flex-col items-center shrink-0">
            {status === 'finished' ? (
              <div className="bg-wc-dark border border-wc-border px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-lg flex gap-2 sm:gap-3 text-lg sm:text-xl font-sports font-bold text-white shadow-inner">
                <span>{dbMatch?.home_score ?? match.homeScore}</span>
                <span className="text-slate-500">-</span>
                <span>{dbMatch?.away_score ?? match.awayScore}</span>
              </div>
            ) : status === 'live' ? (
              <div className="bg-wc-red/10 border border-wc-red/30 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-lg flex gap-2 sm:gap-3 text-lg sm:text-xl font-sports font-bold text-wc-red shadow-md shadow-wc-red/10">
                <span>{dbMatch?.home_score ?? 0}</span>
                <span className="animate-pulse">-</span>
                <span>{dbMatch?.away_score ?? 0}</span>
              </div>
            ) : (
              <div className="bg-wc-dark border border-wc-border px-3 py-1 rounded-lg text-slate-500 font-sports font-bold tracking-widest text-base sm:text-lg">
                VS
              </div>
            )}
            
            {status === 'finished' && <span className="text-[9px] uppercase font-bold text-slate-500 mt-1">Final</span>}
            {status === 'live' && <span className="text-[9px] uppercase font-bold text-red-500 mt-1 animate-pulse">En Vivo</span>}
            {dbMatch?.penalty_winner && (
              <span className="text-[9px] uppercase font-bold text-wc-gold mt-1 text-center leading-tight">
                Penales:<br/>{dbMatch.penalty_winner}
              </span>
            )}
          </div>

          {/* Away Team */}
          <div className="flex flex-col sm:flex-row-reverse items-center gap-1.5 sm:gap-3 flex-1 min-w-0 justify-end">
            {awayFlag ? (
              <img src={awayFlag} alt={match.awayTeam} className="w-8 h-6 sm:w-10 sm:h-7 object-cover rounded shadow-md flex-shrink-0" />
            ) : (
              <div className="w-8 h-6 sm:w-10 sm:h-7 bg-slate-800 rounded flex-shrink-0"></div>
            )}
            <span className={`font-bold text-slate-200 text-xs sm:text-sm md:text-base text-center sm:text-right truncate w-full ${isAwayPlaceholder ? 'text-slate-500 font-medium italic' : ''}`}>{match.awayTeam}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Tabs navigation for Mobile/Tablet (Horizontally scrollable) */}
      <div className="flex items-center gap-1.5 bg-wc-dark/60 p-1.5 rounded-2xl border border-wc-border overflow-x-auto custom-scrollbar">
        {roundsInfo.map(round => (
          <button
            key={round.id}
            onClick={() => setActiveRound(round.id)}
            className={`shrink-0 px-4 py-3 rounded-xl text-[10px] sm:text-xs md:text-sm font-bold font-sports uppercase tracking-wider transition-all duration-300 text-center cursor-pointer ${
              activeRound === round.id 
                ? 'bg-wc-gold text-slate-950 shadow-md font-extrabold' 
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <span className="block sm:inline">{round.label}</span>
            <span className="block sm:inline sm:ml-1 text-[9px] opacity-70">({round.count})</span>
          </button>
        ))}
      </div>

      {/* Matches Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-fade-in">
        {currentMatches.map(renderListMatchCard)}
      </div>

      {/* Bracket Tree Visual Aid on large screens */}
      <div className="hidden xl:block bg-wc-card/50 border border-wc-border/40 rounded-2xl p-6 text-center shadow-inner">
        <Trophy className="w-7 h-7 mx-auto mb-2 text-wc-gold opacity-80" />
        <p className="text-xs text-slate-400 font-sports uppercase tracking-wider">Mundial 2026 • Llave Camino a la Gloria</p>
      </div>
    </div>
  );
}
