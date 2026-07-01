import React from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  title: string | ReactNode;
  subtitle?: string | ReactNode;
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | 'full';
  className?: string;
}

export function Modal({ 
  title, 
  subtitle, 
  isOpen, 
  onClose, 
  children, 
  footer, 
  maxWidth = 'md',
  className = ''
}: ModalProps) {
  if (!isOpen) return null;

  const maxWidthClasses = {
    'sm': 'max-w-sm',
    'md': 'max-w-md',
    'lg': 'max-w-lg',
    'xl': 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
    '6xl': 'max-w-6xl',
    'full': 'max-w-full m-4'
  };

  const selectedMaxWidth = maxWidthClasses[maxWidth] || maxWidthClasses.md;

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in overflow-y-auto">
      <div className={`bg-wc-card border border-wc-border w-full ${selectedMaxWidth} rounded-2xl overflow-hidden shadow-2xl relative flex flex-col max-h-[90vh] ${className}`}>
        
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-wc-border bg-wc-dark/60 flex justify-between items-start sticky top-0 z-10 shrink-0">
          <div>
            {typeof title === 'string' ? (
              <h3 className="font-bold text-white text-lg sm:text-xl font-sports tracking-wide uppercase">{title}</h3>
            ) : (
              title
            )}
            {subtitle && (
              typeof subtitle === 'string' ? (
                <p className="text-xs text-slate-400 mt-1 font-medium">{subtitle}</p>
              ) : (
                subtitle
              )
            )}
          </div>
          <button 
            onClick={onClose}
            className="p-2 bg-wc-dark hover:bg-wc-red/20 text-slate-400 hover:text-wc-red rounded-xl transition-colors border border-transparent hover:border-wc-red/30 shrink-0"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar flex-grow">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="p-4 sm:p-6 border-t border-wc-border bg-wc-dark/60 sticky bottom-0 z-10 shrink-0 flex items-center justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
