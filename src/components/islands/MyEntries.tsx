import React, { useState, useEffect, useRef } from 'react';

interface Entry {
  id: number;
  display_name: string;
  entry_number: number;
  status: 'pending' | 'approved' | 'rejected';
  total_points: number;
  payment_receipt_url: string;
  created_at: string;
  signedUrl: string | null;
  pendingPredictions: number;
  activePhases: { id: number; name: string; slug: string }[];
}

interface MyEntriesProps {
  userFullName: string;
}

export default function MyEntries({ userFullName }: MyEntriesProps) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const FIRST_MATCH_TIME = new Date('2026-06-11T22:30:00Z');
  const REGISTRATION_DEADLINE = new Date(FIRST_MATCH_TIME.getTime() - 2 * 24 * 60 * 60 * 1000);
  const isRegistrationClosed = new Date() >= REGISTRATION_DEADLINE;
  
  // Form states
  const [displayName, setDisplayName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchEntries = async () => {
    try {
      const res = await fetch('/api/user/entries');
      if (res.ok) {
        const data = await res.json();
        setEntries(data);
      }
    } catch (e) {
      console.error('Error al cargar los cupos:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
  }, []);

  const openModal = () => {
    // Sugerir un nombre por defecto: Nombre #SiguienteNumero
    const nextNumber = entries.length + 1;
    setDisplayName(`${userFullName} #${nextNumber}`);
    setFile(null);
    setPreviewUrl(null);
    setFormError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (!submitting) {
      setIsModalOpen(false);
    }
  };

  const handleFileChange = (selectedFile: File) => {
    setFormError(null);
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(selectedFile.type)) {
      setFormError('Formato no válido. Solo se permiten imágenes (JPG, PNG, WEBP) o archivos PDF.');
      return;
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (selectedFile.size > maxSize) {
      setFormError('El archivo es demasiado grande. El tamaño máximo permitido es de 5MB.');
      return;
    }

    setFile(selectedFile);
    if (selectedFile.type.startsWith('image/')) {
      const url = URL.createObjectURL(selectedFile);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileChange(e.target.files[0]);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setFormError('El nombre del cupo es obligatorio');
      return;
    }
    if (!file) {
      setFormError('Debes subir un comprobante de pago');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const formData = new FormData();
      formData.append('displayName', displayName);
      formData.append('receipt', file);

      const response = await fetch('/api/entries/new', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al procesar la solicitud');
      }

      // Éxito: recargar entradas y cerrar modal
      await fetchEntries();
      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Error de red al registrar el cupo');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: Entry['status']) => {
    switch (status) {
      case 'approved':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5 w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            Aprobado
          </span>
        );
      case 'rejected':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1.5 w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
            Rechazado
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1.5 w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
            Pendiente
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm text-slate-400">Cargando tus cupos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Encabezado y botón */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900/40 border border-slate-800 p-6 rounded-2xl backdrop-blur-md relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>
        <div>
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
            🎟️ Gestión de Cupos
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-xl leading-relaxed">
            Aquí puedes ver el estado de tus cupos registrados, consultar sus puntuaciones y comprar cupos adicionales para multiplicar tus oportunidades de ganar.
          </p>
        </div>
        {isRegistrationClosed ? (
          <div className="flex flex-col items-end gap-1">
            <span className="px-4 py-2.5 bg-slate-800 text-slate-500 rounded-xl text-xs font-semibold border border-slate-700/50 flex items-center justify-center gap-1.5 cursor-not-allowed">
              🔒 Compras Cerradas
            </span>
            <span className="text-[10px] text-slate-500">Finalizó el 9 de Junio</span>
          </div>
        ) : (
          <button
            onClick={openModal}
            className="px-5 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-950/20 hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2"
          >
            <span>➕ Comprar Cupo Adicional</span>
          </button>
        )}
      </div>

      {/* Lista de cupos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {entries.map((entry) => {
          const hasPending = entry.status === 'approved' && entry.pendingPredictions > 0;
          return (
            <div
              key={entry.id}
              className={`p-6 rounded-2xl border bg-slate-900/60 backdrop-blur-md flex flex-col justify-between gap-5 relative overflow-hidden transition-all duration-300 ${
                entry.status === 'approved' 
                  ? 'border-slate-800 hover:border-emerald-500/30' 
                  : entry.status === 'rejected'
                  ? 'border-slate-800 hover:border-rose-500/30'
                  : 'border-slate-800 hover:border-amber-500/30 animate-pulse-subtle'
              }`}
            >
              {/* Decorative backgrounds based on status */}
              {entry.status === 'approved' && (
                <div className="absolute -top-10 -right-10 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none"></div>
              )}
              {entry.status === 'pending' && (
                <div className="absolute -top-10 -right-10 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl pointer-events-none"></div>
              )}
              {entry.status === 'rejected' && (
                <div className="absolute -top-10 -right-10 w-24 h-24 bg-rose-500/5 rounded-full blur-2xl pointer-events-none"></div>
              )}

              {/* Contenido Superior */}
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-bold text-slate-100 flex items-center gap-1.5">
                      {entry.display_name}
                      <span className="text-xs font-mono font-medium text-slate-500">
                        #{entry.entry_number}
                      </span>
                    </h3>
                    <p className="text-[10px] text-slate-500 mt-1 font-mono">
                      Registrado el:{' '}
                      {new Date(entry.created_at).toLocaleDateString('es-ES', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                  {getStatusBadge(entry.status)}
                </div>

                <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-slate-950 border border-slate-900/80">
                  <div>
                    <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Puntuación</div>
                    <div className="text-2xl font-black text-white mt-1">
                      {entry.status === 'approved' ? entry.total_points : '--'}
                      <span className="text-xs font-normal text-slate-400 ml-1">pts</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Pronósticos</div>
                    <div className="text-sm font-bold text-slate-300 mt-2">
                      {entry.status === 'approved' ? (
                        hasPending ? (
                          <span className="text-amber-400 flex items-center gap-1">
                            ⚠️ {entry.pendingPredictions} pendientes
                          </span>
                        ) : (
                          <span className="text-emerald-400 flex items-center gap-1">
                            ✓ Completos
                          </span>
                        )
                      ) : (
                        <span className="text-slate-500">Esperando aprobación</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Botones de acción inferiores */}
              <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-800/60">
                {entry.status === 'approved' && (
                  <a
                    href={entry.activePhases.length > 0 ? `/predictions/${entry.activePhases[0].slug}` : '#'}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 hover:border-slate-600 rounded-xl text-xs font-semibold transition-all hover:-translate-y-0.5 flex items-center gap-1.5"
                  >
                    📝 Pronosticar
                  </a>
                )}
                {entry.signedUrl && (
                  <a
                    href={entry.signedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-slate-950 hover:bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-900 hover:border-slate-800 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5"
                  >
                    📄 Ver Comprobante
                  </a>
                )}
                {entry.status === 'rejected' && (
                  <div className="text-xs text-rose-400/90 font-medium">
                    ❌ El administrador rechazó el comprobante. Por favor, sube un cupo nuevo con un pago válido o contáctanos.
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL PARA NUEVO CUPO */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div 
            className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden flex flex-col gap-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Gradients */}
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

            {/* Cabecera modal */}
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  🏆 Comprar Cupo Adicional
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Registra un nuevo cupo subiendo un comprobante de transferencia.
                </p>
              </div>
              <button
                onClick={closeModal}
                disabled={submitting}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-all disabled:opacity-50"
              >
                ✕
              </button>
            </div>

            {/* Desglose de Pago */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="text-xs font-semibold text-slate-400 flex justify-between">
                <span>Costo del cupo:</span>
                <span className="text-white font-bold">20.00 USDT</span>
              </div>
              <div className="h-[1px] bg-slate-800/80"></div>
              <div className="space-y-2 text-xs text-slate-400">
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-1.5">
                    <span className="text-emerald-400">🏆</span> Al pote de premios:
                  </span>
                  <span className="text-slate-200 font-semibold font-mono">15.00 USDT</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-1.5">
                    <span className="text-slate-500">⚙️</span> Gastos operativos:
                  </span>
                  <span className="text-slate-200 font-semibold font-mono">5.00 USDT</span>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-900 text-[10px] text-emerald-400 font-medium text-center font-bold">
                📢 El 100% del pote acumulado se entregará al primer lugar (único ganador) al finalizar el torneo.
              </div>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="displayName" className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Nombre del Cupo
                </label>
                <input
                  type="text"
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-all font-semibold"
                  placeholder="Ej: MiNombre #2"
                  disabled={submitting}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Comprobante de Pago
                </label>

                {/* Input oculto */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={onFileInputChange}
                  accept=".jpg,.jpeg,.png,.webp,.pdf"
                  className="hidden"
                  disabled={submitting}
                />

                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`w-full min-h-[140px] p-5 rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer flex flex-col items-center justify-center text-center ${
                    dragActive
                      ? 'border-emerald-400 bg-emerald-950/10'
                      : file
                      ? 'border-emerald-500/50 bg-slate-950/40'
                      : 'border-slate-800 hover:border-slate-700 bg-slate-950/30 hover:bg-slate-950/50'
                  }`}
                >
                  {!file ? (
                    <div className="space-y-2">
                      <div className="mx-auto w-10 h-10 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center text-lg text-slate-400">
                        📤
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-200">
                          Sube tu comprobante de pago
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          Haz clic para explorar o arrastra aquí
                        </p>
                      </div>
                      <p className="text-[9px] text-slate-500">
                        Formatos: JPG, PNG, WEBP, PDF (Máx. 5MB)
                      </p>
                    </div>
                  ) : (
                    <div className="w-full flex items-center justify-between gap-3 p-2 bg-slate-950 rounded-xl border border-slate-800">
                      <div className="flex items-center space-x-3 text-left min-w-0">
                        {previewUrl ? (
                          <div className="w-12 h-12 rounded-lg overflow-hidden border border-slate-800 bg-slate-950 flex-shrink-0">
                            <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-red-950/20 border border-red-900/30 flex flex-col items-center justify-center text-red-400 text-[10px] font-bold uppercase flex-shrink-0">
                            📄
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-200 truncate max-w-[150px]">
                            {file.name}
                          </p>
                          <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-semibold bg-emerald-500/10 text-emerald-400 mt-1 border border-emerald-500/10">
                            ✓ Listo
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFile(null);
                          setPreviewUrl(null);
                        }}
                        disabled={submitting}
                        className="p-2 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-red-400 transition-all"
                      >
                        🗑️
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {formError && (
                <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-900/40 text-rose-400 text-xs font-semibold">
                  ⚠️ {formError}
                </div>
              )}

              {/* Botones de acción modal */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={submitting}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-slate-950 hover:bg-slate-900 border border-slate-900 hover:border-slate-800 transition-all disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-950/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                      Procesando...
                    </>
                  ) : (
                    'Confirmar Pago'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
