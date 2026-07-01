import React from 'react';
import { CheckCircle, Clock, XCircle } from 'lucide-react';

export type EntryStatus = 'approved' | 'pending' | 'rejected';

interface StatusBadgeProps {
  status: EntryStatus;
  className?: string;
  showIcon?: boolean;
}

export function StatusBadge({ status, className = '', showIcon = true }: StatusBadgeProps) {
  const configs = {
    approved: {
      label: 'Aprobado',
      bgClass: 'bg-wc-green/10',
      textClass: 'text-wc-green',
      borderClass: 'border-wc-green/20',
      icon: CheckCircle
    },
    pending: {
      label: 'Pendiente',
      bgClass: 'bg-wc-gold/10',
      textClass: 'text-wc-gold',
      borderClass: 'border-wc-gold/20',
      icon: Clock
    },
    rejected: {
      label: 'Rechazado',
      bgClass: 'bg-wc-red/10',
      textClass: 'text-wc-red',
      borderClass: 'border-wc-red/20',
      icon: XCircle
    }
  };

  const config = configs[status] || configs.pending;
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 ${config.bgClass} ${config.textClass} border ${config.borderClass} rounded-lg text-[10px] sm:text-xs font-bold uppercase tracking-wider font-sports shadow-sm ${className}`}>
      {showIcon && <Icon className="w-3.5 h-3.5" strokeWidth={2.5} />}
      {config.label}
    </span>
  );
}
