import React, { useState, useEffect } from 'react';
import { Search, Users, Phone, Mail, FileText, CheckCircle, Clock, XCircle, ChevronDown, ChevronUp, Trophy, Trash2, Shield, AlertTriangle } from 'lucide-react';
import Swal from 'sweetalert2';
import { isPlaceholderName } from '../../utils/knockout';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { ErrorState } from '../ui/ErrorState';
import { StatusBadge } from '../ui/StatusBadge';

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
  predicted_champion?: string | null;
  predicted_champion_goals?: number | null;
  predicted_final_goals?: number | null;
}

interface Participant {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  role: string;
  entries: Entry[];
  total_entries_count: number;
}

interface MatchBasic {
  id: number;
  home_team: string;
  away_team: string;
  match_time: string;
  group_name: string | null;
}

export default function AdminUserList() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [totalMatches, setTotalMatches] = useState(0);
  const [firstMatchId, setFirstMatchId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [expandedEntry, setExpandedEntry] = useState<number | null>(null);
  const [isDeletingUserId, setIsDeletingUserId] = useState<string | null>(null);
  const [allMatches, setAllMatches] = useState<MatchBasic[]>([]);
  const [showMissingOnly, setShowMissingOnly] = useState<Record<number, boolean>>({});

  const fetchData = async () => {
    try {
      const response = await fetch('/api/admin/participants');
      if (!response.ok) {
        throw new Error('Error al cargar la lista de participantes');
      }
      const data = await response.json();
      setParticipants(data.participants || []);
      setTotalMatches(data.totalMatches || 0);
      setFirstMatchId(data.firstMatchId || null);
      setAllMatches(data.allMatches || []);
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

  const toggleMissingView = (entryId: number) => {
    setShowMissingOnly(prev => ({ ...prev, [entryId]: !prev[entryId] }));
  };

  const handleDeleteUser = async (e: React.MouseEvent, userId: string, userName: string) => {
    e.stopPropagation(); // Evitar expandir/colapsar al hacer clic en borrar

    const result = await Swal.fire({
      title: '¿Estás seguro?',
      text: `¿Deseas eliminar permanentemente a ${userName}? Esta acción borrará su cuenta, todos sus cupos, predicciones y comprobantes de pago. NO se puede deshacer.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444', // wc-red
      cancelButtonColor: '#334155', // slate-700
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      background: '#0f172a', // wc-dark
      color: '#f8fafc' // text-slate-50
    });

    if (result.isConfirmed) {
      setIsDeletingUserId(userId);
      try {
        const response = await fetch(`/api/admin/participants/${userId}`, {
          method: 'DELETE',
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || 'Error al eliminar el participante');
        }

        // Remover el usuario de la lista local
        setParticipants(prev => prev.filter(p => p.id !== userId));
        if (expandedUser === userId) {
          setExpandedUser(null);
        }
        
        Swal.fire({
          title: '¡Eliminado!',
          text: 'Participante eliminado correctamente.',
          icon: 'success',
          background: '#0f172a',
          color: '#f8fafc',
          confirmButtonColor: '#d4af37' // wc-gold
        });
      } catch (err: any) {
        Swal.fire({
          title: 'Error',
          text: err.message || 'Ocurrió un error al intentar eliminar el participante.',
          icon: 'error',
          background: '#0f172a',
          color: '#f8fafc',
          confirmButtonColor: '#ef4444' // wc-red
        });
      } finally {
        setIsDeletingUserId(null);
      }
    }
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
    return <LoadingSpinner message="Cargando participantes..." />;
  }

  if (error) {
    return (
      <ErrorState 
        message={error.message || 'Error de conexión'}
        onRetry={fetchData}
      />
    );
  }

  const renderUserCard = (user: Participant) => {
    const isUserExpanded = expandedUser === user.id;
    const totalCupos = user.entries.length;
    const allApproved = user.entries.length > 0 && user.entries.every((e) => e.status === 'approved');
    const anyPending = user.entries.some((e) => e.status === 'pending');
    
    // Determinar si le falta el pronóstico de oro o el del primer partido (en cualquiera de sus cupos aprobados)
    const hasGold = user.entries.length > 0 && user.entries.every(e => !!e.predicted_champion);
    const hasFirstMatch = firstMatchId
      ? user.entries.length > 0 && user.entries.every(e => e.predictions.some(p => p.match_id === firstMatchId))
      : true;
    const hasPendingCrucial = (!hasGold || !hasFirstMatch) && user.role !== 'admin';

    return (
      <div
        key={user.id}
        className={`rounded-2xl border transition-all duration-300 ${
          isUserExpanded
            ? 'border-wc-gold/40 bg-wc-card/90 shadow-lg shadow-wc-gold/5'
            : hasPendingCrucial
            ? 'border-amber-500/40 bg-amber-500/[0.02] hover:bg-amber-500/[0.04] shadow-md shadow-amber-500/[0.01]'
            : 'border-wc-border bg-wc-card/50 hover:bg-wc-card/75'
        }`}
      >
        {/* Cabecera del usuario */}
        <div
          onClick={() => toggleUser(user.id)}
          className="px-5 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer select-none"
        >
          <div className="space-y-2 flex-grow">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-bold text-white tracking-wide">
                {user.full_name}
              </h3>
              <div className="flex items-center gap-1.5 flex-wrap">
                {user.role === 'admin' && (
                  <span className="px-1.5 py-0.5 rounded-md bg-wc-red/15 text-wc-red text-[9px] font-sports font-bold tracking-wider uppercase border border-wc-red/20 flex items-center gap-1">
                    <Shield className="w-2.5 h-2.5" /> Admin
                  </span>
                )}
                {hasPendingCrucial && (
                  <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-500 text-[9px] font-sports font-bold tracking-wider uppercase border border-amber-500/20 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" strokeWidth={2.5} />
                    <span>Pendiente (Oro/1er Partido)</span>
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-450">
              <span className="flex items-center gap-1">
                <Mail className="w-3.5 h-3.5" /> {user.email}
              </span>
              <span className="flex items-center gap-1">
                <Phone className="w-3.5 h-3.5" /> {user.phone}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between md:justify-end gap-3 pt-3 md:pt-0 border-t border-wc-border/40 md:border-0">
            <div className="flex items-center gap-2">
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
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => handleDeleteUser(e, user.id, user.full_name)}
                disabled={isDeletingUserId === user.id}
                className="p-1.5 rounded-lg text-slate-400 hover:text-wc-red hover:bg-wc-red/10 transition-all focus:outline-none"
                title="Eliminar participante"
              >
                {isDeletingUserId === user.id ? (
                  <div className="w-4 h-4 border-2 border-wc-red border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </button>
              {isUserExpanded ? <ChevronUp className="w-4 h-4 text-slate-450" /> : <ChevronDown className="w-4 h-4 text-slate-450" />}
            </div>
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
                            <span className="text-[10px] text-slate-550 font-mono">ID: {entry.id}</span>
                          </div>
                          <StatusBadge status={entry.status} />
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

                        <div className="h-px bg-wc-border/40"></div>

                        <div className="text-xs space-y-1">
                          <span className="text-slate-500 block uppercase tracking-wider text-[9px] font-sports">Pronóstico de Oro:</span>
                          {entry.predicted_champion ? (
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-slate-300 font-medium">
                              <span className="text-wc-gold font-bold">{entry.predicted_champion}</span>
                              <span className="text-slate-500">|</span>
                              <span>Goles Camp: <strong className="text-white">{entry.predicted_champion_goals}</strong></span>
                              <span className="text-slate-500">|</span>
                              <span>Goles Final: <strong className="text-white">{entry.predicted_final_goals}</strong></span>
                            </div>
                          ) : (
                            <span className="text-amber-500 font-sports font-bold uppercase text-[10px] tracking-wide animate-pulse-subtle">
                              Pendiente
                            </span>
                          )}
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
                            <button
                              type="button"
                              onClick={() => toggleEntry(entry.id)}
                              className="px-2.5 py-1 text-[10px] font-sports font-bold tracking-wider rounded-lg border border-wc-border hover:border-wc-gold text-slate-300 hover:text-wc-gold bg-wc-dark/40 transition-all flex items-center gap-1"
                            >
                              <span>{isEntryExpanded ? 'Ocultar' : 'Ver'} Detalle</span>
                              {isEntryExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>

                        {/* Pronósticos detallados del cupo */}
                        {isEntryExpanded && (
                          <div className="pt-3 border-t border-wc-border/30 mt-2 space-y-2 max-h-80 overflow-y-auto pr-1">
                            <div className="flex justify-between items-center">
                              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-450 font-sports">
                                {showMissingOnly[entry.id] ? 'Partidos Sin Pronóstico' : 'Predicciones Guardadas'}
                              </div>
                              <button
                                type="button"
                                onClick={() => toggleMissingView(entry.id)}
                                className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded transition-colors"
                              >
                                {showMissingOnly[entry.id] ? 'Ver Llenos' : 'Ver Faltantes'}
                              </button>
                            </div>
                            <div className="space-y-1.5">
                              {!showMissingOnly[entry.id] && entry.predictions.map((pred) => {
                                const isChecked = pred.home_score !== null && pred.away_score !== null;
                                const homeName = isPlaceholderName(pred.home_team) ? 'Por definir' : pred.home_team;
                                const awayName = isPlaceholderName(pred.away_team) ? 'Por definir' : pred.away_team;
                                
                                return (
                                  <div key={pred.match_id} className="flex items-center justify-between text-[11px] bg-wc-dark/70 rounded-lg p-2 border border-wc-border/40 font-mono">
                                    <div className="truncate max-w-[140px] text-slate-300 font-sans" title={`${homeName} vs ${awayName}`}>
                                      {homeName} vs {awayName}
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

                              {showMissingOnly[entry.id] && (() => {
                                const predictedMatchIds = new Set(entry.predictions.map(p => p.match_id));
                                const missingMatches = allMatches.filter(m => !predictedMatchIds.has(m.id));

                                if (missingMatches.length === 0) {
                                  return (
                                    <div className="text-center text-xs text-slate-500 py-4 italic">
                                      Este cupo tiene todos los pronósticos completados.
                                    </div>
                                  );
                                }

                                return missingMatches.map(m => {
                                  const matchDate = new Date(m.match_time);
                                  const homeName = isPlaceholderName(m.home_team) ? 'Por definir' : m.home_team;
                                  const awayName = isPlaceholderName(m.away_team) ? 'Por definir' : m.away_team;
                                  return (
                                    <div key={m.id} className="flex items-center justify-between text-[11px] bg-amber-500/10 rounded-lg p-2 border border-amber-500/20 font-mono">
                                      <div className="flex-1 truncate text-amber-500 font-sans" title={`${homeName} vs ${awayName}`}>
                                        <span className="font-bold">{homeName} vs {awayName}</span>
                                      </div>
                                      <div className="text-[9px] text-slate-400 font-sans whitespace-nowrap ml-2 text-right">
                                        {m.group_name && <span className="mr-2 text-amber-500/70">{m.group_name}</span>}
                                        {matchDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                                      </div>
                                    </div>
                                  );
                                });
                              })()}
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
  };

  const realParticipants = filteredParticipants.filter(p => p.role !== 'admin');
  const adminParticipants = filteredParticipants.filter(p => p.role === 'admin');

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
          <span>Total participantes: <strong className="text-white text-sm">{realParticipants.length}</strong></span>
        </div>
      </div>

      {filteredParticipants.length === 0 ? (
        <div className="p-12 text-center bg-wc-card/30 border border-wc-border text-slate-400 text-xs flex flex-col items-center justify-center gap-3 rounded-2xl">
          <Users className="w-8 h-8 text-slate-650" />
          <p>No se encontraron participantes que coincidan con la búsqueda.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {realParticipants.length > 0 && (
            <div className="space-y-3.5">
              {realParticipants.map((user) => renderUserCard(user))}
            </div>
          )}

          {adminParticipants.length > 0 && (
            <div className="mt-8 pt-6 border-t border-wc-border/50">
              <div className="flex items-center gap-2 mb-4 px-1">
                <Shield className="w-4 h-4 text-wc-red/80" />
                <h3 className="text-xs font-bold font-sports uppercase tracking-wider text-slate-400">
                  Cuentas y Cupos de Administración (Pruebas)
                </h3>
                <span className="text-[10px] text-slate-550 font-medium font-sans">
                  (No suman al total de participantes)
                </span>
              </div>
              <div className="space-y-3.5 opacity-80 hover:opacity-100 transition-opacity duration-200">
                {adminParticipants.map((user) => renderUserCard(user))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
