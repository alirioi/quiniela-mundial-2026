import React, { useState, useEffect, useRef } from 'react';
import { 
  Ticket, 
  Lock, 
  Plus, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Edit3, 
  FileText, 
  Trophy, 
  Settings, 
  Megaphone, 
  UploadCloud, 
  Trash2, 
  X,
  Clock,
  Check,
  Copy
} from 'lucide-react';

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
  const [paymentMethod, setPaymentMethod] = useState('binance_pay');
  const [paymentReference, setPaymentReference] = useState('');
  const [euroRate, setEuroRate] = useState<number | null>(null);
  const [vesAmount, setVesAmount] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  useEffect(() => {
    const fetchRate = async () => {
      try {
        const res = await fetch('https://ve.dolarapi.com/v1/euros/oficial');
        const data = await res.json();
        if (data && data.promedio) {
          setEuroRate(data.promedio);
          setVesAmount(30 * data.promedio);
        }
      } catch (e) {
        console.error('Error fetching euro rate:', e);
      }
    };
    fetchRate();
  }, []);
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
    setPaymentMethod('binance_pay');
    setPaymentReference('');
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
    if (!paymentReference.trim()) {
      setFormError('La referencia del pago es obligatoria');
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
      formData.append('paymentMethod', paymentMethod);
      formData.append('paymentReference', paymentReference);
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
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-wc-green/10 text-wc-green border border-wc-green/20 flex items-center gap-1.5 w-fit font-sports tracking-wider uppercase">
            <CheckCircle2 className="w-3.5 h-3.5 text-wc-green" strokeWidth={2.5} />
            Aprobado
          </span>
        );
      case 'rejected':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-wc-red/10 text-wc-red border border-wc-red/20 flex items-center gap-1.5 w-fit font-sports tracking-wider uppercase">
            <XCircle className="w-3.5 h-3.5 text-wc-red" strokeWidth={2.5} />
            Rechazado
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-wc-gold/10 text-wc-gold border border-wc-gold/20 flex items-center gap-1.5 w-fit font-sports tracking-wider uppercase">
            <Clock className="w-3.5 h-3.5 text-wc-gold animate-pulse-subtle" strokeWidth={2.5} />
            Pendiente
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="w-10 h-10 border-4 border-wc-gold border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm text-slate-400 font-sports tracking-wider uppercase">Cargando tus cupos...</p>
      </div>
    );
  }
  return (
    <div className="space-y-8">
      {/* Encabezado y botón */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-wc-card/50 border border-wc-border p-6 rounded-2xl backdrop-blur-md relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-wc-gold/5 rounded-full blur-3xl pointer-events-none"></div>
        <div>
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2 font-sports tracking-wider uppercase">
            <Ticket className="w-5.5 h-5.5 text-wc-gold" strokeWidth={2.5} />
            <span>Gestión de Cupos</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-xl leading-relaxed">
            Aquí puedes ver el estado de tus cupos registrados, consultar sus puntuaciones y comprar cupos adicionales para multiplicar tus oportunidades de ganar.
          </p>
        </div>
        {isRegistrationClosed ? (
          <div className="flex flex-col items-end gap-1">
            <span className="px-4 py-2.5 bg-wc-dark text-slate-500 rounded-xl text-xs font-semibold border border-wc-border flex items-center justify-center gap-1.5 cursor-not-allowed font-sports tracking-wider uppercase">
              <Lock className="w-4 h-4 text-slate-500" strokeWidth={2.5} />
              <span>Compras Cerradas</span>
            </span>
            <span className="text-xs text-slate-500 font-sports tracking-wider">Finalizó el 9 de Junio</span>
          </div>
        ) : (
          <button
            onClick={openModal}
            className="px-5 py-3 bg-gradient-to-r from-wc-gold to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-slate-955 rounded-xl text-xs font-bold font-sports tracking-wider uppercase transition-all shadow-lg shadow-wc-gold/10 hover:shadow-wc-gold/25 hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4 text-slate-955" strokeWidth={2.5} />
            <span>Comprar Cupo Adicional</span>
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
              className={`p-6 rounded-2xl border bg-wc-card/50 backdrop-blur-md flex flex-col justify-between gap-5 relative overflow-hidden transition-all duration-300 ${
                entry.status === 'approved' 
                  ? 'border-wc-border hover:border-wc-gold/30' 
                  : entry.status === 'rejected'
                  ? 'border-wc-border hover:border-wc-red/30'
                  : 'border-wc-border hover:border-wc-gold/20 animate-pulse-subtle'
              }`}
            >
              {/* Decorative backgrounds based on status */}
              {entry.status === 'approved' && (
                <div className="absolute -top-10 -right-10 w-24 h-24 bg-wc-gold/5 rounded-full blur-2xl pointer-events-none"></div>
              )}
              {entry.status === 'pending' && (
                <div className="absolute -top-10 -right-10 w-24 h-24 bg-wc-gold/5 rounded-full blur-2xl pointer-events-none"></div>
              )}
              {entry.status === 'rejected' && (
                <div className="absolute -top-10 -right-10 w-24 h-24 bg-wc-red/5 rounded-full blur-2xl pointer-events-none"></div>
              )}

              {/* Contenido Superior */}
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-bold text-slate-100 flex items-center gap-1.5 font-sports tracking-wide uppercase">
                      {entry.display_name}
                      <span className="text-xs font-mono font-medium text-slate-500">
                        #{entry.entry_number}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 font-sports tracking-wider">
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

                <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-wc-dark border border-wc-border">
                  <div>
                    <div className="text-xs uppercase font-bold text-slate-500 tracking-wider font-sports">Puntuación</div>
                    <div className="text-2xl font-black text-white mt-1 font-sports tracking-wider">
                      {entry.status === 'approved' ? entry.total_points : '--'}
                      <span className="text-xs font-normal text-slate-400 ml-1 font-sports tracking-normal">pts</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase font-bold text-slate-500 tracking-wider font-sports">Pronósticos</div>
                    <div className="text-sm font-bold text-slate-300 mt-2 font-sports tracking-wider uppercase">
                      {entry.status === 'approved' ? (
                        hasPending ? (
                          <span className="text-wc-gold flex items-center gap-1">
                            <AlertTriangle className="w-4 h-4 text-wc-gold" strokeWidth={2.5} />
                            <span>{entry.pendingPredictions} pendientes</span>
                          </span>
                        ) : (
                          <span className="text-wc-green flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4 text-wc-green" strokeWidth={2.5} />
                            <span>Completos</span>
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
              <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-wc-border/50">
                {entry.status === 'approved' && (
                  <a
                    href={entry.activePhases.length > 0 ? `/predictions/${entry.activePhases[0].slug}` : '#'}
                    className="px-4 py-2 bg-slate-800 hover:bg-wc-card text-slate-200 border border-slate-700 hover:border-wc-border rounded-xl text-xs font-semibold transition-all hover:-translate-y-0.5 flex items-center gap-1.5 font-sports tracking-wider uppercase"
                  >
                    <Edit3 className="w-4 h-4 text-slate-300" strokeWidth={2.5} />
                    <span>Pronosticar</span>
                  </a>
                )}
                {entry.signedUrl && (
                  <a
                    href={entry.signedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-wc-dark hover:bg-wc-card text-slate-400 hover:text-slate-200 border border-wc-border rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 font-sports tracking-wider uppercase"
                  >
                    <FileText className="w-4 h-4 text-slate-400" strokeWidth={2.5} />
                    <span>Ver Comprobante</span>
                  </a>
                )}
                {entry.status === 'rejected' && (
                  <div className="text-xs text-wc-red font-medium flex items-start gap-1.5">
                    <XCircle className="w-4 h-4 text-wc-red shrink-0 mt-0.5" strokeWidth={2.5} />
                    <span>El administrador rechazó el comprobante. Por favor, sube un cupo nuevo con un pago válido o contáctanos.</span>
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
            className="w-full max-w-lg bg-wc-card border border-wc-border rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-y-auto overflow-x-hidden custom-scrollbar max-h-[calc(100vh-2rem)] flex flex-col gap-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Gradients */}
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-wc-gold/5 rounded-full blur-3xl pointer-events-none"></div>

            {/* Cabecera modal */}
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2 font-sports tracking-wider uppercase">
                  <Trophy className="w-5.5 h-5.5 text-wc-gold" strokeWidth={2.5} />
                  <span>Comprar Cupo Adicional</span>
                </h3>
                <p className="text-xs md:text-sm text-slate-400 mt-1">
                  Registra un nuevo cupo subiendo un comprobante de transferencia.
                </p>
              </div>
              <button
                onClick={closeModal}
                disabled={submitting}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-all disabled:opacity-50"
              >
                <X className="w-4.5 h-4.5" strokeWidth={2.5} />
              </button>
            </div>

            {/* Desglose de Pago */}
            <div className="p-4 rounded-xl bg-wc-dark border border-wc-border space-y-3">
              <div className="text-xs md:text-sm font-semibold text-slate-400 flex justify-between font-sports tracking-wider">
                <span>Costo del cupo:</span>
                <span className="text-wc-gold font-bold">20.00 USDT</span>
              </div>
              <div className="h-[1px] bg-wc-border/60"></div>
              <div className="space-y-2 text-xs md:text-sm text-slate-400 font-sports tracking-wider">
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-1.5">
                    <Trophy className="w-4 h-4 text-wc-gold" strokeWidth={2.5} />
                    <span>Al pote de premios:</span>
                  </span>
                  <span className="text-slate-200 font-semibold font-mono">15.00 USDT</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-1.5">
                    <Settings className="w-4 h-4 text-slate-500" strokeWidth={2.5} />
                    <span>Gastos operativos:</span>
                  </span>
                  <span className="text-slate-200 font-semibold font-mono">5.00 USDT</span>
                </div>
              </div>
              <div className="pt-2 border-t border-wc-border/50 text-xs md:text-sm text-wc-gold font-bold text-center flex items-center justify-center gap-1.5 font-sports tracking-wider uppercase">
                <Megaphone className="w-4 h-4 text-wc-gold shrink-0 animate-pulse-subtle" strokeWidth={2.5} />
                <span>El 100% del pote acumulado se entregará al primer lugar (único ganador) al finalizar el torneo.</span>
              </div>
            </div>

            {/* Selector de Método de Pago */}
            <div className="space-y-3 mt-6">
              <h4 className="text-xs md:text-sm font-bold uppercase tracking-wider text-slate-200 font-sports">
                Método de Pago
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className={`cursor-pointer flex items-center justify-center gap-2 p-3 rounded-xl border ${paymentMethod === 'binance_pay' ? 'border-wc-gold bg-wc-gold/10' : 'border-wc-border bg-wc-dark hover:border-slate-600'} transition-all`}>
                  <input type="radio" name="payment_method" value="binance_pay" checked={paymentMethod === 'binance_pay'} onChange={(e) => setPaymentMethod(e.target.value)} className="hidden" />
                  <span className={`text-xs font-bold font-sports uppercase tracking-wider ${paymentMethod === 'binance_pay' ? 'text-wc-gold' : 'text-slate-400'}`}>Binance Pay</span>
                </label>
                <label className={`cursor-pointer flex items-center justify-center gap-2 p-3 rounded-xl border ${paymentMethod === 'pago_movil' ? 'border-wc-gold bg-wc-gold/10' : 'border-wc-border bg-wc-dark hover:border-slate-600'} transition-all`}>
                  <input type="radio" name="payment_method" value="pago_movil" checked={paymentMethod === 'pago_movil'} onChange={(e) => setPaymentMethod(e.target.value)} className="hidden" />
                  <span className={`text-xs font-bold font-sports uppercase tracking-wider ${paymentMethod === 'pago_movil' ? 'text-wc-gold' : 'text-slate-400'}`}>Pago Móvil (Bs)</span>
                </label>
                <label className={`cursor-pointer flex items-center justify-center gap-2 p-3 rounded-xl border ${paymentMethod === 'transferencia_bs' ? 'border-wc-gold bg-wc-gold/10' : 'border-wc-border bg-wc-dark hover:border-slate-600'} transition-all`}>
                  <input type="radio" name="payment_method" value="transferencia_bs" checked={paymentMethod === 'transferencia_bs'} onChange={(e) => setPaymentMethod(e.target.value)} className="hidden" />
                  <span className={`text-xs font-bold font-sports uppercase tracking-wider ${paymentMethod === 'transferencia_bs' ? 'text-wc-gold' : 'text-slate-400'}`}>Transferencia (Bs)</span>
                </label>
              </div>
            </div>

            {/* Datos de Pago e Instrucciones */}
            <div className="p-4 rounded-xl bg-wc-dark/65 border border-wc-border space-y-3 text-slate-300 mt-6">
              <h4 className="text-xs md:text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5 font-sports">
                <span className="w-2 h-2 rounded-full bg-wc-gold animate-pulse"></span>
                <span>Instrucciones de Pago</span>
              </h4>
              
              {paymentMethod === 'binance_pay' && (
                <>
                  <p className="text-xs md:text-sm text-slate-400 leading-relaxed">
                    Realiza una transferencia de exactamente <strong className="text-wc-gold">20.00 USDT</strong> a la siguiente cuenta de Binance Pay:
                  </p>
                  <div className="p-3 bg-wc-card rounded-lg border border-wc-border/60 text-xs md:text-sm font-mono space-y-1.5 text-slate-200">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1">
                      <span className="text-slate-400">Binance Pay ID:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold select-all">139030711</span>
                        <button type="button" onClick={() => copyToClipboard('139030711', 'binance_id')} className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-wc-gold transition-colors" title="Copiar">
                          {copiedId === 'binance_id' ? <Check className="w-3.5 h-3.5 text-wc-green" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1">
                      <span className="text-slate-400">Nombre de la Cuenta:</span>
                      <span className="font-bold">Alirio Isea</span>
                    </div>
                  </div>
                </>
              )}

              {(paymentMethod === 'pago_movil' || paymentMethod === 'transferencia_bs') && (
                <div className="space-y-3">
                  <div className="p-3 bg-wc-gold/10 border border-wc-gold/20 rounded-lg text-xs md:text-sm text-wc-gold font-medium leading-relaxed">
                    <span className="font-bold">Aviso:</span> Si el pago es en Bolívares, el costo del cupo es de <strong>30 USD</strong> calculados a la tasa del Euro oficial (BCV) del día del pago. Ese dinero luego se cambiará a USDT y se aplicará la misma distribución de 15 USDT al pote y 5 USDT a gastos operativos.
                  </div>
                  
                  {euroRate && vesAmount ? (
                    <p className="text-xs md:text-sm text-slate-400 leading-relaxed">
                      Tasa Euro BCV actual: <strong className="text-slate-200">{formatCurrency(euroRate)} Bs</strong><br/>
                      Monto total a transferir: <strong className="text-wc-gold text-base">{formatCurrency(vesAmount)} Bs</strong>
                    </p>
                  ) : (
                    <p className="text-xs text-slate-500 animate-pulse">Consultando tasa del Euro BCV actual...</p>
                  )}

                  {paymentMethod === 'pago_movil' && (
                    <div className="p-3 bg-wc-card rounded-lg border border-wc-border/60 text-xs md:text-sm font-mono space-y-2 text-slate-200">
                      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1">
                        <span className="text-slate-400">Banco:</span>
                        <span className="font-bold">Banco de Venezuela (0102)</span>
                      </div>
                      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1">
                        <span className="text-slate-400">CI/RIF:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold select-all">V23719075</span>
                          <button type="button" onClick={() => copyToClipboard('V23719075', 'pm_ci')} className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-wc-gold transition-colors" title="Copiar">
                            {copiedId === 'pm_ci' ? <Check className="w-3.5 h-3.5 text-wc-green" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1">
                        <span className="text-slate-400">Teléfono:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold select-all">04147535965</span>
                          <button type="button" onClick={() => copyToClipboard('04147535965', 'pm_tlf')} className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-wc-gold transition-colors" title="Copiar">
                            {copiedId === 'pm_tlf' ? <Check className="w-3.5 h-3.5 text-wc-green" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {paymentMethod === 'transferencia_bs' && (
                    <div className="space-y-3">
                      <div className="p-3 bg-wc-card rounded-lg border border-wc-border/60 text-xs font-mono space-y-1.5 text-slate-200">
                        <p className="font-bold text-wc-gold mb-2">A) Banco de Venezuela</p>
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1">
                          <span className="text-slate-400">Cuenta:</span>
                          <div className="flex items-center gap-2">
                            <span className="font-bold select-all">01020441170000346696</span>
                            <button type="button" onClick={() => copyToClipboard('01020441170000346696', 'tb_cuenta_1')} className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-wc-gold" title="Copiar">
                              {copiedId === 'tb_cuenta_1' ? <Check className="w-3.5 h-3.5 text-wc-green" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1">
                          <span className="text-slate-400">CI:</span>
                          <div className="flex items-center gap-2">
                            <span className="font-bold select-all">V23719075</span>
                            <button type="button" onClick={() => copyToClipboard('V23719075', 'tb_ci_1')} className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-wc-gold" title="Copiar">
                              {copiedId === 'tb_ci_1' ? <Check className="w-3.5 h-3.5 text-wc-green" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1">
                          <span className="text-slate-400">Nombre:</span>
                          <span className="font-bold">Alirio Salvador Isea Moreno</span>
                        </div>
                      </div>

                      <div className="p-3 bg-wc-card rounded-lg border border-wc-border/60 text-xs font-mono space-y-1.5 text-slate-200">
                        <p className="font-bold text-wc-gold mb-2">B) Banesco</p>
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1">
                          <span className="text-slate-400">Cuenta (Corriente):</span>
                          <div className="flex items-center gap-2">
                            <span className="font-bold select-all">01340244272441045080</span>
                            <button type="button" onClick={() => copyToClipboard('01340244272441045080', 'tb_cuenta_2')} className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-wc-gold transition-colors" title="Copiar">
                              {copiedId === 'tb_cuenta_2' ? <Check className="w-3.5 h-3.5 text-wc-green" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1">
                          <span className="text-slate-400">CI:</span>
                          <div className="flex items-center gap-2">
                            <span className="font-bold select-all">V23719075</span>
                            <button type="button" onClick={() => copyToClipboard('V23719075', 'tb_ci_2')} className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-wc-gold transition-colors" title="Copiar">
                              {copiedId === 'tb_ci_2' ? <Check className="w-3.5 h-3.5 text-wc-green" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1">
                          <span className="text-slate-400">Nombre:</span>
                          <span className="font-bold">Alirio Salvador Isea Moreno</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              <p className="text-xs md:text-sm text-wc-red font-semibold leading-relaxed mt-2 p-2.5 bg-wc-red/10 border border-wc-red/20 rounded-lg">
                * IMPORTANTE: No incluyas palabras como "apuesta", "quiniela", "sorteo" ni referencias a juegos de azar en la nota de transferencia para evitar el bloqueo de las cuentas.
              </p>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="displayName" className="block text-xs md:text-sm font-semibold uppercase tracking-wider text-slate-400 font-sports">
                  Nombre del Cupo
                </label>
                <input
                  type="text"
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-wc-dark border border-wc-border rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-wc-gold transition-all font-semibold"
                  placeholder="Ej: MiNombre #2"
                  disabled={submitting}
                  required
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="paymentReference" className="block text-xs md:text-sm font-semibold uppercase tracking-wider text-slate-400 font-sports">
                  Referencia del Pago
                </label>
                <input
                  type="text"
                  id="paymentReference"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  className="w-full bg-wc-dark border border-wc-border rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-wc-gold transition-all font-semibold"
                  placeholder={paymentMethod === 'binance_pay' ? "Ej: alias@gmail.com o ID 123456" : "Ej: Ref: 123456 o Teléfono asociado"}
                  disabled={submitting}
                  required
                />
              </div>

              <div className="space-y-2 mt-6">
                <label className="block text-xs md:text-sm font-semibold uppercase tracking-wider text-slate-400 font-sports">
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
                      ? 'border-wc-gold bg-wc-gold/10'
                      : file
                      ? 'border-wc-gold/50 bg-wc-dark'
                      : 'border-wc-border hover:border-slate-700 bg-wc-dark/50 hover:bg-wc-dark/80'
                  }`}
                >
                  {!file ? (
                    <div className="space-y-2">
                      <div className="mx-auto w-10 h-10 rounded-full bg-wc-dark border border-wc-border flex items-center justify-center text-wc-gold">
                        <UploadCloud className="w-5 h-5 text-wc-gold" strokeWidth={2.5} />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-200">
                          {paymentMethod === 'binance_pay' 
                            ? "Sube tu comprobante de 20 USDT" 
                            : vesAmount 
                              ? `Sube tu comprobante de ${formatCurrency(vesAmount)} VES` 
                              : "Sube tu comprobante de pago"}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Haz clic para explorar o arrastra aquí
                        </p>
                      </div>
                      <p className="text-xs text-slate-500 font-sports tracking-wider uppercase">
                        Formatos: JPG, PNG, WEBP, PDF (Máx. 5MB)
                      </p>
                    </div>
                  ) : (
                    <div className="w-full flex items-center justify-between gap-3 p-2 bg-wc-dark rounded-xl border border-wc-border">
                      <div className="flex items-center space-x-3 text-left min-w-0">
                        {previewUrl ? (
                          <div className="w-12 h-12 rounded-lg overflow-hidden border border-wc-border bg-wc-dark flex-shrink-0">
                            <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-wc-red/10 border border-wc-red/20 flex flex-col items-center justify-center text-wc-red flex-shrink-0 font-sports tracking-wide text-xs">
                            <FileText className="w-6 h-6 text-wc-red" strokeWidth={2.5} />
                            PDF
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-200 truncate max-w-[150px]">
                            {file.name}
                          </p>
                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-wc-green/10 text-wc-green mt-1 border border-wc-green/15 font-sports tracking-wider uppercase">
                            <Check className="w-3 h-3 text-wc-green" strokeWidth={2.5} /> Listo
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
                        className="p-2 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-wc-red transition-all"
                      >
                        <Trash2 className="w-4.5 h-4.5" strokeWidth={2.5} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {formError && (
                <div className="p-3 rounded-xl bg-wc-red/10 border border-wc-red/20 text-wc-red text-xs font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-4.5 h-4.5 text-wc-red shrink-0" strokeWidth={2.5} />
                  <span>{formError}</span>
                </div>
              )}

              {/* Botones de acción modal */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={submitting}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-wc-dark hover:bg-slate-900 border border-wc-border hover:border-slate-800 transition-all disabled:opacity-50 font-sports tracking-wider uppercase"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-wc-gold to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-slate-955 shadow-lg shadow-wc-gold/15 disabled:opacity-50 transition-all flex items-center justify-center gap-2 font-sports tracking-wider uppercase"
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
