import React, { useState, useEffect } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';

interface Props {
  targetDateStr?: string; // Por ejemplo, '2026-06-27T21:00:00-04:00'
}

export default function PhaseCountdownBanner({ targetDateStr = '2026-06-27T21:00:00-04:00' }: Props) {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isExpired: false,
  });

  useEffect(() => {
    const targetTime = new Date(targetDateStr).getTime();

    const calculateTime = () => {
      const now = Date.now();
      const difference = targetTime - now;

      if (difference <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true });
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      setTimeLeft({ days, hours, minutes, seconds, isExpired: false });
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);

    return () => clearInterval(interval);
  }, [targetDateStr]);

  if (timeLeft.isExpired) {
    return (
      <div className="p-5 rounded-2xl bg-wc-green/10 border border-wc-green/30 text-wc-green shadow-lg backdrop-blur-sm relative overflow-hidden mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="absolute top-0 right-0 w-32 h-32 bg-wc-green/5 rounded-full blur-2xl pointer-events-none"></div>
        <div className="flex items-center gap-3.5 relative z-10">
          <Clock className="w-7 h-7 text-wc-green flex-shrink-0 animate-pulse" strokeWidth={2.5} />
          <div>
            <h4 className="font-bold uppercase font-sports tracking-wider text-sm sm:text-base text-wc-green">
              ¡La Fase Eliminatoria ha comenzado!
            </h4>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed mt-1">
              La Fase de Grupos ha finalizado. Los cruces eliminatorios están habilitados para registrar tus pronósticos. ¡No pierdas tiempo!
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 rounded-2xl bg-wc-card border border-wc-border/80 hover:border-wc-gold/30 transition-all duration-300 shadow-xl backdrop-blur-md relative overflow-hidden mb-8">
      {/* Glow effects */}
      <div className="absolute -top-12 -right-12 w-48 h-48 bg-wc-gold/5 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-wc-blue/5 rounded-full blur-3xl pointer-events-none"></div>

      <div className="flex flex-col lg:flex-row items-center justify-between gap-6 relative z-10">
        
        {/* Info & Disclaimer */}
        <div className="flex items-start gap-4 flex-1">
          <div className="p-3 bg-wc-gold/10 border border-wc-gold/25 rounded-2xl flex-shrink-0 mt-0.5 shadow-inner">
            <AlertTriangle className="w-6 h-6 text-wc-gold animate-bounce" strokeWidth={2.5} />
          </div>
          <div>
            <h4 className="font-bold uppercase font-sports tracking-widest text-xs sm:text-sm text-wc-gold flex items-center gap-1.5">
              Fase Eliminatoria (Segunda Fase)
            </h4>
            <p className="text-base sm:text-lg font-black text-slate-100 uppercase font-sports tracking-wide mt-1">
              Visualización y Previsualización Temporal
            </p>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed mt-2 max-w-2xl">
              <strong className="text-slate-200 font-bold">¡AVISO URGENTE!</strong> Esta fase se encuentra bloqueada temporalmente. El registro oficial de pronósticos se abrirá inmediatamente al finalizar el último partido de la Fase de Grupos. Tendrás un lapso muy corto de tiempo para ingresar tus marcadores antes del primer partido eliminatorio del día siguiente. <strong className="text-wc-gold font-bold">¡Mantente atento al cierre!</strong>
            </p>
          </div>
        </div>

        {/* Countdown Timer */}
        <div className="flex flex-col items-center justify-center bg-wc-dark/95 border border-wc-border/60 p-4 sm:p-5 px-6 sm:px-8 rounded-2xl shadow-inner min-w-[280px] sm:min-w-[320px] relative">
          <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 font-sports mb-2">Apertura en:</span>
          
          <div className="flex items-center gap-3">
            {/* Days */}
            <div className="flex flex-col items-center">
              <span className="font-sports font-black text-2xl sm:text-3xl text-slate-100 tracking-wider">
                {String(timeLeft.days).padStart(2, '0')}
              </span>
              <span className="text-[9px] uppercase font-bold text-slate-500 font-sports mt-0.5">Días</span>
            </div>
            <span className="text-lg font-bold text-slate-500 -mt-3.5">:</span>
            
            {/* Hours */}
            <div className="flex flex-col items-center">
              <span className="font-sports font-black text-2xl sm:text-3xl text-slate-100 tracking-wider">
                {String(timeLeft.hours).padStart(2, '0')}
              </span>
              <span className="text-[9px] uppercase font-bold text-slate-500 font-sports mt-0.5">Horas</span>
            </div>
            <span className="text-lg font-bold text-slate-500 -mt-3.5">:</span>
            
            {/* Minutes */}
            <div className="flex flex-col items-center">
              <span className="font-sports font-black text-2xl sm:text-3xl text-slate-100 tracking-wider">
                {String(timeLeft.minutes).padStart(2, '0')}
              </span>
              <span className="text-[9px] uppercase font-bold text-slate-500 font-sports mt-0.5">Mins</span>
            </div>
            <span className="text-lg font-bold text-slate-500 -mt-3.5">:</span>
            
            {/* Seconds */}
            <div className="flex flex-col items-center">
              <span className="font-sports font-black text-2xl sm:text-3xl text-wc-gold tracking-wider">
                {String(timeLeft.seconds).padStart(2, '0')}
              </span>
              <span className="text-[9px] uppercase font-bold text-slate-500 font-sports mt-0.5">Segs</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
