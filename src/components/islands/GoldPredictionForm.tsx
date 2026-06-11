import React, { useState, useEffect } from 'react';
import { showAlert } from '../../utils/alerts';
import { Award, Lock, Save, Loader2, Info, CheckCircle, AlertTriangle, ChevronDown } from 'lucide-react';

interface Entry {
  id: number;
  display_name: string;
  entry_number: number;
  predicted_champion: string | null;
  predicted_champion_goals: number | null;
  predicted_final_goals: number | null;
}

interface GoldPredictionFormProps {
  userEntries: Entry[];
  isLocked: boolean;
  firstMatchTimeStr: string;
}

const TEAMS = [
  "Alemania", "Argelia", "Argentina", "Arabia Saudita", "Australia", "Austria",
  "Bélgica", "Bosnia y Herzegovina", "Brasil", "Canadá", "Cabo Verde", "Chequia",
  "Colombia", "Corea del Sur", "Costa de Marfil", "Croacia", "Curazao", "Ecuador",
  "Egipto", "Escocia", "España", "Estados Unidos", "Francia", "Ghana", "Haití",
  "Inglaterra", "Irak", "Irán", "Japón", "Jordania", "Marruecos",
  "México", "Noruega", "Nueva Zelanda", "Países Bajos", "Panamá", "Paraguay",
  "Portugal", "Qatar", "RD Congo", "Senegal", "Sudáfrica", "Suecia",
  "Suiza", "Túnez", "Turquía", "Uruguay", "Uzbekistán"
].sort((a, b) => a.localeCompare(b, 'es'));

