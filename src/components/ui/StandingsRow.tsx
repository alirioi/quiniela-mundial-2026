import React from 'react';
import { TeamFlag } from './TeamFlag';

export interface StandingsRowProps {
  teamName: string;
  index: number;
  pj: number;
  g: number;
  e: number;
  p: number;
  gf: number;
  gc: number;
  dg: number;
  pts: number;
  isThirdPlaceTable?: boolean;
  qualifiedThirds?: string[];
}

export function StandingsRow({ 
  teamName, 
  index, 
  pj, 
  g, 
  e, 
  p, 
  gf, 
  gc, 
  dg, 
  pts, 
  isThirdPlaceTable = false,
  qualifiedThirds = []
}: StandingsRowProps) {
  
  // Lógica de colores según posición
  const getRowClass = () => {
    if (isThirdPlaceTable) {
      return index < 8 ? "row-qualifier" : "row-eliminated opacity-70";
    }
    
    // Si es tabla de grupos normal
    if (index === 0 || index === 1) return "row-qualifier"; // Primero y Segundo (Pasa)
    if (index === 2) {
      // Si está en la lista de los 8 mejores terceros oficialmente clasificados, se pinta de verde
      if (qualifiedThirds.includes(teamName)) {
        return "row-qualifier";
      }
      return "row-possible-third"; // Tercero (Espera/Posible)
    }
    return "border-l-4 border-transparent opacity-60"; // Cuarto (Eliminado)
  };

  const paddingClass = isThirdPlaceTable ? "p-4" : "px-0.5 py-2 sm:px-1 sm:py-2.5";
  const teamCellPadding = isThirdPlaceTable ? "p-4 min-w-0" : "px-1 py-2 sm:px-1.5 sm:py-2.5 min-w-0";

  return (
    <tr className={`border-b border-wc-border/30 hover:bg-white/5 transition-colors ${getRowClass()}`}>
      <td className={`${paddingClass} text-center text-xs font-mono font-bold text-slate-500 w-8`}>{index + 1}</td>
      <td className={teamCellPadding}>
        <div className="flex items-center gap-2">
          <TeamFlag teamName={teamName} size="sm" />
          <span className="font-bold text-white text-[11px] sm:text-xs truncate max-w-[80px] sm:max-w-[120px]" title={teamName}>
            {teamName}
          </span>
        </div>
      </td>
      <td className={`${paddingClass} text-center text-xs font-mono`}>{pj}</td>
      <td className={`${paddingClass} text-center text-xs font-mono text-slate-400 hidden sm:table-cell`}>{g}</td>
      <td className={`${paddingClass} text-center text-xs font-mono text-slate-400 hidden sm:table-cell`}>{e}</td>
      <td className={`${paddingClass} text-center text-xs font-mono text-slate-400 hidden sm:table-cell`}>{p}</td>
      <td className={`${paddingClass} text-center text-xs font-mono text-slate-400 hidden md:table-cell`}>{gf}</td>
      <td className={`${paddingClass} text-center text-xs font-mono text-slate-400 hidden md:table-cell`}>{gc}</td>
      <td className={`${paddingClass} text-center text-xs font-mono font-bold hidden sm:table-cell ${dg > 0 ? 'text-wc-green' : dg < 0 ? 'text-wc-red' : 'text-slate-400'}`}>
        {dg > 0 ? `+${dg}` : dg}
      </td>
      <td className={`${paddingClass} text-center text-sm font-mono font-extrabold text-wc-gold bg-wc-dark/30 rounded-r-lg`}>
        {pts}
      </td>
    </tr>
  );
}
