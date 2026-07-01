export function getFlagUrl(countryName: string | null | undefined): string {
  if (!countryName) return '/flags/unknown.png';

  const normalized = countryName
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/\s+/g, '-');

  // Nombres de equipos especiales que tal vez no tengan bandera directa
  if (normalized.startsWith('1o') || 
      normalized.startsWith('2o') || 
      normalized.startsWith('3o') || 
      normalized.startsWith('ganador') || 
      normalized.startsWith('perdedor')) {
    return '/flags/unknown.png';
  }

  return `/flags/${normalized}.png`;
}

export function formatMatchTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function isMatchLockedClient(matchTime: string): boolean {
  const matchTimeMs = new Date(matchTime).getTime();
  const nowMs = Date.now();
  const lockTimeMs = matchTimeMs - 5 * 60 * 1000;
  return nowMs >= lockTimeMs;
}
