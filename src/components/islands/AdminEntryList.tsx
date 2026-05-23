import React, { useState, useEffect } from 'react';
import { showAlert } from '../../utils/alerts';
import {
  Clock,
  CheckCircle2,
  XCircle,
  Folder,
  RefreshCw,
  AlertTriangle,
  Inbox,
  Eye,
  Check,
  X,
  ExternalLink
} from 'lucide-react';

interface Entry {
  id: number;
  user_id: string;
  entry_number: number;
  display_name: string;
  payment_method: string;
  payment_reference: string | null;
  status: 'pending' | 'approved' | 'rejected';
  payment_receipt_url: string | null;
  signedUrl: string | null;
  total_points: number;
  created_at: string;
  profiles: {
    full_name: string;
    email: string;
  } | null;
}

export default function AdminEntryList() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [selectedReceipt, setSelectedReceipt] = useState<{ url: string; name: string } | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  const fetchEntries = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/entries');
      if (!response.ok) {
        throw new Error('Error al obtener la lista de cupos');
      }
      const data = await response.json();
      setEntries(data);
    } catch (err: any) {
      setError(err.message || 'Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
  }, []);

  const handleUpdateStatus = async (id: number, status: 'approved' | 'rejected', reason?: string) => {
    setActionLoadingId(id);
    try {
      const response = await fetch(`/api/admin/entries/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, rejectionReason: reason || '' }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al actualizar el estado del cupo');
      }

      // Actualizar localmente el estado del cupo
      setEntries((prev) =>
        prev.map((entry) =>
          entry.id === id ? { ...entry, status } : entry
        )
      );

      // Limpiar estados de rechazo
      setRejectingId(null);
      setRejectionReason('');
    } catch (err: any) {
      showAlert.error('Error', err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const filteredEntries = entries.filter((entry) => {
    if (filter === 'all') return true;
    return entry.status === filter;
  });

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-wc-card/50 rounded-2xl border border-wc-border backdrop-blur-md relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-wc-gold/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex flex-wrap items-center gap-2 relative z-10">
          {(['pending', 'approved', 'rejected', 'all'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 border font-sports ${
                filter === status
                  ? status === 'pending'
                    ? 'bg-wc-gold/10 border-wc-gold/30 text-wc-gold shadow-md shadow-wc-gold/5'
                    : status === 'approved'
                    ? 'bg-wc-green/10 border-wc-green/30 text-wc-green shadow-md shadow-wc-green/5'
                    : status === 'rejected'
                    ? 'bg-wc-red/10 border-wc-red/30 text-wc-red shadow-md shadow-wc-red/5'
                    : 'bg-slate-800 border-slate-750 text-slate-200'
                  : 'bg-wc-dark/40 border-wc-border hover:border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              {status === 'pending' && (
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" strokeWidth={2.5} /> Pendientes
                </span>
              )}
              {status === 'approved' && (
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" strokeWidth={2.5} /> Aprobados
                </span>
              )}
              {status === 'rejected' && (
                <span className="flex items-center gap-1.5">
                  <XCircle className="w-4 h-4" strokeWidth={2.5} /> Rechazados
                </span>
              )}
              {status === 'all' && (
                <span className="flex items-center gap-1.5">
                  <Folder className="w-4 h-4" strokeWidth={2.5} /> Todos
                </span>
              )}
            </button>
          ))}
        </div>

        <button
          onClick={fetchEntries}
          className="p-2 px-3.5 rounded-xl bg-wc-dark hover:bg-wc-card text-slate-300 hover:text-white border border-wc-border transition-all duration-200 text-xs font-bold font-sports tracking-wider uppercase flex items-center gap-1.5 relative z-10"
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} strokeWidth={2.5} /> Recargar
        </button>
      </div>

      {/* Lista de Cupos */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 space-y-4 bg-wc-card/40 rounded-2xl border border-wc-border">
          <RefreshCw className="w-9 h-9 text-wc-gold animate-spin" strokeWidth={2.5} />
          <p className="text-slate-400 text-xs font-sports tracking-wider uppercase">Cargando cupos...</p>
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl bg-wc-red/10 border border-wc-red/20 text-center space-y-3">
          <AlertTriangle className="w-9 h-9 text-wc-red mx-auto" strokeWidth={2.5} />
          <p className="text-wc-red font-bold text-xs uppercase font-sports tracking-wider">{error}</p>
          <button
            onClick={fetchEntries}
            className="px-4 py-2 rounded-xl bg-wc-red/20 hover:bg-wc-red/35 text-white text-xs font-bold font-sports tracking-wider uppercase border border-wc-red/30 transition-colors"
          >
            Reintentar
          </button>
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="p-12 text-center bg-wc-card/40 rounded-2xl border border-wc-border text-slate-500 text-sm flex flex-col items-center justify-center space-y-2">
          <Inbox className="w-9 h-9 text-slate-400 mb-1" strokeWidth={2.5} />
          <span className="text-slate-450 font-sports text-xs uppercase tracking-wider">No hay cupos en esta categoría.</span>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-wc-border bg-wc-card/30 backdrop-blur-md">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-wc-border text-xs uppercase font-bold tracking-wider text-slate-350 bg-wc-dark/50 font-sports">
                <th className="p-4 sm:p-5">Usuario / Apodo</th>
                <th className="p-4 sm:p-5">Pago y Ref.</th>
                <th className="p-4 sm:p-5">Cupo #</th>
                <th className="p-4 sm:p-5">Fecha Reg.</th>
                <th className="p-4 sm:p-5 text-center">Comprobante</th>
                <th className="p-4 sm:p-5">Estado</th>
                <th className="p-4 sm:p-5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-wc-border text-sm">
              {filteredEntries.map((entry) => {
                const profileName = entry.profiles?.full_name || 'Desconocido';
                const profileEmail = entry.profiles?.email || 'N/A';
                
                return (
                  <tr key={entry.id} className="hover:bg-wc-card/85 transition-colors">
                    <td className="p-4 sm:p-5">
                      <div className="font-bold text-white text-sm">{entry.display_name}</div>
                      <div className="text-xs text-slate-455 mt-0.5">{profileName} • {profileEmail}</div>
                    </td>
                    <td className="p-4 sm:p-5 text-slate-300 text-xs font-mono font-medium max-w-[180px]">
                      <div className="flex flex-col gap-0.5">
                        <span className="uppercase text-[10px] text-slate-400 font-bold tracking-wider">
                          {entry.payment_method === 'binance_pay' ? 'Binance Pay' : entry.payment_method === 'pago_movil' ? 'Pago Móvil' : entry.payment_method === 'transferencia_bs' ? 'Transferencia Bs' : entry.payment_method}
                        </span>
                        <span className="truncate" title={entry.payment_reference || 'N/A'}>
                          {entry.payment_reference || <span className="text-slate-550 italic font-sans">N/A</span>}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 sm:p-5 font-mono text-xs text-wc-gold font-bold">
                      #{entry.entry_number}
                    </td>
                    <td className="p-4 sm:p-5 text-slate-400 text-xs font-medium">
                      {new Date(entry.created_at).toLocaleDateString('es-ES', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="p-4 sm:p-5 text-center">
                      {entry.signedUrl ? (
                        <button
                          onClick={() => setSelectedReceipt({ url: entry.signedUrl!, name: entry.display_name })}
                          className="px-3 py-1.5 rounded-lg bg-wc-dark hover:bg-wc-card text-slate-300 hover:text-white border border-wc-border transition-colors text-xs font-bold font-sports tracking-wider uppercase inline-flex items-center gap-1.5"
                        >
                          <Eye className="w-4 h-4 text-slate-300" strokeWidth={2.5} /> Ver Archivo
                        </button>
                      ) : (
                        <span className="text-slate-550 text-xs font-sports uppercase tracking-wider">Sin comprobante</span>
                      )}
                    </td>
                    <td className="p-4 sm:p-5">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border font-sports tracking-wider uppercase ${
                        entry.status === 'approved'
                          ? 'bg-wc-green/10 border-wc-green/20 text-wc-green'
                          : entry.status === 'rejected'
                          ? 'bg-wc-red/10 border-wc-red/20 text-wc-red'
                          : 'bg-wc-gold/10 border-wc-gold/20 text-wc-gold'
                      }`}>
                        {entry.status === 'approved' && 'Aprobado'}
                        {entry.status === 'rejected' && 'Rechazado'}
                        {entry.status === 'pending' && 'Pendiente'}
                      </span>
                    </td>
                    <td className="p-4 sm:p-5 text-right">
                      {actionLoadingId === entry.id ? (
                        <span className="text-xs text-slate-400 font-sports uppercase tracking-wider animate-pulse">Guardando...</span>
                      ) : (
                        <div className="flex justify-end items-center gap-2">
                          {entry.status !== 'approved' && (
                            <button
                              onClick={() => handleUpdateStatus(entry.id, 'approved')}
                              className="px-2.5 py-1.5 rounded-lg bg-wc-green hover:bg-green-500 text-white font-bold font-sports tracking-wider uppercase text-xs transition-colors flex items-center gap-1"
                              title="Aprobar Pago"
                            >
                              <Check className="w-4 h-4" strokeWidth={2.5} /> Aprobar
                            </button>
                          )}
                          {entry.status !== 'rejected' && (
                            <button
                              onClick={() => setRejectingId(entry.id)}
                              className="px-2.5 py-1.5 rounded-lg bg-wc-dark hover:bg-wc-red/10 text-slate-450 hover:text-wc-red border border-wc-border hover:border-wc-red/30 transition-all duration-200 text-xs font-bold font-sports tracking-wider uppercase flex items-center gap-1"
                              title="Rechazar Pago"
                            >
                              <X className="w-4 h-4" strokeWidth={2.5} /> Rechazar
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal para ver comprobante */}
      {selectedReceipt && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-wc-card border border-wc-border w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl relative flex flex-col max-h-[85vh]">
            <div className="p-5 border-b border-wc-border flex justify-between items-center bg-wc-dark/40">
              <h3 className="font-bold text-white text-lg font-sports tracking-wide uppercase">Comprobante - {selectedReceipt.name}</h3>
              <button
                onClick={() => setSelectedReceipt(null)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4.5 h-4.5" strokeWidth={2.5} />
              </button>
            </div>
            
            <div className="flex-grow p-6 overflow-y-auto flex items-center justify-center bg-wc-dark/20 min-h-[300px]">
              {selectedReceipt.url.includes('.pdf') || selectedReceipt.url.includes('application/pdf') ? (
                <iframe
                  src={selectedReceipt.url}
                  className="w-full h-[50vh] rounded-lg border border-wc-border"
                  title="PDF Comprobante"
                ></iframe>
              ) : (
                <img
                  src={selectedReceipt.url}
                  alt="Comprobante de Pago"
                  className="max-w-full max-h-[50vh] rounded-lg object-contain border border-wc-border shadow-lg"
                />
              )}
            </div>

            <div className="p-4 border-t border-wc-border bg-wc-dark/60 flex justify-between items-center">
              <a
                href={selectedReceipt.url}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 bg-wc-dark hover:bg-wc-card text-slate-300 hover:text-white rounded-xl text-xs font-bold font-sports tracking-wider uppercase border border-wc-border transition-colors flex items-center gap-1.5"
              >
                <ExternalLink className="w-4 h-4 text-slate-300" strokeWidth={2.5} /> Abrir en nueva pestaña
              </a>
              <button
                onClick={() => setSelectedReceipt(null)}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-wc-gold to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-slate-955 shadow-md shadow-wc-gold/15 transition-colors font-sports tracking-wider uppercase"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para motivo de rechazo */}
      {rejectingId !== null && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-wc-card border border-wc-border w-full max-w-md rounded-2xl overflow-hidden shadow-2xl p-6 space-y-4 relative">
            <h3 className="font-bold text-white text-lg font-sports tracking-wide uppercase">Rechazar Comprobante</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-medium">
              Indica el motivo por el cual rechazas este comprobante. Se enviará un correo electrónico al usuario con esta explicación.
            </p>
            
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Ej: La captura de pantalla no es legible o el monto transferido es incorrecto."
              className="w-full h-24 p-3 rounded-xl bg-wc-dark border border-wc-border text-slate-200 placeholder-slate-600 text-xs focus:outline-none focus:ring-2 focus:ring-wc-red/50 focus:border-wc-red transition-all font-medium"
              required
            ></textarea>

            <div className="flex justify-end items-center gap-3 pt-2">
              <button
                onClick={() => {
                  setRejectingId(null);
                  setRejectionReason('');
                }}
                className="px-4 py-2 bg-wc-dark hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-wc-border rounded-xl text-xs font-bold font-sports tracking-wider uppercase transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleUpdateStatus(rejectingId, 'rejected', rejectionReason)}
                className="px-5 py-2 bg-wc-red hover:bg-red-650 text-white rounded-xl text-xs font-bold font-sports tracking-wider uppercase transition-all shadow-md shadow-wc-red/10"
                disabled={!rejectionReason.trim()}
              >
                Confirmar Rechazo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
