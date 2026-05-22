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
      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
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
            ? 'border-emerald-400 bg-emerald-950/10 shadow-lg shadow-emerald-950/10'
            : file
            ? 'border-emerald-500/50 bg-slate-900/40'
            : 'border-slate-800 hover:border-slate-700 bg-slate-950/50 hover:bg-slate-950/80'
        }`}
      >
        {!file ? (
          <div className="space-y-2.5">
            <div className="mx-auto w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 shadow-inner">
              <Upload className="w-5 h-5 text-slate-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-200">
                {initialLabel}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Arrastra y suelta o haz clic para buscar
              </p>
            </div>
            <p className="text-[10px] text-slate-500 font-medium">
              Formatos aceptados: JPG, PNG, WEBP o PDF (Máx. 5MB)
            </p>
          </div>
        ) : (
          <div className="w-full flex items-center justify-between gap-4 p-2 bg-slate-900/60 rounded-xl border border-slate-800/80">
            <div className="flex items-center space-x-3 text-left min-w-0">
              {previewUrl ? (
                <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-800 bg-slate-950 flex-shrink-0">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-lg bg-red-950/20 border border-red-900/30 flex flex-col items-center justify-center text-red-400 text-xs font-bold uppercase flex-shrink-0">
                  <FileText className="w-6 h-6 text-red-400 mb-0.5" />
                  PDF
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-200 truncate max-w-[180px] sm:max-w-[240px]">
                  {file.name}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5 font-mono">
                  {formatBytes(file.size)}
                </p>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-500/10 text-emerald-400 mt-1 border border-emerald-500/10">
                  <Check className="w-2.5 h-2.5" />
                  <span>Listo para subir</span>
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={removeFile}
              className="p-2 rounded-lg bg-slate-800 hover:bg-red-950/50 text-slate-400 hover:text-red-400 border border-slate-700 hover:border-red-900/40 transition-all duration-200 flex items-center justify-center"
              title="Quitar archivo"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-950/40 border border-red-900/50 text-red-400 text-xs font-semibold flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
