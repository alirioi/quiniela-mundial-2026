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
  isThirdPlaceTable = false 
}: StandingsRowProps) {
  
  // Lógica de colores según posición
  const getRowClass = () => {
    if (isThirdPlaceTable) {
      return index < 8 ? "bg-wc-green/10 border-l-2 border-wc-green" : "opacity-50";
    }
    
    // Si es tabla de grupos normal
    if (index === 0) return "bg-wc-green/10 border-l-2 border-wc-green"; // Primero (Pasa)
    if (index === 1) return "bg-wc-blue/10 border-l-2 border-wc-blue"; // Segundo (Pasa)
    if (index === 2) return "bg-wc-gold/10 border-l-2 border-wc-gold"; // Tercero (Espera)
    return "opacity-50 border-l-2 border-transparent"; // Cuarto (Eliminado)
  };

  return (
    <tr className={`border-b border-wc-border/30 hover:bg-white/5 transition-colors ${getRowClass()}`}>
      <td className="p-2 text-center text-xs font-mono font-bold text-slate-500 w-8">{index + 1}</td>
      <td className="p-2">
        <div className="flex items-center gap-2">
          <TeamFlag teamName={teamName} size="sm" />
          <span className="font-bold text-white text-[11px] sm:text-xs truncate max-w-[80px] sm:max-w-[120px]" title={teamName}>
            {teamName}
          </span>
        </div>
      </td>
      <td className="p-2 text-center text-xs font-mono">{pj}</td>
      <td className="p-2 text-center text-xs font-mono text-slate-400 hidden sm:table-cell">{g}</td>
      <td className="p-2 text-center text-xs font-mono text-slate-400 hidden sm:table-cell">{e}</td>
      <td className="p-2 text-center text-xs font-mono text-slate-400 hidden sm:table-cell">{p}</td>
      <td className="p-2 text-center text-xs font-mono text-slate-400 hidden md:table-cell">{gf}</td>
      <td className="p-2 text-center text-xs font-mono text-slate-400 hidden md:table-cell">{gc}</td>
      <td className={`p-2 text-center text-xs font-mono font-bold hidden sm:table-cell ${dg > 0 ? 'text-wc-green' : dg < 0 ? 'text-wc-red' : 'text-slate-400'}`}>
        {dg > 0 ? `+${dg}` : dg}
      </td>
      <td className="p-2 text-center text-sm font-mono font-extrabold text-wc-gold bg-wc-dark/30 rounded-r-lg">
        {pts}
      </td>
    </tr>
  );
}
