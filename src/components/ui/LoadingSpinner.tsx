import React from 'react';
import { RefreshCw } from 'lucide-react';

interface LoadingSpinnerProps {
  message?: string;
  className?: string;
}

export function LoadingSpinner({ message = 'Cargando...', className = '' }: LoadingSpinnerProps) {
  return (
    <div className={`flex flex-col items-center justify-center p-12 bg-wc-card/25 rounded-2xl border border-wc-border space-y-4 ${className}`}>
      <RefreshCw className="w-9 h-9 animate-spin text-wc-gold" strokeWidth={2.5} />
      <p className="text-slate-450 text-xs font-sports tracking-wider uppercase">{message}</p>
    </div>
  );
}
