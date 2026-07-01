import React from 'react';
import { getTeamFlagUrl } from '../../utils/flags';

interface TeamFlagProps {
  teamName: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function TeamFlag({ teamName, size = 'sm', className = '' }: TeamFlagProps) {
  const flagUrl = getTeamFlagUrl(teamName);
  
  // Mapeo de tamaños a clases de Tailwind (w- / h-)
  const sizeClasses = {
    'xs': 'w-3 h-2',
    'sm': 'w-5 h-3.5',
    'md': 'w-6 h-4 sm:w-7 sm:h-5',
    'lg': 'w-8 h-6 sm:w-10 sm:h-7',
    'xl': 'w-10 h-7 sm:w-12 sm:h-8'
  };

  const selectedSizeClass = sizeClasses[size] || sizeClasses.sm;

  if (flagUrl) {
    return (
      <img 
        src={flagUrl} 
        alt={teamName} 
        className={`${selectedSizeClass} object-cover rounded-[1px] shadow-sm ${className}`} 
      />
    );
  }

  // Fallback si no hay bandera (placeholder gris o equipo aún no definido)
  return (
    <div className={`${selectedSizeClass} bg-slate-800 rounded-[1px] flex-shrink-0 ${className}`}></div>
  );
}
