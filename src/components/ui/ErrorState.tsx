import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({ message, onRetry, className = '' }: ErrorStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center p-12 bg-wc-red/10 border border-wc-red/20 rounded-2xl ${className}`}>
      <AlertTriangle className="w-10 h-10 text-wc-red mb-4" />
      <p className="text-wc-red font-sports tracking-wider uppercase mb-4 text-center">{message || 'Error de conexión'}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-6 py-2 bg-wc-red/20 hover:bg-wc-red/30 text-white rounded-lg font-sports uppercase tracking-wider text-xs border border-wc-red/30 transition-colors"
        >
          Reintentar
        </button>
      )}
    </div>
  );
}
