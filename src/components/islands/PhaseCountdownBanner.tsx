import React from 'react';
import { AlertTriangle } from 'lucide-react';

export default function PhaseCountdownBanner() {
  return (
    <div className="p-4 rounded-xl bg-wc-card/50 border border-wc-gold/20 hover:border-wc-gold/45 transition-all duration-300 shadow-lg backdrop-blur-md relative overflow-hidden mb-6">
      {/* Glow effects */}
      <div className="absolute -top-12 -right-12 w-48 h-48 bg-wc-gold/5 rounded-full blur-3xl pointer-events-none"></div>

      <div className="flex items-center gap-3 relative z-10 text-xs sm:text-sm">
        <div className="p-1.5 bg-wc-gold/10 border border-wc-gold/20 rounded-lg flex-shrink-0">
          <AlertTriangle className="w-4.5 h-4.5 text-wc-gold" strokeWidth={2.5} />
        </div>
        <div className="flex-grow text-slate-200 font-medium">
          <span className="font-extrabold text-wc-gold font-sports uppercase tracking-wider mr-2">Fase Eliminatoria:</span>
          Ya puedes guardar tus marcadores confirmados. Recuerda hacerlo al menos <strong className="text-wc-gold font-bold">5 minutos antes</strong> del inicio de cada partido.
        </div>
      </div>
    </div>
  );
}
