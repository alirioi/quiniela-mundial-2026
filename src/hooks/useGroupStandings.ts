import { useMemo } from 'react';
import { calculateGroupStandings, TeamStats } from '../utils/knockout';

export function useGroupStandings(matches: any[]) {
  const standings = useMemo(() => {
    if (!matches || matches.length === 0) return { groupStandings: {} as Record<string, TeamStats[]>, thirdPlaces: [] as TeamStats[] };
    return calculateGroupStandings(matches);
  }, [matches]);

  return standings;
}
