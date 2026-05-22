// Mapeo de selecciones del mundial 2026 a códigos de país ISO de 2 letras
const FLAG_MAP: Record<string, string> = {
  'méxico': 'mx',
  'sudáfrica': 'za',
  'corea del sur': 'kr',
  'chequia': 'cz',
  'canadá': 'ca',
  'bosnia y herzegovina': 'ba',
  'qatar': 'qa',
  'suiza': 'ch',
  'brasil': 'br',
  'marruecos': 'ma',
  'haití': 'ht',
  'escocia': 'gb-sct',
  'estados unidos': 'us',
  'paraguay': 'py',
  'australia': 'au',
  'turquía': 'tr',
  'alemania': 'de',
  'curazao': 'cw',
  'costa de marfil': 'ci',
  'ecuador': 'ec',
  'países bajos': 'nl',
  'japón': 'jp',
  'suecia': 'se',
  'túnez': 'tn',
  'bélgica': 'be',
  'egipto': 'eg',
  'irán': 'ir',
  'nueva zelanda': 'nz',
  'españa': 'es',
  'cabo verde': 'cv',
  'arabia saudita': 'sa',
  'uruguay': 'uy',
  'francia': 'fr',
  'senegal': 'sn',
  'irak': 'iq',
  'noruega': 'no',
  'argentina': 'ar',
  'argelia': 'dz',
  'austria': 'at',
  'jordania': 'jo',
  'portugal': 'pt',
  'rd congo': 'cd',
  'uzbekistán': 'uz',
  'colombia': 'co',
  'inglaterra': 'gb-eng',
  'croacia': 'hr',
  'ghana': 'gh',
  'panamá': 'pa'
};

/**
 * Obtiene la URL de la bandera en formato SVG de FlagCDN para un equipo dado
 * @param teamName Nombre del equipo en español
 * @returns La URL del SVG de la bandera, o null si no se encuentra
 */
export function getTeamFlagUrl(teamName: string | null | undefined): string | null {
  if (!teamName) return null;
  
  const key = teamName.trim().toLowerCase();
  const code = FLAG_MAP[key];
  
  if (!code) {
    // Si no está mapeado (por ejemplo es un placeholder como "Ganador Grupo A" o "1A"), no mostramos bandera
    return null;
  }
  
  return `https://flagcdn.com/${code}.svg`;
}
