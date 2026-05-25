import React, { useState } from 'react';
import { User, Mail, Lock, Phone, Calendar, Save, AlertCircle, CheckCircle2 } from 'lucide-react';

interface ProfileEditorProps {
  userProfile: {
    id: string;
    full_name: string;
    phone: string | null;
    birth_date: string | null;
  };
  userEmail: string;
}

export default function ProfileEditor({ userProfile, userEmail }: ProfileEditorProps) {
  const [formData, setFormData] = useState({
    full_name: userProfile.full_name || '',
    phone: userProfile.phone || '',
    birth_date: userProfile.birth_date || '',
    email: userEmail || '',
    current_password: '',
    new_password: '',
    confirm_password: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validations
    if (!formData.full_name.trim()) {
      return setError('El nombre completo es obligatorio.');
    }
    
    // Password validation
    const changingPassword = formData.new_password || formData.confirm_password;
    if (changingPassword) {
      if (!formData.current_password) {
        return setError('Debes ingresar tu contraseña actual para cambiarla.');
      }
      if (formData.new_password.length < 6) {
        return setError('La nueva contraseña debe tener al menos 6 caracteres.');
      }
      if (formData.new_password !== formData.confirm_password) {
        return setError('Las contraseñas nuevas no coinciden.');
      }
    }

    setLoading(true);

    try {
      const response = await fetch('/api/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al actualizar el perfil');
      }

      let successMessage = 'Perfil actualizado correctamente.';
      
      if (result.emailUpdated) {
        successMessage += ' Por favor revisa tu bandeja de entrada en el nuevo correo para confirmarlo.';
      }

      setSuccess(successMessage);
      
      // Clear password fields
      setFormData(prev => ({
        ...prev,
        current_password: '',
        new_password: '',
        confirm_password: ''
      }));

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-wc-card border border-wc-border rounded-2xl p-6 sm:p-8 shadow-xl">
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-950/30 border border-red-900/50 flex items-start gap-3 animate-fade-in">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-200">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 rounded-xl bg-green-950/30 border border-green-900/50 flex items-start gap-3 animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
          <p className="text-sm text-green-200">{success}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        
        {/* Datos Personales */}
        <div className="space-y-5">
          <h3 className="text-lg font-sports font-bold text-wc-gold tracking-wider uppercase border-b border-wc-border/50 pb-2">
            Datos Personales
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Nombre Completo</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-4 w-4 text-slate-500" />
                </div>
                <input
                  type="text"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleChange}
                  className="w-full bg-slate-900/50 border border-slate-700/50 text-white rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:border-wc-gold focus:ring-1 focus:ring-wc-gold transition-colors text-sm"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Teléfono / WhatsApp</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Phone className="h-4 w-4 text-slate-500" />
                </div>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+58 412 1234567"
                  className="w-full bg-slate-900/50 border border-slate-700/50 text-white rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:border-wc-gold focus:ring-1 focus:ring-wc-gold transition-colors text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Fecha de Nacimiento</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Calendar className="h-4 w-4 text-slate-500" />
                </div>
                <input
                  type="date"
                  name="birth_date"
                  value={formData.birth_date}
                  onChange={handleChange}
                  className="w-full bg-slate-900/50 border border-slate-700/50 text-slate-500 rounded-xl pl-10 pr-4 py-2.5 cursor-not-allowed text-sm [color-scheme:dark]"
                  disabled
                  readOnly
                />
              </div>
            </div>
          </div>
        </div>

        {/* Credenciales */}
        <div className="space-y-5 pt-6 mt-6 border-t border-wc-border/50">
          <h3 className="text-lg font-sports font-bold text-wc-gold tracking-wider uppercase pb-2">
            Credenciales de Acceso
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Correo Electrónico</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-slate-500" />
                </div>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full bg-slate-900/50 border border-slate-700/50 text-white rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:border-wc-gold focus:ring-1 focus:ring-wc-gold transition-colors text-sm"
                  required
                />
              </div>
              <p className="text-xs text-slate-400 mt-1.5">Si cambias el correo, deberás confirmar la nueva dirección.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 pt-6 mt-6">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Contraseña Actual</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-slate-500" />
                </div>
                <input
                  type="password"
                  name="current_password"
                  value={formData.current_password}
                  onChange={handleChange}
                  placeholder="Requerida para cambios"
                  className="w-full bg-slate-900/50 border border-slate-700/50 text-white rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:border-wc-gold focus:ring-1 focus:ring-wc-gold transition-colors text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Nueva Contraseña</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-slate-500" />
                </div>
                <input
                  type="password"
                  name="new_password"
                  value={formData.new_password}
                  onChange={handleChange}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full bg-slate-900/50 border border-slate-700/50 text-white rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:border-wc-gold focus:ring-1 focus:ring-wc-gold transition-colors text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Confirmar Contraseña</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-slate-500" />
                </div>
                <input
                  type="password"
                  name="confirm_password"
                  value={formData.confirm_password}
                  onChange={handleChange}
                  placeholder="Repite la contraseña"
                  className="w-full bg-slate-900/50 border border-slate-700/50 text-white rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:border-wc-gold focus:ring-1 focus:ring-wc-gold transition-colors text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-wc-border/50 flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-wc-gold to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-slate-950 rounded-xl text-sm font-extrabold transition-all shadow-lg shadow-wc-gold/10 hover:shadow-wc-gold/25 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin"></div>
            ) : (
              <>
                <Save className="w-4.5 h-4.5" />
                <span>Guardar Cambios</span>
              </>
            )}
          </button>
        </div>

      </form>
    </div>
  );
}
