import React, { useState, useRef } from 'react';
import { Upload, FileText, Check, Trash2, AlertTriangle } from 'lucide-react';

interface PaymentUploadProps {
  initialLabel?: string;
}

export default function PaymentUpload({ initialLabel = 'Sube tu comprobante de pago' }: PaymentUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (selectedFile: File) => {
    setError(null);

    // Validar tipo de archivo
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(selectedFile.type)) {
      setError('Formato no válido. Solo se permiten imágenes (JPG, PNG, WEBP) o archivos PDF.');
      return;
    }

    // Validar tamaño (5MB = 5 * 1024 * 1024 bytes)
    const maxSize = 5 * 1024 * 1024;
    if (selectedFile.size > maxSize) {
      setError('El archivo es demasiado grande. El tamaño máximo permitido es de 5MB.');
      return;
    }

    setFile(selectedFile);

    // Generar preview si es imagen
    if (selectedFile.type.startsWith('image/')) {
      const url = URL.createObjectURL(selectedFile);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null); // Para PDF no mostramos preview de imagen
    }
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileChange(e.target.files[0]);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const onDragLeave = () => {
    setIsDragOver(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
      // Sincronizar con el input para que el submit del formulario nativo funcione
      if (fileInputRef.current) {
        fileInputRef.current.files = e.dataTransfer.files;
      }
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const removeFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFile(null);
    setPreviewUrl(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-4">
      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 font-sports">
        Comprobante de Pago (Transacción de 20 USDT)
      </label>

      {/* Input de archivo nativo oculto pero enlazado al formulario */}
      <input
        type="file"
        id="receipt"
        name="receipt"
        ref={fileInputRef}
        onChange={onFileInputChange}
        accept=".jpg,.jpeg,.png,.webp,.pdf"
        className="hidden"
        required
      />

      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={triggerFileInput}
        className={`w-full min-h-[160px] p-6 rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer flex flex-col items-center justify-center text-center ${
          isDragOver
            ? 'border-wc-gold bg-wc-gold/10 shadow-lg shadow-wc-gold/10'
            : file
            ? 'border-wc-gold/50 bg-wc-card/60'
            : 'border-wc-border hover:border-slate-700 bg-wc-card/50 hover:bg-wc-card/80'
        }`}
      >
        {!file ? (
          <div className="space-y-2.5">
            <div className="mx-auto w-12 h-12 rounded-full bg-wc-dark border border-wc-border flex items-center justify-center text-wc-gold shadow-inner">
              <Upload className="w-5 h-5 text-wc-gold" strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-205">
                {initialLabel}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Arrastra y suelta o haz clic para buscar
              </p>
            </div>
            <p className="text-xs text-slate-500 font-medium font-sports tracking-wider uppercase">
              Formatos aceptados: JPG, PNG, WEBP o PDF (Máx. 5MB)
            </p>
          </div>
        ) : (
          <div className="w-full flex items-center justify-between gap-4 p-2.5 bg-wc-dark/60 rounded-xl border border-wc-border/80">
            <div className="flex items-center space-x-3 text-left min-w-0">
              {previewUrl ? (
                <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-wc-border bg-wc-dark flex-shrink-0">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-lg bg-wc-red/10 border border-wc-red/20 flex flex-col items-center justify-center text-wc-red text-xs font-bold uppercase flex-shrink-0 font-sports tracking-wide">
                  <FileText className="w-6 h-6 text-wc-red mb-0.5" strokeWidth={2.5} />
                  PDF
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-200 truncate max-w-[180px] sm:max-w-[240px]">
                  {file.name}
                </p>
                <p className="text-xs text-slate-500 mt-0.5 font-sports tracking-wider">
                  {formatBytes(file.size)}
                </p>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-wc-green/10 text-wc-green mt-1 border border-wc-green/15 font-sports tracking-wider uppercase">
                  <Check className="w-3 h-3 text-wc-green" strokeWidth={2.5} />
                  <span>Listo para subir</span>
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={removeFile}
              className="p-2.5 rounded-lg bg-slate-800 hover:bg-wc-red/20 text-slate-400 hover:text-wc-red border border-slate-700 hover:border-wc-red/30 transition-all duration-200 flex items-center justify-center"
              title="Quitar archivo"
            >
              <Trash2 className="w-4.5 h-4.5" strokeWidth={2.5} />
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-wc-red/10 border border-wc-red/20 text-wc-red text-xs font-semibold flex items-center gap-1.5">
          <AlertTriangle className="w-4.5 h-4.5 shrink-0 text-wc-red" strokeWidth={2.5} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
