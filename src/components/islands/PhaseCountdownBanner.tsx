import React from 'react';
import { AlertTriangle } from 'lucide-react';

export default function PhaseCountdownBanner() {
  return (
    <div className="p-6 rounded-2xl bg-wc-card border border-wc-gold/30 hover:border-wc-gold/50 transition-all duration-300 shadow-xl backdrop-blur-md relative overflow-hidden mb-8">
      {/* Glow effects */}
      <div className="absolute -top-12 -right-12 w-48 h-48 bg-wc-gold/5 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-wc-blue/5 rounded-full blur-3xl pointer-events-none"></div>

      <div className="flex flex-col lg:flex-row items-center justify-between gap-6 relative z-10">
        
        {/* Info & Disclaimer */}
        <div className="flex items-start gap-4 flex-1">
          <div className="p-3 bg-wc-gold/10 border border-wc-gold/25 rounded-2xl flex-shrink-0 mt-0.5 shadow-inner">
            <AlertTriangle className="w-6 h-6 text-wc-gold animate-pulse" strokeWidth={2.5} />
          </div>
          <div>
            <h4 className="font-bold uppercase font-sports tracking-widest text-xs sm:text-sm text-wc-gold flex items-center gap-1.5">
              Fase Eliminatoria (Segunda Fase)
            </h4>
            <p className="text-base sm:text-lg font-black text-slate-100 uppercase font-sports tracking-wide mt-1">
              Pronósticos Habilitados y Cruces Confirmados
            </p>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mt-2 max-w-3xl">
              ¡La fase de eliminación directa ha comenzado! Ya puedes llenar y guardar tus marcadores para los partidos de 16vos de final que ya se encuentran confirmados. El resto de emparejamientos se irán habilitando automáticamente a medida que finalicen los grupos restantes. <strong className="text-wc-gold font-bold">¡Asegura tus pronósticos antes del cierre de cada encuentro!</strong>
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
