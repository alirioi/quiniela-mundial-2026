import React, { useState, useEffect } from 'react';
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
      alert(`Error: ${err.message}`);
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
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-900/40 rounded-2xl border border-slate-800/80 backdrop-blur-sm">
        <div className="flex items-center space-x-2">
          {(['pending', 'approved', 'rejected', 'all'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all duration-200 border ${
                filter === status
                  ? status === 'pending'
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                    : status === 'approved'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : status === 'rejected'
                    ? 'bg-red-500/10 border-red-500/30 text-red-400'
                    : 'bg-slate-800 border-slate-700 text-slate-200'
                  : 'bg-slate-950/40 border-transparent hover:border-slate-800 text-slate-500 hover:text-slate-300'
              }`}
            >
              {status === 'pending' && (
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Pendientes
                </span>
              )}
              {status === 'approved' && (
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Aprobados
                </span>
              )}
              {status === 'rejected' && (
                <span className="flex items-center gap-1.5">
                  <XCircle className="w-3.5 h-3.5" /> Rechazados
                </span>
              )}
              {status === 'all' && (
                <span className="flex items-center gap-1.5">
                  <Folder className="w-3.5 h-3.5" /> Todos
                </span>
              )}
            </button>
          ))}
        </div>

        <button
          onClick={fetchEntries}
          className="p-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all duration-200 text-xs font-semibold flex items-center gap-1.5"
          disabled={loading}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Recargar
        </button>
      </div>

      {/* Lista de Cupos */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 space-y-4 bg-slate-900/20 rounded-2xl border border-slate-800/60">
          <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
          <p className="text-slate-500 text-sm">Cargando cupos...</p>
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl bg-red-950/20 border border-red-900/40 text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-red-500 mx-auto" />
          <p className="text-red-400 font-semibold text-sm">{error}</p>
          <button
            onClick={fetchEntries}
            className="px-4 py-2 rounded-xl bg-red-900/20 hover:bg-red-900/40 text-red-300 text-xs font-semibold border border-red-800/40 transition-colors"
          >
            Reintentar
          </button>
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="p-12 text-center bg-slate-900/20 rounded-2xl border border-slate-800/60 text-slate-500 text-sm flex flex-col items-center justify-center space-y-2">
          <Inbox className="w-8 h-8 text-slate-500 mb-1" />
          <span>No hay cupos en esta categoría.</span>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/40 backdrop-blur-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[10px] uppercase font-bold tracking-wider text-slate-400 bg-slate-900/20">
                <th className="p-4 sm:p-5">Usuario / Apodo</th>
                <th className="p-4 sm:p-5">Cupo #</th>
                <th className="p-4 sm:p-5">Fecha Reg.</th>
                <th className="p-4 sm:p-5 text-center">Comprobante</th>
                <th className="p-4 sm:p-5">Estado</th>
                <th className="p-4 sm:p-5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-sm">
              {filteredEntries.map((entry) => {
                const profileName = entry.profiles?.full_name || 'Desconocido';
                const profileEmail = entry.profiles?.email || 'N/A';
                
                return (
                  <tr key={entry.id} className="hover:bg-slate-900/20 transition-colors">
                    <td className="p-4 sm:p-5">
                      <div className="font-semibold text-slate-200">{entry.display_name}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{profileName} • {profileEmail}</div>
                    </td>
                    <td className="p-4 sm:p-5 font-mono text-xs text-slate-300">
                      #{entry.entry_number}
                    </td>
                    <td className="p-4 sm:p-5 text-slate-400 text-xs">
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
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors text-xs font-semibold inline-flex items-center gap-1.5"
                        >
                          <Eye className="w-3.5 h-3.5" /> Ver Archivo
                        </button>
                      ) : (
                        <span className="text-slate-600 text-xs">Sin comprobante</span>
                      )}
                    </td>
                    <td className="p-4 sm:p-5">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                        entry.status === 'approved'
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                          : entry.status === 'rejected'
                          ? 'bg-red-500/10 border-red-500/20 text-red-400'
                          : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                      }`}>
                        {entry.status === 'approved' && 'Aprobado'}
                        {entry.status === 'rejected' && 'Rechazado'}
                        {entry.status === 'pending' && 'Pendiente'}
                      </span>
                    </td>
                    <td className="p-4 sm:p-5 text-right">
                      {actionLoadingId === entry.id ? (
                        <span className="text-xs text-slate-500 animate-pulse">Guardando...</span>
                      ) : (
                        <div className="flex justify-end items-center gap-2">
                          {entry.status !== 'approved' && (
                            <button
                              onClick={() => handleUpdateStatus(entry.id, 'approved')}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs transition-colors flex items-center gap-1"
                              title="Aprobar Pago"
                            >
                              <Check className="w-3.5 h-3.5" /> Aprobar
                            </button>
                          )}
                          {entry.status !== 'rejected' && (
                            <button
                              onClick={() => setRejectingId(entry.id)}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-red-950/40 text-slate-400 hover:text-red-400 border border-slate-700 hover:border-red-900/50 transition-all duration-200 text-xs font-semibold flex items-center gap-1"
                              title="Rechazar Pago"
                            >
                              <X className="w-3.5 h-3.5" /> Rechazar
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
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl relative flex flex-col max-h-[85vh]">
            <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950/40">
              <h3 className="font-bold text-white text-lg">Comprobante - {selectedReceipt.name}</h3>
              <button
                onClick={() => setSelectedReceipt(null)}
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="flex-grow p-6 overflow-y-auto flex items-center justify-center bg-slate-950/40 min-h-[300px]">
              {selectedReceipt.url.includes('.pdf') || selectedReceipt.url.includes('application/pdf') ? (
                <iframe
                  src={selectedReceipt.url}
                  className="w-full h-[50vh] rounded-lg border border-slate-800"
                  title="PDF Comprobante"
                ></iframe>
              ) : (
                <img
                  src={selectedReceipt.url}
                  alt="Comprobante de Pago"
                  className="max-w-full max-h-[50vh] rounded-lg object-contain border border-slate-800 shadow-lg"
                />
              )}
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-900 flex justify-between items-center">
              <a
                href={selectedReceipt.url}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold border border-slate-700 transition-colors flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Abrir en nueva pestaña
              </a>
              <button
                onClick={() => setSelectedReceipt(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-white text-slate-950 rounded-xl text-xs font-bold transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para motivo de rechazo */}
      {rejectingId !== null && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl p-6 space-y-4">
            <h3 className="font-bold text-white text-lg">Rechazar Comprobante</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Indica el motivo por el cual rechazas este comprobante. Se enviará un correo electrónico al usuario con esta explicación.
            </p>
            
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Ej: La captura de pantalla no es legible o el monto transferido es incorrecto."
              className="w-full h-24 p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all"
              required
            ></textarea>

            <div className="flex justify-end items-center gap-3 pt-2">
              <button
                onClick={() => {
                  setRejectingId(null);
                  setRejectionReason('');
                }}
                className="px-4 py-2 bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-xl text-xs font-semibold transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleUpdateStatus(rejectingId, 'rejected', rejectionReason)}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-colors"
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