export default function GoldPredictionForm({ userEntries, isLocked, firstMatchTimeStr }: GoldPredictionFormProps) {
  // Inicializar con el primer cupo
  const [selectedEntryId, setSelectedEntryId] = useState<number>(userEntries[0]?.id || 0);
  const [predictedChampion, setPredictedChampion] = useState<string>('');
  const [predictedChampionGoals, setPredictedChampionGoals] = useState<string>('');
  const [predictedFinalGoals, setPredictedFinalGoals] = useState<string>('');
  
  const [saving, setSaving] = useState<boolean>(false);
  const [hasChanges, setHasChanges] = useState<boolean>(false);

  // Obtener cupo seleccionado
  const currentEntry = userEntries.find(e => e.id === selectedEntryId);

  // Cargar datos del cupo actual al cambiar de cupo
  useEffect(() => {
    if (currentEntry) {
      const goalsChamp = currentEntry.predicted_champion_goals !== null && currentEntry.predicted_champion_goals !== undefined 
        ? String(currentEntry.predicted_champion_goals) 
        : '';
      const goalsFinal = currentEntry.predicted_final_goals !== null && currentEntry.predicted_final_goals !== undefined 
        ? String(currentEntry.predicted_final_goals) 
        : '';
      setPredictedChampion(currentEntry.predicted_champion || '');
      setPredictedChampionGoals(goalsChamp);
      setPredictedFinalGoals(goalsFinal);
      setHasChanges(false);
    }
  }, [selectedEntryId]);

  // Manejar cambios en el formulario
  const handleChampionChange = (val: string) => {
    setPredictedChampion(val);
    setHasChanges(true);
  };

  const handleGoalsChange = (field: 'champ' | 'final', val: string) => {
    // Solo números
    if (val !== '' && !/^\d+$/.test(val)) return;
    if (field === 'champ') {
      setPredictedChampionGoals(val);
    } else {
      setPredictedFinalGoals(val);
    }
    setHasChanges(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) {
      showAlert.error('Error', 'El tiempo de juego ha comenzado. Las predicciones están bloqueadas.');
      return;
    }

    if (!predictedChampion) {
      showAlert.error('Campo requerido', 'Por favor selecciona la selección que pronosticas como Campeón.');
      return;
    }

    if (predictedChampionGoals === '' || predictedFinalGoals === '') {
      showAlert.error('Campos requeridos', 'Por favor completa la cantidad de goles pronosticada.');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/entries/gold-prediction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entryId: selectedEntryId,
          predictedChampion,
          predictedChampionGoals: parseInt(predictedChampionGoals, 10),
          predictedFinalGoals: parseInt(predictedFinalGoals, 10)
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al guardar el Pronóstico de Oro');
      }

      // Actualizar los datos locales del cupo
      if (currentEntry) {
        currentEntry.predicted_champion = predictedChampion;
        currentEntry.predicted_champion_goals = parseInt(predictedChampionGoals, 10);
        currentEntry.predicted_final_goals = parseInt(predictedFinalGoals, 10);
      }

      setHasChanges(false);
      showAlert.success('¡Guardado!', 'Tu Pronóstico de Oro se ha registrado con éxito.');
    } catch (err: any) {
      showAlert.error('Error', err.message || 'Ocurrió un error inesperado.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      
      {/* Alerta de bloqueo/tiempo */}
      {isLocked ? (
        <div className="disclaimer-box p-4 rounded-2xl flex items-start gap-3 text-xs sm:text-sm font-medium">
          <Lock className="w-6 h-6 shrink-0 mt-0.5" strokeWidth={2.5} />
          <div>
            <p className="font-bold">Pronóstico Cerrado</p>
            <p className="mt-0.5 text-slate-300">
              El mundial ha comenzado (o faltan menos de 30 minutos para el primer partido). Las predicciones de desempate se encuentran estrictamente bloqueadas y no admiten más modificaciones.
            </p>
          </div>
        </div>
      ) : (
        <div className="gold-banner p-5 rounded-2xl flex items-start gap-3.5 text-xs sm:text-sm">
          <Info className="w-6 h-6 shrink-0 mt-0.5 text-wc-gold" strokeWidth={2.5} />
          <div>
            <h4 className="font-bold font-sports uppercase tracking-wider text-sm">Criterio de Desempate Crucial</h4>
            <p className="mt-1 leading-relaxed text-slate-350">
              El <strong className="font-bold">Pronóstico de Oro</strong> sirve para decidir el primer puesto de la clasificación en caso de que haya empate de puntos al final de la Copa del Mundo.{' '}
              <strong className="font-bold">¡Es obligatorio llenarlo antes de comenzar el torneo para asegurar un único ganador!</strong>
            </p>
          </div>
        </div>
      )}

      {/* Selector de Cupo (si tiene múltiples) */}
      {userEntries.length > 1 && (
        <div className="p-4 bg-wc-card border border-wc-border rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 backdrop-blur-md">
          <label className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-300 font-sports">
            Selecciona el cupo a editar:
          </label>
          <select
            value={selectedEntryId}
            onChange={(e) => setSelectedEntryId(Number(e.target.value))}
            className="p-2.5 px-4 rounded-xl bg-wc-dark text-white border border-wc-border focus:outline-none focus:ring-2 focus:ring-wc-gold/50 transition-all font-sans font-semibold text-sm max-w-xs w-full cursor-pointer"
          >
            {userEntries.map(e => (
              <option key={e.id} value={e.id}>
                {e.display_name} (Cupo #{e.entry_number})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Formulario Principal */}
      <form onSubmit={handleSave} className="pt-5 pb-6 px-5 sm:px-6 bg-wc-card border border-wc-border rounded-3xl space-y-6 shadow-2xl relative overflow-hidden backdrop-blur-md">
        
        {/* Glow de fondo */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-wc-gold/5 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="border-b border-wc-border pb-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-start gap-2.5">
            <Award className="w-6 h-6 text-wc-gold shrink-0 mt-0.5 sm:mt-0 animate-pulse" strokeWidth={2.5} />
            <h3 className="text-base sm:text-lg font-bold text-white font-sports uppercase tracking-wider leading-snug">
              Pronóstico de Oro para:{' '}
              <span className="text-wc-gold block sm:inline font-sans font-bold">
                {currentEntry?.display_name}
              </span>
            </h3>
          </div>
          <div className="flex items-center sm:justify-end">
            {!isLocked && (
              currentEntry?.predicted_champion ? (
                <span className="flex items-center gap-1.5 text-xs text-wc-green font-bold uppercase font-sports bg-wc-green/10 border border-wc-green/20 px-3 py-1 rounded-full">
                  <CheckCircle className="w-4 h-4 shrink-0" /> Guardado
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs text-amber-500 font-bold uppercase font-sports bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full animate-pulse">
                  <AlertTriangle className="w-4 h-4 shrink-0" /> Pendiente
                </span>
              )
            )}
          </div>
        </div>

        {/* Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* 1. Campeón */}
          <div className="space-y-2.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 font-sports">
              1. Selección Campeona:
            </label>
            <div className="relative">
              <select
                value={predictedChampion}
                onChange={(e) => handleChampionChange(e.target.value)}
                disabled={isLocked}
                className={`w-full p-3 pr-10 rounded-xl bg-wc-dark text-white border transition-all font-sans font-semibold text-sm cursor-pointer appearance-none ${
                  isLocked 
                    ? 'border-wc-border text-slate-500 cursor-not-allowed bg-wc-dark/30'
                    : 'border-wc-border focus:outline-none focus:ring-2 focus:ring-wc-gold/50 focus:border-wc-gold'
                }`}
              >
                <option value="">-- Elige un país --</option>
                {TEAMS.map(team => (
                  <option key={team} value={team}>{team}</option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-400">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed mt-1.5 font-medium">
              Selecciona el país que crees que ganará la Copa del Mundo 2026.
            </p>
          </div>

          {/* 2. Goles del Campeón */}
          <div className="space-y-2.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 font-sports">
              2. Goles del Campeón:
            </label>
            <input
              type="text"
              maxLength={3}
              value={predictedChampionGoals}
              onChange={(e) => handleGoalsChange('champ', e.target.value)}
              disabled={isLocked}
              placeholder="Ej: 15"
              className={`w-full p-3 rounded-xl bg-wc-dark text-white text-center border font-mono font-bold text-base transition-all ${
                isLocked 
                  ? 'border-wc-border text-slate-500 cursor-not-allowed bg-wc-dark/30'
                  : 'border-wc-border focus:outline-none focus:ring-2 focus:ring-wc-gold/50 focus:border-wc-gold'
              }`}
            />
            <p className="text-xs text-slate-400 leading-relaxed mt-1.5 font-medium">
              Goles anotados por este campeón en todo el torneo (incluyendo tiempo extra, excluyendo penales).
            </p>
          </div>

          {/* 3. Goles en la Final */}
          <div className="space-y-2.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 font-sports">
              3. Goles en la Final:
            </label>
            <input
              type="text"
              maxLength={2}
              value={predictedFinalGoals}
              onChange={(e) => handleGoalsChange('final', e.target.value)}
              disabled={isLocked}
              placeholder="Ej: 3"
              className={`w-full p-3 rounded-xl bg-wc-dark text-white text-center border font-mono font-bold text-base transition-all ${
                isLocked 
                  ? 'border-wc-border text-slate-500 cursor-not-allowed bg-wc-dark/30'
                  : 'border-wc-border focus:outline-none focus:ring-2 focus:ring-wc-gold/50 focus:border-wc-gold'
              }`}
            />
            <p className="text-xs text-slate-400 leading-relaxed mt-1.5 font-medium">
              Goles totales anotados en la Gran Final por ambos equipos (tiempo extra incluido, sin penales).
            </p>
          </div>

        </div>

        {/* Botón guardar */}
        {!isLocked && (
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={!hasChanges || saving}
              className={`px-6 py-2.5 rounded-xl font-bold font-sports tracking-wider uppercase text-xs flex items-center justify-center gap-1.5 transition-all duration-300 border ${
                saving
                  ? 'bg-wc-dark text-slate-500 border-wc-border cursor-wait'
                  : hasChanges
                  ? 'bg-gradient-to-r from-wc-gold to-amber-500 text-slate-950 border-amber-400/40 shadow-lg shadow-wc-gold/10 hover:shadow-wc-gold/20 hover:-translate-y-0.5'
                  : 'bg-wc-dark text-slate-500 border-wc-border cursor-not-allowed'
              }`}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-500" strokeWidth={2.5} />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 text-slate-950" strokeWidth={2.5} />
                  <span>Guardar Pronóstico de Oro</span>
                </>
              )}
            </button>
          </div>
        )}

      </form>

    </div>
  );
}
