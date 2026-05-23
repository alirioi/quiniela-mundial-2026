import React, { useState, useEffect } from 'react';
import { Search, Users, Phone, Mail, FileText, CheckCircle, Clock, XCircle, ChevronDown, ChevronUp, Trophy } from 'lucide-react';

interface Prediction {
  match_id: number;
  home_team: string;
  away_team: string;
  predicted_home: number;
  predicted_away: number;
  home_score: number | null;
  away_score: number | null;
  points_earned: number;
  match_time: string;
}

interface Entry {
  id: number;
  entry_number: number;
  display_name: string;
  status: string;
  binance_pay_user: string | null;
  total_points: number;
  signedUrl: string | null;
  predictions_count: number;
  predictions: Prediction[];
}

interface Participant {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  entries: Entry[];
  total_entries_count: number;
}

export default function AdminUserList() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [totalMatches, setTotalMatches] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [expandedEntry, setExpandedEntry] = useState<number | null>(null);

  const fetchData = async () => {
    try {
      const response = await fetch('/api/admin/participants');
      if (!response.ok) {
        throw new Error('Error al cargar la lista de participantes');
      }
      const data = await response.json();
      setParticipants(data.participants || []);
      setTotalMatches(data.totalMatches || 0);
    } catch (err: any) {
      setError(err.message || 'Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const toggleUser = (userId: string) => {
    if (expandedUser === userId) {
      setExpandedUser(null);
      setExpandedEntry(null);
    } else {
      setExpandedUser(userId);
      setExpandedEntry(null);
    }
  };

  const toggleEntry = (entryId: number) => {
    setExpandedEntry(expandedEntry === entryId ? null : entryId);
  };

  // Filtrar participantes según la búsqueda
  const filteredParticipants = participants.filter((p) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;

    const matchesName = p.full_name.toLowerCase().includes(query);
    const matchesEmail = p.email.toLowerCase().includes(query);
    const matchesPhone = p.phone.toLowerCase().includes(query);
    const matchesCupo = p.entries.some((e) => e.display_name.toLowerCase().includes(query));

    return matchesName || matchesEmail || matchesPhone || matchesCupo;
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-4 bg-wc-card/25 rounded-2xl border border-wc-border">
        <div className="w-8 h-8 border-3 border-wc-gold border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-450 text-xs font-sports uppercase tracking-wider">Cargando participantes...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-5 rounded-2xl bg-wc-red/10 border border-wc-red/20 text-center text-xs text-red-200 flex items-center justify-center gap-2">
        <XCircle className="w-5 h-5 text-wc-red" strokeWidth={2.5} />
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Buscador y estadísticas rápidas */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-wc-card/50 border border-wc-border backdrop-blur-sm">
        <div className="relative flex-grow max-w-md">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
            <Search className="w-4.5 h-4.5" />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-wc-dark border border-wc-border rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-wc-gold/80 transition-all"
            placeholder="Buscar por nombre, email, teléfono o nombre de cupo..."
          />
        </div>
        <div className="flex items-center gap-2.5 text-slate-350 text-xs font-sports tracking-wider uppercase">
          <Users className="w-4.5 h-4.5 text-wc-gold" />
          <span>Total participantes: <strong className="text-white text-sm">{participants.length}</strong></span>
        </div>
      </div>

      {filteredParticipants.length === 0 ? (
        <div className="p-12 text-center bg-wc-card/30 border border-wc-border text-slate-400 text-xs flex flex-col items-center justify-center gap-3 rounded-2xl">
          <Users className="w-8 h-8 text-slate-650" />
          <p>No se encontraron participantes que coincidan con la búsqueda.</p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredParticipants.map((user) => {
            const isUserExpanded = expandedUser === user.id;
            
            // Determinar estado de completitud total del participante
            const hasEntries = user.entries.length > 0;
            const allApproved = hasEntries && user.entries.every(e => e.status === 'approved');
            const anyPending = hasEntries && user.entries.some(e => e.status === 'pending');
            const totalCupos = user.entries.length;

            return (
              <div
                key={user.id}
                className={`rounded-2xl border transition-all duration-300 ${
                  isUserExpanded
                    ? 'border-wc-gold/40 bg-wc-card/90 shadow-lg shadow-wc-gold/5'
                    : 'border-wc-border bg-wc-card/50 hover:bg-wc-card/75'
                }`}
              >
                {/* Cabecera del usuario */}
                <div
                  onClick={() => toggleUser(user.id)}
                  className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer select-none"
                >
                  <div className="space-y-1">
                    <h3 className="text-sm sm:text-base font-bold text-white tracking-wide">
                      {user.full_name}
                    </h3>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-450">
                      <span className="flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5" /> {user.email}
                      </span>
                      <span className="flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5" /> {user.phone}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-center">
                    <span className="px-2 py-0.5 rounded-lg bg-slate-800 text-[10px] sm:text-xs font-bold font-sports uppercase tracking-wider text-slate-350 border border-slate-700/60">
                      {totalCupos} {totalCupos === 1 ? 'Cupo' : 'Cupos'}
                    </span>
                    {totalCupos > 0 && (
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] sm:text-xs font-bold font-sports uppercase tracking-wider border ${
                        allApproved
                          ? 'bg-wc-green/10 text-wc-green border-wc-green/20'
                          : anyPending
                          ? 'bg-wc-gold/10 text-wc-gold border-wc-gold/20'
                          : 'bg-wc-red/10 text-wc-red border-wc-red/20'
                      }`}>
                        {allApproved ? 'Aprobado' : anyPending ? 'Pendiente' : 'Incompleto'}
                      </span>
                    )}
                    {isUserExpanded ? <ChevronUp className="w-4 h-4 text-slate-450" /> : <ChevronDown className="w-4 h-4 text-slate-450" />}
                  </div>
                </div>

                {/* Contenido expandible del usuario */}
                {isUserExpanded && (
                  <div className="border-t border-wc-border/60 px-5 py-5 bg-wc-dark/30 rounded-b-2xl space-y-4">
                    {user.entries.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">Este usuario no tiene cupos registrados aún.</p>
                    ) : (
                      <div className="space-y-4">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-sports flex items-center gap-1.5 border-b border-wc-border/30 pb-2">
                          <Users className="w-4 h-4 text-wc-gold" />
                          Resumen de Cupos Asociados
                        </h4>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {user.entries.map((entry) => {
                            const isEntryExpanded = expandedEntry === entry.id;
                            const isPredictionsComplete = entry.predictions_count === totalMatches;

                            return (
                              <div
                                key={entry.id}
                                className="p-4 rounded-xl border border-wc-border bg-wc-card/80 space-y-3 shadow-inner"
                              >
                                <div className="flex justify-between items-start gap-2">
                                  <div>
                                    <h5 className="text-xs font-bold text-slate-200 uppercase tracking-wide">
                                      Cupo #{entry.entry_number}: <span className="text-wc-gold font-bold">{entry.display_name}</span>
                                    </h5>
                                    <span className="text-[10px] text-slate-500 font-mono">ID: {entry.id}</span>
                                  </div>
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-sports uppercase tracking-wider border ${
                                    entry.status === 'approved'
                                      ? 'bg-wc-green/10 text-wc-green border-wc-green/15'
                                      : entry.status === 'pending'
                                      ? 'bg-wc-gold/10 text-wc-gold border-wc-gold/15'
                                      : 'bg-wc-red/10 text-wc-red border-wc-red/15'
                                  }`}>
                                    {entry.status === 'approved' ? 'Pagado' : entry.status === 'pending' ? 'Verificar' : 'Rechazado'}
                                  </span>
                                </div>

                                <div className="h-px bg-wc-border/40"></div>

                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  <div className="space-y-0.5">
                                    <span className="text-slate-500 block uppercase tracking-wider text-[9px] font-sports">Binance Pay User:</span>
                                    <span className="text-slate-350 font-medium font-mono truncate block" title={entry.binance_pay_user || 'N/A'}>
                                      {entry.binance_pay_user || 'N/A'}
                                    </span>
                                  </div>
                                  <div className="space-y-0.5">
                                    <span className="text-slate-500 block uppercase tracking-wider text-[9px] font-sports">Puntaje Actual:</span>
                                    <span className="text-slate-200 font-bold font-sports text-sm">{entry.total_points} Puntos</span>
                                  </div>
                                </div>

                                <div className="flex items-center justify-between text-xs pt-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className={`w-2 h-2 rounded-full ${isPredictionsComplete ? 'bg-wc-green animate-pulse' : 'bg-amber-500 animate-pulse'}`}></span>
                                    <span className="text-slate-400">
                                      Pronósticos: <strong className="text-slate-200">{entry.predictions_count} / {totalMatches}</strong>
                                    </span>
                                  </div>

                                  <div className="flex gap-2">
                                    {entry.signedUrl && (
                                      <a
                                        href={entry.signedUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-1.5 rounded-lg bg-wc-dark hover:bg-slate-800 text-slate-400 hover:text-white border border-wc-border transition-all"
                                        title="Ver Captura de Pago"
                                      >
                                        <FileText className="w-4 h-4" />
                                      </a>
                                    )}
                                    {entry.predictions_count > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => toggleEntry(entry.id)}
                                        className="px-2.5 py-1 text-[10px] font-sports font-bold tracking-wider rounded-lg border border-wc-border hover:border-wc-gold text-slate-300 hover:text-wc-gold bg-wc-dark/40 transition-all flex items-center gap-1"
                                      >
                                        <span>{isEntryExpanded ? 'Ocultar' : 'Ver'} Pronósticos</span>
                                        {isEntryExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {/* Pronósticos detallados del cupo */}
                                {isEntryExpanded && (
                                  <div className="pt-3 border-t border-wc-border/30 mt-2 space-y-2 max-h-60 overflow-y-auto pr-1">
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-450 font-sports">Predicciones Guardadas</div>
                                    <div className="space-y-1.5">
                                      {entry.predictions.map((pred) => {
                                        const isChecked = pred.home_score !== null && pred.away_score !== null;
                                        
                                        return (
                                          <div key={pred.match_id} className="flex items-center justify-between text-[11px] bg-wc-dark/70 rounded-lg p-2 border border-wc-border/40 font-mono">
                                            <div className="truncate max-w-[140px] text-slate-300 font-sans" title={`${pred.home_team} vs ${pred.away_team}`}>
                                              {pred.home_team} vs {pred.away_team}
                                            </div>
                                            <div className="flex items-center gap-3">
                                              <div className="flex items-center gap-1 bg-wc-card px-2 py-0.5 rounded border border-wc-border/50">
                                                <span className="text-slate-500 uppercase tracking-wider text-[8px] font-sans">PRON:</span>
                                                <span className="text-slate-100 font-bold">{pred.predicted_home}-{pred.predicted_away}</span>
                                              </div>
                                              {isChecked && (
                                                <div className="flex items-center gap-1 text-[10px] text-slate-400 font-sans">
                                                  <span>({pred.home_score}-{pred.away_score})</span>
                                                  <span className={`ml-1.5 px-1 rounded-sm text-[9px] font-bold ${
                                                    pred.points_earned === 3 ? 'bg-wc-green/10 text-wc-green border border-wc-green/15' : pred.points_earned === 1 ? 'bg-wc-blue/10 text-wc-blue border border-wc-blue/15' : 'bg-slate-800 text-slate-500'
                                                  }`}>
                                                    +{pred.points_earned}pt
                                                  </span>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
