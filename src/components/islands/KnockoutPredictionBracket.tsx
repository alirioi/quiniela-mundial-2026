import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Trophy, CheckCircle2, AlertTriangle, HelpCircle, Loader2, Save, MapPin } from 'lucide-react';
import { getTeamFlagUrl } from '../../utils/flags';
import { calculateKnockoutBracket } from '../../utils/knockout';
import type { KnockoutMatch, TeamStats, KnockoutPrediction } from '../../utils/knockout';
import { PredictionMatchCard } from './PredictionMatchCard';

interface Props {
  groupStandings: Record<string, TeamStats[]>;
  thirdPlaces: TeamStats[];
  phaseSlug?: string;
  userEntries?: any[];
}

type RoundType = 'r32' | 'r16' | 'qf' | 'sf' | 'final';

interface ConnectorProps {
  type: 'left' | 'right';
  glow: boolean;
}

// SVG connector with non-scaling-stroke: the stroke stays at 2px
// even though preserveAspectRatio="none" stretches the coordinates.
// Path draws: two horizontal arms at 25%/75% height (card centers),
// a vertical bar connecting them, and an output arm at 50% (center).
const BracketConnector = ({ type, glow }: ConnectorProps) => {
  const pathD = type === 'left'
    ? 'M 0,25 H 50 V 75 H 0 M 50,50 H 100'
    : 'M 100,25 H 50 V 75 H 100 M 50,50 H 0';

  return (
    <div className="self-stretch w-8 shrink-0">
      <svg
        className="w-full h-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        fill="none"
      >
        <path
          d={pathD}
          className={`transition-colors duration-300 ${
            glow ? 'stroke-wc-gold' : 'stroke-slate-500 dark:stroke-slate-600'
          }`}
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
};

const HorizontalLine = ({ glow }: { glow: boolean }) => (
  <div className={`w-8 h-[2px] shrink-0 self-center transition-colors duration-300 ${
    glow ? 'bg-wc-gold' : 'bg-slate-500 dark:bg-slate-600'
  }`} />
);

export default function KnockoutPredictionBracket({ groupStandings, thirdPlaces, phaseSlug = 'eliminatoria', userEntries = [] }: Props) {
  const [selectedEntryId, setSelectedEntryId] = useState<number>(userEntries[0]?.id || 0);
  const [activeRound, setActiveRound] = useState<RoundType>('r32');
  const [hoveredTeam, setHoveredTeam] = useState<string | null>(null);

  // Predictions states
  const [predictionsMap, setPredictionsMap] = useState<Record<number, KnockoutPrediction>>({});
  const [matchIdMap, setMatchIdMap] = useState<Record<number, number>>({}); // match_number -> match_id
  const [dbMatches, setDbMatches] = useState<any[]>([]);
  const [phaseActive, setPhaseActive] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saving-pending' | 'saving' | 'saved' | 'error'>('idle');
  const autosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialMount = useRef(true);
  const prevEntryId = useRef<number | null>(null);

  // Visualization modes
  const [viewMode, setViewMode] = useState<'llave' | 'fase' | 'fechas' | 'cronologico'>('llave');
  const [cronologicoTab, setCronologicoTab] = useState<'todos' | 'por-jugar' | 'sin-pronostico'>('todos');
  const [activeDate, setActiveDate] = useState<string>('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const todayStrShort = useMemo(() => {
    return new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  }, []);

  const tomorrowStrShort = useMemo(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1280 && viewMode === 'llave') {
        setViewMode('fase');
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', handleResize);
      handleResize();
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', handleResize);
      }
    };
  }, [viewMode]);

  // Trigger autosave when changes occur
  const isLocked = (matchTimeStr: string | undefined | null) => {
    if (!matchTimeStr) return false;
    const matchTime = new Date(matchTimeStr).getTime();
    const lockTime = matchTime - 5 * 60 * 1000;
    return Date.now() >= lockTime;
  };

  const triggerAutosave = () => {
    if (!selectedEntryId) return;

    const formattedPredictions = Object.entries(predictionsMap)
      .map(([matchNumberStr, pred]) => {
        const matchNumber = parseInt(matchNumberStr, 10);
        const matchId = matchIdMap[matchNumber];
        const dbMatch = dbMatches.find(m => m.id === matchId);
        return {
          matchId,
          predictedHome: pred.predicted_home,
          predictedAway: pred.predicted_away,
          predictedWinner: pred.predicted_winner,
          isLocked: isLocked(dbMatch?.match_time)
        };
      })
      .filter(p => p.matchId !== undefined && p.predictedHome !== null && p.predictedAway !== null && !p.isLocked);

    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
      autosaveTimeoutRef.current = null;
    }

    if (formattedPredictions.length > 0) {
      setAutosaveStatus('saving-pending');
      autosaveTimeoutRef.current = setTimeout(async () => {
        setAutosaveStatus('saving');
        try {
          const response = await fetch('/api/predictions/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              entryId: selectedEntryId,
              predictions: formattedPredictions,
            }),
          });

          if (!response.ok) {
            throw new Error();
          }

          // Silent refresh of match data to update dbMatches and remove card pulse animation
          await fetchMatchesAndPredictions(true);
          setAutosaveStatus('saved');
          setHasUnsavedChanges(false);

          setTimeout(() => {
            setAutosaveStatus(current => current === 'saved' ? 'idle' : current);
          }, 3000);
        } catch (err) {
          console.error('Autosave error:', err);
          setAutosaveStatus('error');
        }
      }, 1500);
    } else {
      setAutosaveStatus(prev => prev === 'saving-pending' ? 'idle' : prev);
    }
  };

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      prevEntryId.current = selectedEntryId;
      return;
    }

    if (prevEntryId.current !== selectedEntryId) {
      prevEntryId.current = selectedEntryId;
      return;
    }

    if (hasUnsavedChanges) {
      triggerAutosave();
    }

    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }
    };
  }, [predictionsMap]);

  // Fetch matches and predictions
  const fetchMatchesAndPredictions = async (silent = false) => {
    if (!selectedEntryId || !phaseSlug) return;
    if (!silent) setLoading(true);
    setErrorMsg(null);
    try {
      const response = await fetch(`/api/matches/${phaseSlug}?entryId=${selectedEntryId}`);
      if (!response.ok) {
        throw new Error('No se pudieron cargar los datos de los partidos');
      }
      const data = await response.json();
      
      setPhaseActive(data.phase?.is_active || false);
      setDbMatches(data.matches || []);

      const initialPredictions: Record<number, KnockoutPrediction> = {};
      const initialMatchIdMap: Record<number, number> = {};

      if (data.matches) {
        data.matches.forEach((match: any) => {
          initialMatchIdMap[match.match_number] = match.id;
          if (match.prediction) {
            initialPredictions[match.match_number] = {
              predicted_home: match.prediction.predicted_home,
              predicted_away: match.prediction.predicted_away,
              predicted_winner: match.prediction.predicted_winner,
            };
          }
        });
      }

      if (!silent) {
        setPredictionsMap(initialPredictions);
      }
      setMatchIdMap(initialMatchIdMap);
      if (!silent) setHasUnsavedChanges(false);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatchesAndPredictions();
  }, [selectedEntryId, phaseSlug]);

  // Save predictions
  const handleSavePredictions = async () => {
    if (!selectedEntryId || saving) return;
    setSaving(true);
    setErrorMsg(null);
    setSaveSuccess(false);

    try {
      const formattedPredictions = Object.entries(predictionsMap)
        .map(([matchNumberStr, pred]) => {
          const matchNumber = parseInt(matchNumberStr, 10);
          const matchId = matchIdMap[matchNumber];
          const dbMatch = dbMatches.find(m => m.id === matchId);
          return {
            matchId,
            predictedHome: pred.predicted_home,
            predictedAway: pred.predicted_away,
            predictedWinner: pred.predicted_winner,
            isLocked: isLocked(dbMatch?.match_time)
          };
        })
        .filter(p => p.matchId !== undefined && p.predictedHome !== null && p.predictedAway !== null && !p.isLocked);

      if (formattedPredictions.length === 0) {
        throw new Error('No hay pronósticos válidos para guardar');
      }

      const response = await fetch('/api/predictions/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entryId: selectedEntryId,
          predictions: formattedPredictions,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Error al guardar los pronósticos');
      }

      setSaveSuccess(true);
      setHasUnsavedChanges(false);
      setTimeout(() => setSaveSuccess(false), 3000);
      await fetchMatchesAndPredictions();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Change input score handler
  const handleScoreChange = (matchNumber: number, side: 'home' | 'away', val: string) => {
    const cleanVal = val.replace(/[^0-9]/g, '');
    const numVal = cleanVal === '' ? null : parseInt(cleanVal, 10);

    setPredictionsMap((prev) => {
      const current = prev[matchNumber] || { predicted_home: null, predicted_away: null, predicted_winner: null };
      const updated = {
        ...current,
        predicted_home: side === 'home' ? numVal : current.predicted_home,
        predicted_away: side === 'away' ? numVal : current.predicted_away,
      };

      // Reset winner selection if scores are no longer tied or one is empty
      if (updated.predicted_home !== updated.predicted_away || updated.predicted_home === null || updated.predicted_away === null) {
        updated.predicted_winner = null;
      }
      return { ...prev, [matchNumber]: updated };
    });
    setHasUnsavedChanges(true);
  };

  // Select team to advance on draw handler
  const handleWinnerSelect = (matchNumber: number, teamName: string) => {
    if (!phaseActive) return;
    const pred = predictionsMap[matchNumber];
    if (!pred || pred.predicted_home !== pred.predicted_away || pred.predicted_home === null) return;

    setPredictionsMap((prev) => ({
      ...prev,
      [matchNumber]: {
        ...prev[matchNumber],
        predicted_winner: teamName,
      },
    }));
    setHasUnsavedChanges(true);
  };

  const bracketData = useMemo(() => {
    return calculateKnockoutBracket(groupStandings, thirdPlaces, predictionsMap, dbMatches);
  }, [groupStandings, thirdPlaces, predictionsMap, dbMatches]);

  const roundsInfo = [
    { id: 'r32' as RoundType, label: '16avos', count: 16 },
    { id: 'r16' as RoundType, label: 'Octavos', count: 8 },
    { id: 'qf' as RoundType, label: 'Cuartos', count: 4 },
    { id: 'sf' as RoundType, label: 'Semifinal', count: 2 },
    { id: 'final' as RoundType, label: 'Finales', count: 2 }
  ];

  const leftMatches = useMemo(() => ({
    r32: [74, 77, 73, 75, 83, 84, 81, 82].map(n => bracketData.r32[n]),
    r16: [89, 90, 93, 94].map(n => bracketData.r16[n]),
    qf: [97, 98].map(n => bracketData.qf[n]),
    sf: [bracketData.sf[101]]
  }), [bracketData]);

  const rightMatches = useMemo(() => ({
    r32: [76, 78, 79, 80, 86, 88, 85, 87].map(n => bracketData.r32[n]),
    r16: [91, 92, 95, 96].map(n => bracketData.r16[n]),
    qf: [99, 100].map(n => bracketData.qf[n]),
    sf: [bracketData.sf[102]]
  }), [bracketData]);

  const allCalculatedMatches = useMemo(() => {
    const list: KnockoutMatch[] = [];
    if (bracketData.r32) Object.values(bracketData.r32).forEach(m => list.push(m));
    if (bracketData.r16) Object.values(bracketData.r16).forEach(m => list.push(m));
    if (bracketData.qf) Object.values(bracketData.qf).forEach(m => list.push(m));
    if (bracketData.sf) Object.values(bracketData.sf).forEach(m => list.push(m));
    if (bracketData.thirdPlaceMatch) list.push(bracketData.thirdPlaceMatch);
    if (bracketData.finalMatch) list.push(bracketData.finalMatch);
    
    return list.sort((a, b) => {
      const dbA = dbMatches.find(m => m.match_number === a.matchNumber);
      const dbB = dbMatches.find(m => m.match_number === b.matchNumber);
      if (dbA && dbB) {
        return new Date(dbA.match_time).getTime() - new Date(dbB.match_time).getTime();
      }
      return a.matchNumber - b.matchNumber;
    });
  }, [bracketData, dbMatches]);

  const dateTabs = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const dateList: { key: string; label: string }[] = [];
    const seen = new Set<string>();

    const sorted = [...dbMatches].sort((a, b) => new Date(a.match_time).getTime() - new Date(b.match_time).getTime());

    sorted.forEach((m) => {
      if (!m.match_time) return;
      const matchDate = new Date(m.match_time);
      if (matchDate.getTime() < todayStart.getTime()) {
        return;
      }

      const dateKey = matchDate.toLocaleDateString('es-ES', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      });
      if (!seen.has(dateKey)) {
        seen.add(dateKey);
        let label = dateKey;
        label = label.charAt(0).toUpperCase() + label.slice(1);
        
        if (dateKey === todayStrShort) {
          label = `Hoy (${label})`;
        } else if (dateKey === tomorrowStrShort) {
          label = `Mañana (${label})`;
        }
        
        dateList.push({ key: dateKey, label });
      }
    });
    
    return dateList;
  }, [dbMatches, todayStrShort, tomorrowStrShort]);

  useEffect(() => {
    if (viewMode === 'fechas' && dateTabs.length > 0) {
      const hasToday = dateTabs.find(d => d.key === todayStrShort);
      if (hasToday) {
        setActiveDate(hasToday.key);
      } else {
        setActiveDate(dateTabs[0].key);
      }
    }
  }, [viewMode, dateTabs, todayStrShort]);

  const fechaMatches = useMemo(() => {
    return allCalculatedMatches.filter(m => {
      const dbMatch = dbMatches.find(dbM => dbM.match_number === m.matchNumber);
      if (!dbMatch || !dbMatch.match_time) return false;
      const dateKey = new Date(dbMatch.match_time).toLocaleDateString('es-ES', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      });
      return dateKey === activeDate;
    });
  }, [allCalculatedMatches, dbMatches, activeDate]);

  const sortChronologically = (matchesList: KnockoutMatch[]) => {
    return [...matchesList].sort((a, b) => {
      const dbA = dbMatches.find(m => m.id === matchIdMap[a.matchNumber]);
      const dbB = dbMatches.find(m => m.id === matchIdMap[b.matchNumber]);
      if (!dbA || !dbB) return 0;
      return new Date(dbA.match_time).getTime() - new Date(dbB.match_time).getTime();
    });
  };

  const cronologicoMatches = useMemo(() => {
    return sortChronologically(allCalculatedMatches);
  }, [allCalculatedMatches, dbMatches]);

  const porJugarMatches = useMemo(() => {
    const unplayed = allCalculatedMatches.filter(m => {
      const dbMatch = dbMatches.find(dbM => dbM.match_number === m.matchNumber);
      return dbMatch?.status === 'scheduled';
    });
    return sortChronologically(unplayed);
  }, [allCalculatedMatches, dbMatches]);

  const sinPronosticoMatches = useMemo(() => {
    const unpredicted = allCalculatedMatches.filter(m => {
      const dbMatch = dbMatches.find(dbM => dbM.match_number === m.matchNumber);
      if (!dbMatch || dbMatch.status !== 'scheduled') return false;
      const pred = predictionsMap[m.matchNumber];
      const hasScore = pred && pred.predicted_home !== null && pred.predicted_away !== null &&
                       pred.predicted_home !== undefined && pred.predicted_away !== undefined;
      return !hasScore;
    });
    return sortChronologically(unpredicted);
  }, [allCalculatedMatches, predictionsMap, dbMatches]);

  const getCountdownText = (matchTime: Date | null) => {
    if (!matchTime) return '';
    const now = new Date();
    const diffMs = matchTime.getTime() - now.getTime();
    
    if (diffMs <= 0) {
      return 'En juego / Finalizado';
    }
    
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHrs < 24) {
      const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      return `Faltan ${diffHrs}h ${diffMins}m`;
    }
    
    const diffDays = Math.floor(diffHrs / 24);
    const remainingHrs = diffHrs % 24;
    return `Faltan ${diffDays}d ${remainingHrs}h`;
  };

  const isPlaceholder = (teamName: string) => {
    return !teamName ||
           teamName.startsWith('1º') ||
           teamName.startsWith('2º') ||
           teamName.startsWith('3º') ||
           teamName.startsWith('Ganador') ||
           teamName.startsWith('Perdedor');
  };

  const formatMatchDateTime = (match: KnockoutMatch) => {
    const dbMatch = dbMatches.find(dbM => dbM.match_number === match.matchNumber);
    if (dbMatch && dbMatch.match_time) {
      const matchTime = new Date(dbMatch.match_time);
      const day = matchTime.getDate();
      const monthStr = matchTime.toLocaleDateString('es-ES', { month: 'short' }).toUpperCase().replace('.', '');
      const timeStr = matchTime.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit', hour12: true });
      return `${day} ${monthStr} • ${timeStr}`;
    }
    const isLateMatch = ['Los Ángeles', 'Seattle', 'Vancouver', 'San Francisco'].includes(match.venue);
    const timeFormatted = isLateMatch ? '08:00 PM' : '03:00 PM';
    return `${match.dateStr} • ${timeFormatted}`;
  };

  const checkGlow = (match1?: KnockoutMatch, match2?: KnockoutMatch, match3?: KnockoutMatch) => {
    if (!hoveredTeam) return false;
    const teams = [
      match1?.homeTeam, match1?.awayTeam,
      match2?.homeTeam, match2?.awayTeam,
      match3?.homeTeam, match3?.awayTeam
    ].filter(Boolean);
    return teams.includes(hoveredTeam);
  };

  const renderMatchCard = (match: KnockoutMatch) => {
    if (!match) return null;

    const isHomePH = isPlaceholder(match.homeTeam);
    const isAwayPH = isPlaceholder(match.awayTeam);
    const homeFlag = isHomePH ? null : getTeamFlagUrl(match.homeTeam);
    const awayFlag = isAwayPH ? null : getTeamFlagUrl(match.awayTeam);
    const isHoveredHome = hoveredTeam && hoveredTeam === match.homeTeam;
    const isHoveredAway = hoveredTeam && hoveredTeam === match.awayTeam;
    const highlighted = isHoveredHome || isHoveredAway;

    // Predictions values
    const pred = predictionsMap[match.matchNumber] || { predicted_home: null, predicted_away: null, predicted_winner: null };
    const isDraw = pred.predicted_home !== null && pred.predicted_away !== null && pred.predicted_home === pred.predicted_away;
    const isHomeSelectedWinner = pred.predicted_winner === match.homeTeam;
    const isAwaySelectedWinner = pred.predicted_winner === match.awayTeam;

    return (
      <div
        key={match.matchNumber}
        className={`bg-wc-card border transition-all duration-300 rounded-2xl p-3 flex flex-col relative overflow-hidden group shadow-lg ${
          highlighted
            ? 'border-wc-gold shadow-[0_0_15px_rgba(212,175,55,0.2)] scale-[1.02] z-20'
            : 'border-wc-border hover:border-wc-gold/30'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between text-[10px] font-sports uppercase tracking-wider text-slate-450 mb-2 border-b border-wc-border pb-1.5">
          {match.matchNumber === 104 ? (
            <>
              <span className="xl:hidden text-wc-gold font-black tracking-widest bg-wc-gold/15 px-1.5 py-0.5 rounded border border-wc-gold/25">Gran Final</span>
              <span className="hidden xl:inline text-slate-500 font-bold">Partido {match.matchNumber}</span>
            </>
          ) : match.matchNumber === 103 ? (
            <>
              <span className="xl:hidden text-wc-blue font-black tracking-widest bg-wc-blue/15 px-1.5 py-0.5 rounded border border-wc-blue/25">3er Puesto</span>
              <span className="hidden xl:inline text-slate-500 font-bold">Partido {match.matchNumber}</span>
            </>
          ) : (
            <span className="text-slate-500 font-bold">Partido {match.matchNumber}</span>
          )}
          <span className="text-wc-gold font-bold">{formatMatchDateTime(match)}</span>
        </div>

        {/* Teams */}
        <div className="space-y-2">
          {/* Home */}
          <div
            className={`flex items-center justify-between transition-all rounded-lg p-1 ${
              isHoveredHome ? 'bg-wc-gold/10 text-wc-gold shadow-sm' : 'text-slate-200'
            }`}
            onMouseEnter={() => !isHomePH && setHoveredTeam(match.homeTeam)}
            onMouseLeave={() => setHoveredTeam(null)}
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {homeFlag ? (
                <img src={homeFlag} alt={match.homeTeam} className="w-5 h-3.5 object-cover rounded shadow-sm flex-shrink-0 border border-slate-700/30" />
              ) : (
                <div className="w-5 h-3.5 bg-wc-dark/80 border border-wc-border rounded flex-shrink-0 flex items-center justify-center text-[9px] text-slate-450 font-bold font-sports select-none">?</div>
              )}
              <span className={`text-[11px] font-bold truncate ${isHomePH ? 'text-slate-500 font-medium italic' : ''}`} title={match.homeTeam || match.placeholderHome}>
                {match.homeTeam || match.placeholderHome}
              </span>

            </div>
            
            <input
              type="text"
              pattern="[0-9]*"
              inputMode="numeric"
              placeholder="-"
              disabled={!phaseActive || isHomePH || isAwayPH}
              value={pred.predicted_home ?? ''}
              onChange={(e) => handleScoreChange(match.matchNumber, 'home', e.target.value)}
              className={`w-7 h-7 rounded-lg bg-wc-dark/30 border border-wc-border text-center font-sports text-xs text-slate-200 font-bold flex-shrink-0 focus:border-wc-gold/50 focus:outline-none ${
                !phaseActive || isHomePH || isAwayPH ? 'cursor-not-allowed text-slate-550' : 'hover:border-slate-700'
              }`}
            />
          </div>

          {/* Away */}
          <div
            className={`flex items-center justify-between transition-all rounded-lg p-1 ${
              isHoveredAway ? 'bg-wc-gold/10 text-wc-gold shadow-sm' : 'text-slate-200'
            }`}
            onMouseEnter={() => !isAwayPH && setHoveredTeam(match.awayTeam)}
            onMouseLeave={() => setHoveredTeam(null)}
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {awayFlag ? (
                <img src={awayFlag} alt={match.awayTeam} className="w-5 h-3.5 object-cover rounded shadow-sm flex-shrink-0 border border-slate-700/30" />
              ) : (
                <div className="w-5 h-3.5 bg-wc-dark/80 border border-wc-border rounded flex-shrink-0 flex items-center justify-center text-[9px] text-slate-450 font-bold font-sports select-none">?</div>
              )}
              <span className={`text-[11px] font-bold truncate ${isAwayPH ? 'text-slate-500 font-medium italic' : ''}`} title={match.awayTeam || match.placeholderAway}>
                {match.awayTeam || match.placeholderAway}
              </span>

            </div>

            <input
              type="text"
              pattern="[0-9]*"
              inputMode="numeric"
              placeholder="-"
              disabled={!phaseActive || isHomePH || isAwayPH}
              value={pred.predicted_away ?? ''}
              onChange={(e) => handleScoreChange(match.matchNumber, 'away', e.target.value)}
              className={`w-7 h-7 rounded-lg bg-wc-dark/30 border border-wc-border text-center font-sports text-xs text-slate-200 font-bold flex-shrink-0 focus:border-wc-gold/50 focus:outline-none ${
                !phaseActive || isHomePH || isAwayPH ? 'cursor-not-allowed text-slate-550' : 'hover:border-slate-700'
              }`}
            />
          </div>
        </div>

        {/* Footer */}
        {(() => {
          const dbMatch = dbMatches.find(dbM => dbM.match_number === match.matchNumber);
          const matchTime = dbMatch ? new Date(dbMatch.match_time) : null;
          return (
            <div className="flex items-center justify-between gap-2 mt-2 pt-1.5 border-t border-wc-border text-slate-400">
              <div className="flex items-center gap-1 text-[10px] sm:text-xs min-w-0">
                <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span className="truncate font-semibold">{match.venue}</span>
              </div>
              {matchTime && (
                <span className="text-[8px] font-bold font-sports uppercase tracking-wider text-wc-gold/90 shrink-0 bg-wc-gold/10 px-1.5 py-0.5 rounded border border-wc-gold/15">
                  {getCountdownText(matchTime)}
                </span>
              )}
            </div>
          );
        })()}
      </div>
    );
  };

  // ─── Left bracket tree (R32 → R16 → QF → SF) ─────────────────────
  const renderLeftTree = () => {
    const sf = leftMatches.sf[0];
    const [qf1, qf2] = leftMatches.qf;
    const [r16_1, r16_2, r16_3, r16_4] = leftMatches.r16;
    const [r32_1, r32_2, r32_3, r32_4, r32_5, r32_6, r32_7, r32_8] = leftMatches.r32;

    return (
      <div className="flex items-center">
        <div className="flex flex-col gap-6">
          {/* QF 1 subtree */}
          <div className="flex items-center">
            <div className="flex flex-col gap-3">
              <div className="flex items-center">
                <div className="flex flex-col gap-1.5 w-48">{renderMatchCard(r32_1)}{renderMatchCard(r32_2)}</div>
                <BracketConnector type="left" glow={checkGlow(r32_1, r32_2, r16_1)} />
                <div className="w-48">{renderMatchCard(r16_1)}</div>
              </div>
              <div className="flex items-center">
                <div className="flex flex-col gap-1.5 w-48">{renderMatchCard(r32_3)}{renderMatchCard(r32_4)}</div>
                <BracketConnector type="left" glow={checkGlow(r32_3, r32_4, r16_2)} />
                <div className="w-48">{renderMatchCard(r16_2)}</div>
              </div>
            </div>
            <BracketConnector type="left" glow={checkGlow(r16_1, r16_2, qf1)} />
            <div className="w-48">{renderMatchCard(qf1)}</div>
          </div>

          {/* QF 2 subtree */}
          <div className="flex items-center">
            <div className="flex flex-col gap-3">
              <div className="flex items-center">
                <div className="flex flex-col gap-1.5 w-48">{renderMatchCard(r32_5)}{renderMatchCard(r32_6)}</div>
                <BracketConnector type="left" glow={checkGlow(r32_5, r32_6, r16_3)} />
                <div className="w-48">{renderMatchCard(r16_3)}</div>
              </div>
              <div className="flex items-center">
                <div className="flex flex-col gap-1.5 w-48">{renderMatchCard(r32_7)}{renderMatchCard(r32_8)}</div>
                <BracketConnector type="left" glow={checkGlow(r32_7, r32_8, r16_4)} />
                <div className="w-48">{renderMatchCard(r16_4)}</div>
              </div>
            </div>
            <BracketConnector type="left" glow={checkGlow(r16_3, r16_4, qf2)} />
            <div className="w-48">{renderMatchCard(qf2)}</div>
          </div>
        </div>
        <BracketConnector type="left" glow={checkGlow(qf1, qf2, sf)} />
        <div className="w-48">{renderMatchCard(sf)}</div>
      </div>
    );
  };

  // ─── Right bracket tree (SF ← QF ← R16 ← R32) ───────────────────
  const renderRightTree = () => {
    const sf = rightMatches.sf[0];
    const [qf1, qf2] = rightMatches.qf;
    const [r16_1, r16_2, r16_3, r16_4] = rightMatches.r16;
    const [r32_1, r32_2, r32_3, r32_4, r32_5, r32_6, r32_7, r32_8] = rightMatches.r32;

    return (
      <div className="flex flex-row-reverse items-center">
        <div className="flex flex-col gap-6">
          {/* QF 1 subtree */}
          <div className="flex flex-row-reverse items-center">
            <div className="flex flex-col gap-3">
              <div className="flex flex-row-reverse items-center">
                <div className="flex flex-col gap-1.5 w-48">{renderMatchCard(r32_1)}{renderMatchCard(r32_2)}</div>
                <BracketConnector type="right" glow={checkGlow(r32_1, r32_2, r16_1)} />
                <div className="w-48">{renderMatchCard(r16_1)}</div>
              </div>
              <div className="flex flex-row-reverse items-center">
                <div className="flex flex-col gap-1.5 w-48">{renderMatchCard(r32_3)}{renderMatchCard(r32_4)}</div>
                <BracketConnector type="right" glow={checkGlow(r32_3, r32_4, r16_2)} />
                <div className="w-48">{renderMatchCard(r16_2)}</div>
              </div>
            </div>
            <BracketConnector type="right" glow={checkGlow(r16_1, r16_2, qf1)} />
            <div className="w-48">{renderMatchCard(qf1)}</div>
          </div>

          {/* QF 2 subtree */}
          <div className="flex flex-row-reverse items-center">
            <div className="flex flex-col gap-3">
              <div className="flex flex-row-reverse items-center">
                <div className="flex flex-col gap-1.5 w-48">{renderMatchCard(r32_5)}{renderMatchCard(r32_6)}</div>
                <BracketConnector type="right" glow={checkGlow(r32_5, r32_6, r16_3)} />
                <div className="w-48">{renderMatchCard(r16_3)}</div>
              </div>
              <div className="flex flex-row-reverse items-center">
                <div className="flex flex-col gap-1.5 w-48">{renderMatchCard(r32_7)}{renderMatchCard(r32_8)}</div>
                <BracketConnector type="right" glow={checkGlow(r32_7, r32_8, r16_4)} />
                <div className="w-48">{renderMatchCard(r16_4)}</div>
              </div>
            </div>
            <BracketConnector type="right" glow={checkGlow(r16_3, r16_4, qf2)} />
            <div className="w-48">{renderMatchCard(qf2)}</div>
          </div>
        </div>
        <BracketConnector type="right" glow={checkGlow(qf1, qf2, sf)} />
        <div className="w-48">{renderMatchCard(sf)}</div>
      </div>
    );
  };

  const renderLargeMatchCard = (match: KnockoutMatch) => {
    if (!match) return null;
    const isHomePH = isPlaceholder(match.homeTeam);
    const isAwayPH = isPlaceholder(match.awayTeam);
    const homeFlag = isHomePH ? null : getTeamFlagUrl(match.homeTeam);
    const awayFlag = isAwayPH ? null : getTeamFlagUrl(match.awayTeam);

    const dbMatch = dbMatches.find((m) => m.id === matchIdMap[match.matchNumber]);
    const locked = isLocked(dbMatch?.match_time) || (dbMatch && dbMatch.status !== 'scheduled');

    const pred = predictionsMap[match.matchNumber] || { predicted_home: null, predicted_away: null, predicted_winner: null };

    const savedHome = dbMatch?.prediction ? String(dbMatch.prediction.predicted_home) : '';
    const savedAway = dbMatch?.prediction ? String(dbMatch.prediction.predicted_away) : '';
    const currentHomeStr = pred.predicted_home !== null ? String(pred.predicted_home) : '';
    const currentAwayStr = pred.predicted_away !== null ? String(pred.predicted_away) : '';

    const hasChanges = currentHomeStr !== savedHome || currentAwayStr !== savedAway;

    // Countdown text (same logic as group phase)
    const countdown = getCountdownText(dbMatch?.match_time ? new Date(dbMatch.match_time) : null);

    return (
      <PredictionMatchCard
        key={match.matchNumber}
        matchKey={match.matchNumber}
        headerLabel={match.matchNumber === 104 ? 'Gran Final' : match.matchNumber === 103 ? '3er Puesto' : `Partido ${match.matchNumber}`}
        matchStatus={dbMatch?.status as 'scheduled' | 'live' | 'finished' || 'scheduled'}
        countdown={countdown}
        locked={!!locked}
        homeTeam={match.homeTeam || match.placeholderHome || ''}
        awayTeam={match.awayTeam || match.placeholderAway || ''}
        homeFlag={homeFlag}
        awayFlag={awayFlag}
        isPlaceholder={isHomePH || isAwayPH || !phaseActive}
        currentHomeStr={currentHomeStr}
        currentAwayStr={currentAwayStr}
        onScoreChange={(side, val) => handleScoreChange(match.matchNumber, side, val)}
        hasChanges={hasChanges}
        hasSavedPrediction={!!dbMatch?.prediction}
        realHomeScore={dbMatch?.home_score}
        realAwayScore={dbMatch?.away_score}
        pointsEarned={(dbMatch?.prediction as any)?.points_earned}
      />
    );
  };


  return (
    <div className="space-y-6">
      {/* Entry Selector Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 bg-wc-card/90 rounded-2xl border border-wc-border backdrop-blur-sm">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-450 mb-2.5 font-sports">
            Selecciona tu Cupo
          </label>
          <div className="flex flex-wrap items-center gap-2">
            {userEntries.map((entry) => (
              <button
                key={entry.id}
                onClick={() => setSelectedEntryId(entry.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all duration-200 font-sports cursor-pointer ${
                  selectedEntryId === entry.id
                    ? 'bg-gradient-to-r from-wc-gold to-amber-500 text-slate-950 border-transparent shadow-md shadow-wc-gold/20'
                    : 'bg-wc-dark border-wc-border text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                {entry.display_name}
              </button>
            ))}
          </div>
        </div>

        {/* Disclaimer / Warning Banner */}
        {!phaseActive && !loading && (
          <span className="text-xs text-wc-gold font-bold bg-wc-gold/10 border border-wc-gold/20 px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 max-w-md">
            <AlertTriangle className="w-4 h-4 shrink-0 text-wc-gold" strokeWidth={2.5} />
            <span>Fase inactiva. Los pronósticos se abrirán inmediatamente al finalizar la fase de grupos.</span>
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="w-10 h-10 text-wc-gold animate-spin" />
          <p className="text-slate-400 text-sm font-medium">Cargando partidos de la fase eliminatoria...</p>
        </div>
      ) : (
        <>
          {/* Selector de modo de visualización */}
          <div className="flex items-center gap-3 border-l-2 border-wc-blue/45 pl-3 mb-6">
            <span className="text-[10px] uppercase font-sports tracking-wider text-slate-500 font-bold hidden xs:inline">
              Visualizar:
            </span>
            <div className="flex bg-wc-dark/95 border border-wc-border rounded-xl p-1 shadow-inner w-fit">
              <button
                type="button"
                onClick={() => setViewMode('llave')}
                className={`hidden xl:inline-flex px-4 py-1.5 rounded-lg text-xs font-bold font-sports uppercase tracking-wider transition-all cursor-pointer ${
                  viewMode === 'llave'
                    ? 'bg-wc-blue text-slate-900 shadow-md font-extrabold'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                Por Llave
              </button>
              <button
                type="button"
                onClick={() => setViewMode('fase')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold font-sports uppercase tracking-wider transition-all cursor-pointer ${
                  viewMode === 'fase'
                    ? 'bg-wc-blue text-slate-900 shadow-md font-extrabold'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                Por Fase
              </button>
              {dateTabs.length > 0 && (
                <button
                  type="button"
                  onClick={() => setViewMode('fechas')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold font-sports uppercase tracking-wider transition-all cursor-pointer ${
                    viewMode === 'fechas'
                      ? 'bg-wc-blue text-slate-900 shadow-md font-extrabold'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  Por Fecha
                </button>
              )}
              <button
                type="button"
                onClick={() => setViewMode('cronologico')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold font-sports uppercase tracking-wider transition-all cursor-pointer ${
                  viewMode === 'cronologico'
                    ? 'bg-wc-blue text-slate-900 shadow-md font-extrabold'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                Cronológico
              </button>
            </div>
          </div>

          {/* MODO LLAVE (Solo Desktop) */}
          {viewMode === 'llave' && (
            <div className="hidden xl:block overflow-x-auto py-8 custom-scrollbar">
              <div className="flex flex-col gap-6 min-w-max select-none px-8">
                {/* Phase Labels Header */}
                <div className="flex items-center gap-0 text-center font-sports text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-wc-border/30 pb-3">
                  <div className="w-48">Dieciseisavos</div>
                  <div className="w-8 shrink-0" />
                  <div className="w-48">Octavos</div>
                  <div className="w-8 shrink-0" />
                  <div className="w-48">Cuartos</div>
                  <div className="w-8 shrink-0" />
                  <div className="w-48">Semifinal</div>
                  <div className="w-8 shrink-0" />
                  <div className="w-56 shrink-0 text-wc-gold filter drop-shadow-[0_0_8px_rgba(212,175,55,0.2)]">Final / Campeón</div>
                  <div className="w-8 shrink-0" />
                  <div className="w-48">Semifinal</div>
                  <div className="w-8 shrink-0" />
                  <div className="w-48">Cuartos</div>
                  <div className="w-8 shrink-0" />
                  <div className="w-48">Octavos</div>
                  <div className="w-8 shrink-0" />
                  <div className="w-48">Dieciseisavos</div>
                </div>

                {/* Bracket Tree */}
                <div className="flex items-center gap-0">
                  {/* LEFT HALF */}
                  {renderLeftTree()}

                  {/* Central connector left */}
                  <HorizontalLine glow={checkGlow(leftMatches.sf[0], bracketData.finalMatch)} />

                  {/* CENTER */}
                  <div className="flex flex-col items-center justify-center gap-5 px-3 w-56 shrink-0">
                    <div className="flex flex-col items-center text-center p-5 bg-gradient-to-b from-wc-gold/10 to-transparent border border-wc-gold/20 rounded-3xl relative shadow-lg">
                      <Trophy className="w-12 h-12 text-wc-gold filter drop-shadow-[0_0_15px_rgba(212,175,55,0.3)] animate-pulse mb-2" strokeWidth={1.5} />
                      <span className="text-[9px] uppercase font-sports font-black tracking-widest text-wc-gold">Campeón del Mundo</span>
                      <span className="text-sm font-black text-slate-100 uppercase font-sports tracking-wide mt-1 block">Mundial 2026</span>
                    </div>

                    <div className="w-full">
                      <span className="text-[9px] font-sports text-slate-400 uppercase tracking-widest text-center block mb-2 font-black">Gran Final</span>
                      {renderMatchCard(bracketData.finalMatch)}
                    </div>

                    <div className="w-full">
                      <span className="text-[9px] font-sports text-slate-500 uppercase tracking-widest text-center block mb-2 font-bold">3er Puesto</span>
                      {renderMatchCard(bracketData.thirdPlaceMatch)}
                    </div>
                  </div>

                  {/* Central connector right */}
                  <HorizontalLine glow={checkGlow(rightMatches.sf[0], bracketData.finalMatch)} />

                  {/* RIGHT HALF */}
                  {renderRightTree()}
                </div>
              </div>
            </div>
          )}

          {/* MODO POR FASE */}
          {viewMode === 'fase' && (
            <div className="space-y-6">
              {/* Navigation/Rounds Tabs */}
              <div className="flex justify-center">
                <div className="inline-flex rounded-xl bg-wc-dark p-1 border border-wc-border/50 max-w-full overflow-x-auto custom-scrollbar gap-1.5">
                  {roundsInfo.map((round) => (
                    <button
                      key={round.id}
                      type="button"
                      onClick={() => setActiveRound(round.id)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer font-sports whitespace-nowrap border shrink-0 ${
                        activeRound === round.id
                          ? 'bg-gradient-to-r from-wc-gold to-amber-500 text-slate-950 border-transparent shadow-md shadow-wc-gold/20'
                          : 'bg-wc-dark border-wc-border text-slate-400 hover:text-slate-200 hover:border-slate-700'
                      }`}
                    >
                      <span className="block sm:inline">{round.label}</span>
                      <span className="block sm:inline sm:ml-1 text-[9px] opacity-70">({round.count})</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Grid de Partidos de la Fase (Cronológico) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in mt-4">
                {activeRound === 'r32' && sortChronologically([...leftMatches.r32, ...rightMatches.r32]).map(renderLargeMatchCard)}
                {activeRound === 'r16' && sortChronologically([...leftMatches.r16, ...rightMatches.r16]).map(renderLargeMatchCard)}
                {activeRound === 'qf' && sortChronologically([...leftMatches.qf, ...rightMatches.qf]).map(renderLargeMatchCard)}
                {activeRound === 'sf' && sortChronologically([...leftMatches.sf, ...rightMatches.sf]).map(renderLargeMatchCard)}
                {activeRound === 'final' && sortChronologically([bracketData.finalMatch, bracketData.thirdPlaceMatch].filter(Boolean)).map(renderLargeMatchCard)}
              </div>
            </div>
          )}

          {/* MODO POR FECHA */}
          {viewMode === 'fechas' && (
            <div className="space-y-6">
              {/* Horizontal sub-tabs for future dates starting from today */}
              {dateTabs.length > 0 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-3 border-b border-wc-border/30 custom-scrollbar animate-fade-in">
                  {dateTabs.map((dateObj) => (
                    <button
                      key={dateObj.key}
                      type="button"
                      onClick={() => setActiveDate(dateObj.key)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border whitespace-nowrap transition-all duration-200 font-sports cursor-pointer shrink-0 ${
                        activeDate === dateObj.key
                          ? 'bg-gradient-to-r from-wc-gold to-amber-500 text-slate-950 border-transparent shadow-md shadow-wc-gold/20'
                          : 'bg-wc-dark border-wc-border text-slate-400 hover:text-slate-200 hover:border-slate-700'
                      }`}
                    >
                      {dateObj.label}
                    </button>
                  ))}
                </div>
              )}

              {fechaMatches.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
                  {fechaMatches.map(renderLargeMatchCard)}
                </div>
              ) : (
                <div className="p-12 text-center bg-wc-card/30 rounded-2xl border border-wc-border/50 flex flex-col items-center justify-center gap-3 max-w-lg mx-auto">
                  <HelpCircle className="w-10 h-10 text-slate-500" strokeWidth={1.5} />
                  <p className="text-slate-400 font-medium text-sm">No hay partidos programados para esta fecha.</p>
                </div>
              )}
            </div>
          )}

          {/* MODO CRONOLOGICO */}
          {viewMode === 'cronologico' && (
            <div className="space-y-6">
              <div className="flex bg-wc-dark/95 border border-wc-border rounded-xl p-1 shadow-inner w-fit mb-6 gap-1">
                <button
                  type="button"
                  onClick={() => setCronologicoTab('todos')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold font-sports uppercase tracking-wider transition-all cursor-pointer ${
                    cronologicoTab === 'todos'
                      ? 'bg-wc-gold text-slate-950 shadow-md font-extrabold'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  Todos
                </button>
                <button
                  type="button"
                  onClick={() => setCronologicoTab('por-jugar')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold font-sports uppercase tracking-wider transition-all cursor-pointer ${
                    cronologicoTab === 'por-jugar'
                      ? 'bg-wc-gold text-slate-950 shadow-md font-extrabold'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  Por Jugar
                </button>
                <button
                  type="button"
                  onClick={() => setCronologicoTab('sin-pronostico')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold font-sports uppercase tracking-wider transition-all cursor-pointer ${
                    cronologicoTab === 'sin-pronostico'
                      ? 'bg-wc-gold text-slate-950 shadow-md font-extrabold'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  Sin Pronóstico
                </button>
              </div>

              {cronologicoTab === 'todos' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
                  {cronologicoMatches.map(renderLargeMatchCard)}
                </div>
              )}

              {cronologicoTab === 'por-jugar' && (
                porJugarMatches.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
                    {porJugarMatches.map(renderLargeMatchCard)}
                  </div>
                ) : (
                  <div className="p-12 text-center bg-wc-card/30 rounded-2xl border border-wc-border/50 flex flex-col items-center justify-center gap-3 max-w-lg mx-auto">
                    <CheckCircle2 className="w-10 h-10 text-wc-green" strokeWidth={1.5} />
                    <p className="text-slate-400 font-medium text-sm">No hay partidos pendientes por jugar en esta fase.</p>
                  </div>
                )
              )}

              {cronologicoTab === 'sin-pronostico' && (
                sinPronosticoMatches.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
                    {sinPronosticoMatches.map(renderLargeMatchCard)}
                  </div>
                ) : (
                  <div className="p-12 text-center bg-wc-card/30 rounded-2xl border border-wc-border/50 flex flex-col items-center justify-center gap-3 max-w-lg mx-auto">
                    <CheckCircle2 className="w-10 h-10 text-wc-green animate-bounce" strokeWidth={1.5} />
                    <p className="text-wc-green font-medium text-sm">¡Excelente! Has completado todos tus pronósticos pendientes.</p>
                  </div>
                )
              )}
            </div>
          )}
        </>
      )}

      {/* Botón flotante de guardar cambios */}
      {phaseActive && hasUnsavedChanges && (
        <button
          onClick={handleSavePredictions}
          disabled={saving}
          className="fixed bottom-6 right-6 z-50 flex items-center justify-center bg-gradient-to-r from-wc-gold to-amber-500 hover:from-amber-400 hover:to-wc-gold text-slate-950 font-bold font-sports shadow-xl shadow-wc-gold/30 rounded-full md:rounded-xl md:px-5 md:py-3 w-12 h-12 md:w-auto md:h-auto transition-all duration-300 transform hover:scale-105 active:scale-95 disabled:opacity-50 cursor-pointer animate-fade-in"
          title="Guardar Todo"
        >
          {saving ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <Save className="w-5 h-5 md:mr-2" strokeWidth={2.5} />
              <span className="hidden md:inline">Guardar Cambios</span>
            </>
          )}
        </button>
      )}

      {/* Toast de Autoguardado con Portal y centrado Flex robusto */}
      {mounted && autosaveStatus !== 'idle' && createPortal(
        <div className="fixed top-6 left-0 right-0 z-[9999] flex justify-center pointer-events-none px-4">
          <div className="pointer-events-auto w-auto max-w-[90vw] transition-all duration-300 animate-fade-in shrink-0">
            <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-2xl bg-wc-card/95 ${
              autosaveStatus === 'saved'
                ? 'border-wc-green/70 text-wc-green'
                : autosaveStatus === 'saving' || autosaveStatus === 'saving-pending'
                ? 'border-wc-gold/70 text-wc-gold'
                : 'border-wc-red/70 text-wc-red'
            }`}>
              {autosaveStatus === 'saved' ? (
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-wc-green shrink-0 animate-bounce" strokeWidth={2.5} />
                  <span className="text-xs sm:text-sm font-bold font-sports uppercase tracking-wider">Pronósticos guardados</span>
                </div>
              ) : autosaveStatus === 'saving' || autosaveStatus === 'saving-pending' ? (
                <div className="flex items-center gap-3 animate-pulse">
                  <Loader2 className="w-5 h-5 text-wc-gold shrink-0 animate-spin" strokeWidth={2.5} />
                  <span className="text-xs sm:text-sm font-bold font-sports uppercase tracking-wider">Guardando...</span>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-wc-red shrink-0" strokeWidth={2.5} />
                  <span className="text-xs sm:text-sm font-bold font-sports uppercase tracking-wider">Error al guardar</span>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
