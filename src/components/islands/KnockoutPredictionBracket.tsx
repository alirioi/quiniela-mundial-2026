import React, { useState, useMemo, useEffect } from 'react';
import { Trophy, MapPin, HelpCircle, Save, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { getTeamFlagUrl } from '../../utils/flags';
import { calculateKnockoutBracket } from '../../utils/knockout';
import type { KnockoutMatch, TeamStats, KnockoutPrediction } from '../../utils/knockout';

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
  const [phaseActive, setPhaseActive] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

  // Fetch matches and predictions
  const fetchMatchesAndPredictions = async () => {
    if (!selectedEntryId || !phaseSlug) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const response = await fetch(`/api/matches/${phaseSlug}?entryId=${selectedEntryId}`);
      if (!response.ok) {
        throw new Error('No se pudieron cargar los datos de los partidos');
      }
      const data = await response.json();
      
      setPhaseActive(data.phase?.is_active || false);

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

      setPredictionsMap(initialPredictions);
      setMatchIdMap(initialMatchIdMap);
      setHasUnsavedChanges(false);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
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
          return {
            matchId,
            predictedHome: pred.predicted_home,
            predictedAway: pred.predicted_away,
            predictedWinner: pred.predicted_winner,
          };
        })
        .filter(p => p.matchId !== undefined && p.predictedHome !== null && p.predictedAway !== null);

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
    return calculateKnockoutBracket(groupStandings, thirdPlaces, predictionsMap);
  }, [groupStandings, thirdPlaces, predictionsMap]);

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

  const isPlaceholder = (teamName: string) => {
    return !teamName ||
           teamName.startsWith('1º') ||
           teamName.startsWith('2º') ||
           teamName.startsWith('3º') ||
           teamName.startsWith('Ganador') ||
           teamName.startsWith('Perdedor');
  };

  const formatMatchDateTime = (dateStr: string, venue: string) => {
    const isLateMatch = ['Los Ángeles', 'Seattle', 'Vancouver', 'San Francisco'].includes(venue);
    const timeFormatted = isLateMatch ? '08:00 PM' : '03:00 PM';
    return `${dateStr} • ${timeFormatted}`;
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
          <span>Match {match.matchNumber}</span>
          <span className="text-wc-gold font-bold">{formatMatchDateTime(match.dateStr, match.venue)}</span>
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

              {/* Penalty shootout winner selector indicator */}
              {isDraw && !isHomePH && (
                <button
                  disabled={!phaseActive}
                  onClick={() => handleWinnerSelect(match.matchNumber, match.homeTeam)}
                  className={`px-1 rounded text-[8px] font-extrabold uppercase transition-all shrink-0 cursor-pointer ${
                    isHomeSelectedWinner
                      ? 'bg-wc-gold text-slate-950 shadow-sm border border-transparent'
                      : 'bg-wc-dark border border-wc-border text-slate-500 hover:text-slate-300'
                  }`}
                  title="Avanza en penales"
                >
                  {isHomeSelectedWinner ? 'Ganador PK' : 'Avanza'}
                </button>
              )}
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

              {/* Penalty shootout winner selector indicator */}
              {isDraw && !isAwayPH && (
                <button
                  disabled={!phaseActive}
                  onClick={() => handleWinnerSelect(match.matchNumber, match.awayTeam)}
                  className={`px-1 rounded text-[8px] font-extrabold uppercase transition-all shrink-0 cursor-pointer ${
                    isAwaySelectedWinner
                      ? 'bg-wc-gold text-slate-950 shadow-sm border border-transparent'
                      : 'bg-wc-dark border border-wc-border text-slate-500 hover:text-slate-300'
                  }`}
                  title="Avanza en penales"
                >
                  {isAwaySelectedWinner ? 'Ganador PK' : 'Avanza'}
                </button>
              )}
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
        <div className="flex items-center gap-1 mt-2 pt-1.5 border-t border-wc-border text-[9px] text-slate-500">
          <MapPin className="w-3 h-3 text-slate-600" />
          <span className="truncate">{match.venue}</span>
        </div>
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
          {/* Navigation/Rounds Tabs on Mobile */}
          <div className="xl:hidden flex justify-center mb-6">
            <div className="inline-flex rounded-xl bg-wc-dark p-1 border border-wc-border/50 max-w-full overflow-x-auto custom-scrollbar">
              {roundsInfo.map((round) => (
                <button
                  key={round.id}
                  onClick={() => setActiveRound(round.id)}
                  className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer font-sports whitespace-nowrap ${
                    activeRound === round.id
                      ? 'bg-wc-card text-white shadow-md border border-wc-border/50'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span className="block sm:inline">{round.label}</span>
                  <span className="block sm:inline sm:ml-1 text-[9px] opacity-70">({round.count})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Mobile/Tablet Grid */}
          <div className="xl:hidden">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
              {activeRound === 'r32' && [...leftMatches.r32, ...rightMatches.r32].map(renderMatchCard)}
              {activeRound === 'r16' && [...leftMatches.r16, ...rightMatches.r16].map(renderMatchCard)}
              {activeRound === 'qf' && [...leftMatches.qf, ...rightMatches.qf].map(renderMatchCard)}
              {activeRound === 'sf' && [...leftMatches.sf, ...rightMatches.sf].map(renderMatchCard)}
              {activeRound === 'final' && [bracketData.finalMatch, { ...bracketData.finalMatch, matchNumber: 103, venue: 'Miami', dateStr: '18 JUL' }].map(renderMatchCard)}
            </div>
          </div>

          {/* Desktop Bracket */}
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
                    {renderMatchCard({
                      matchNumber: 103,
                      homeTeam: 'Perdedor M101',
                      awayTeam: 'Perdedor M102',
                      placeholderHome: 'Perdedor M101',
                      placeholderAway: 'Perdedor M102',
                      dateStr: '18 JUL',
                      venue: 'Miami'
                    })}
                  </div>
                </div>

                {/* Central connector right */}
                <HorizontalLine glow={checkGlow(rightMatches.sf[0], bracketData.finalMatch)} />

                {/* RIGHT HALF */}
                {renderRightTree()}
              </div>

            </div>
          </div>
        </>
      )}

      {/* Unsaved Changes & Success Panel */}
      {phaseActive && (hasUnsavedChanges || saving || saveSuccess || errorMsg) && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 w-[90%] max-w-lg animate-slide-up">
          <div className="bg-slate-900/95 border border-wc-border rounded-2xl p-4 shadow-2xl backdrop-blur-md flex flex-col gap-3">
            {errorMsg && (
              <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {saveSuccess && (
              <div className="text-xs text-wc-green bg-wc-green/10 border border-wc-green/20 px-3 py-2 rounded-xl flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>Pronósticos guardados exitosamente.</span>
              </div>
            )}

            <div className="flex items-center justify-between gap-4">
              <div className="text-xs text-slate-300">
                {hasUnsavedChanges ? (
                  <span className="font-medium text-amber-500">Tienes cambios sin guardar en tu llave</span>
                ) : (
                  <span className="text-slate-400">Todos los pronósticos guardados</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {hasUnsavedChanges && (
                  <button
                    disabled={saving}
                    onClick={fetchMatchesAndPredictions}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-300 bg-wc-dark border border-wc-border hover:bg-slate-800 transition cursor-pointer"
                  >
                    Descartar
                  </button>
                )}
                <button
                  disabled={!hasUnsavedChanges || saving}
                  onClick={handleSavePredictions}
                  className="px-4 py-2 rounded-xl text-xs font-sports font-black uppercase tracking-wider text-slate-950 bg-gradient-to-r from-wc-gold to-amber-500 hover:from-yellow-450 hover:to-amber-550 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-wc-gold/10 flex items-center gap-1.5 cursor-pointer"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Guardando</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Guardar Cambios</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
