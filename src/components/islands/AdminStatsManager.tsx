import React, { useState, useEffect } from 'react';
import { Search, Plus, Trash2, Award, Star, ShieldAlert, RefreshCw, X, ChevronDown, Trophy } from 'lucide-react';
import { showAlert } from '../../utils/alerts';
import { getTeamFlagUrl } from '../../utils/flags';

interface Player {
  id: string;
  name: string;
  team: string;
  goals: number;
  assists: number;
  yellow_cards: number;
  red_cards: number;
}

// Lista ordenada de los 48 equipos participantes para sugerencias en el formulario
const TEAMS_LIST = [
  "Alemania", "Argelia", "Argentina", "Arabia Saudita", "Australia", "Austria",
  "Bélgica", "Bosnia y Herzegovina", "Brasil", "Canadá", "Cabo Verde", "Chequia",
  "Colombia", "Corea del Sur", "Costa de Marfil", "Croacia", "Curazao", "Ecuador",
  "Egipto", "Escocia", "España", "Estados Unidos", "Francia", "Ghana", "Haití",
  "Inglaterra", "Irak", "Irán", "Japón", "Jordania", "Marruecos",
  "México", "Noruega", "Nueva Zelanda", "Países Bajos", "Panamá", "Paraguay",
  "Portugal", "Qatar", "RD Congo", "Senegal", "Sudáfrica", "Suecia",
  "Suiza", "Túnez", "Turquía", "Uruguay", "Uzbekistán"
].sort((a, b) => a.localeCompare(b, 'es'));

export default function AdminStatsManager() {
  interface GoldStat {
    team: string;
    count: number;
  }

  const [players, setPlayers] = useState<Player[]>([]);
  const [goldPredictions, setGoldPredictions] = useState<GoldStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTeamFilter, setSelectedTeamFilter] = useState('todos');

  // Form states for creating a new player
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTeam, setNewTeam] = useState('');
  const [newGoals, setNewGoals] = useState(0);
  const [newAssists, setNewAssists] = useState(0);
  const [newYellowCards, setNewYellowCards] = useState(0);
  const [newRedCards, setNewRedCards] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Fetch player statistics from API
  const fetchPlayers = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/player-stats');
      if (!response.ok) {
        throw new Error('Error al cargar las estadísticas de los jugadores');
      }
      const data = await response.json();
      setPlayers(data.players || []);
      setGoldPredictions(data.goldStats || []);
    } catch (err: any) {
      setError(err.message || 'Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlayers();
  }, []);

  // Handle stats increment/decrement
  const handleUpdateStat = async (id: string, field: keyof Player, increment: boolean) => {
    const player = players.find(p => p.id === id);
    if (!player) return;

    let currentValue = Number(player[field]) || 0;
    const newValue = increment ? currentValue + 1 : Math.max(0, currentValue - 1);

    if (currentValue === newValue) return;

    // Actualización optimista local
    setPlayers(prev => prev.map(p => p.id === id ? { ...p, [field]: newValue } : p));

    try {
      const response = await fetch(`/api/admin/player-stats/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: newValue }),
      });

      if (!response.ok) {
        throw new Error('Error al actualizar en el servidor');
      }
    } catch (err: any) {
      // Revertir en caso de error
      setPlayers(prev => prev.map(p => p.id === id ? { ...p, [field]: currentValue } : p));
      showAlert.error('Error', 'No se pudo guardar la actualización: ' + err.message);
    }
  };

  // Handle player creation
  const handleCreatePlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newTeam) {
      showAlert.error('Datos incompletos', 'Por favor ingresa un nombre y selecciona un equipo.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/admin/player-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          team: newTeam,
          goals: newGoals,
          assists: newAssists,
          yellow_cards: newYellowCards,
          red_cards: newRedCards,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al crear el jugador');
      }

      const createdPlayer = await response.json();
      setPlayers(prev => [createdPlayer, ...prev]);
      
      // Reset form & state
      setNewName('');
      setNewTeam('');
      setNewGoals(0);
      setNewAssists(0);
      setNewYellowCards(0);
      setNewRedCards(0);
      setIsAddModalOpen(false);
      
      showAlert.success('Éxito', 'Goleador agregado correctamente');
    } catch (err: any) {
      showAlert.error('Error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle player deletion
  const handleDeletePlayer = async (id: string, name: string) => {
    const confirm = await showAlert.confirm(
      '¿Eliminar jugador?',
      `¿Estás seguro de que deseas eliminar permanentemente a ${name} de las estadísticas del mundial?`
    );

    if (!confirm.isConfirmed) return;

    try {
      const response = await fetch(`/api/admin/player-stats/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Error al eliminar el jugador');
      }

      setPlayers(prev => prev.filter(p => p.id !== id));
      showAlert.success('Eliminado', 'El jugador fue removido de la tabla.');
    } catch (err: any) {
      showAlert.error('Error', err.message);
    }
  };

  // Filter players based on search and selected team
  const filteredPlayers = players.filter(player => {
    const matchesSearch = player.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTeam = selectedTeamFilter === 'todos' || player.team.toLowerCase() === selectedTeamFilter.toLowerCase();
    return matchesSearch && matchesTeam;
  });

  return (
    <div className="space-y-6">
      {/* Header bar with controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-wc-card/50 border border-wc-border backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-4 flex-grow max-w-2xl">
          <div className="relative flex-grow max-w-md">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
              <Search className="w-4.5 h-4.5" />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-wc-dark border border-wc-border rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-wc-gold/80 transition-all"
              placeholder="Buscar goleador por nombre..."
            />
          </div>

          <div className="relative min-w-[200px]">
            <select
              value={selectedTeamFilter}
              onChange={(e) => setSelectedTeamFilter(e.target.value)}
              className="w-full bg-wc-dark border border-wc-border text-slate-300 text-xs rounded-xl pl-3.5 pr-10 py-2.5 appearance-none focus:outline-none focus:border-wc-gold/80 transition-all cursor-pointer font-sports tracking-wider uppercase font-bold"
            >
              <option value="todos">Todas las Selecciones</option>
              {TEAMS_LIST.map(team => (
                <option key={team} value={team}>{team.toUpperCase()}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-450">
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchPlayers}
            className="p-2.5 px-3.5 rounded-xl bg-wc-dark hover:bg-wc-card text-slate-300 hover:text-white border border-wc-border transition-all text-xs font-bold font-sports tracking-wider uppercase flex items-center gap-1.5"
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} strokeWidth={2.5} /> Recargar
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="p-2.5 px-4 rounded-xl bg-gradient-to-r from-wc-gold to-amber-500 text-slate-955 font-bold font-sports tracking-wider uppercase text-xs hover:from-yellow-400 hover:to-amber-400 shadow-md shadow-wc-gold/15 transition-all flex items-center gap-1.5"
          >
            <Plus className="w-4.5 h-4.5" strokeWidth={2.5} /> Agregar Jugador
          </button>
        </div>
      </div>

      {/* Grid Layout: Player Stats (2/3) and Gold Predictions (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Player Stats */}
        <div className="lg:col-span-2 space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-16 space-y-4 bg-wc-card/25 rounded-2xl border border-wc-border">
              <RefreshCw className="w-8 h-8 text-wc-gold animate-spin" strokeWidth={2.5} />
              <p className="text-slate-455 text-xs font-sports uppercase tracking-wider">Cargando goleadores...</p>
            </div>
          ) : error ? (
            <div className="p-5 rounded-2xl bg-wc-red/10 border border-wc-red/20 text-center text-xs text-red-200 flex items-center justify-center gap-2">
              <ShieldAlert className="w-5 h-5 text-wc-red" strokeWidth={2.5} />
              <span>{error}</span>
            </div>
          ) : filteredPlayers.length === 0 ? (
            <div className="p-12 text-center bg-wc-card/30 border border-wc-border text-slate-500 text-sm flex flex-col items-center justify-center space-y-2 rounded-2xl">
              <Award className="w-9 h-9 text-slate-400 mb-1" strokeWidth={2.5} />
              <span className="text-slate-450 font-sports text-xs uppercase tracking-wider">No se encontraron goleadores registrados.</span>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-wc-border bg-wc-card/30 backdrop-blur-md">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-wc-border text-xs uppercase font-bold tracking-wider text-slate-350 bg-wc-dark/50 font-sports">
                    <th className="p-4 sm:p-5">Jugador</th>
                    <th className="p-4 sm:p-5">Selección</th>
                    <th className="p-4 sm:p-5 text-center">Goles</th>
                    <th className="p-4 sm:p-5 text-center">Asistencias</th>
                    <th className="p-4 sm:p-5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-wc-border text-sm">
                  {filteredPlayers.map((player) => {
                    const flagUrl = getTeamFlagUrl(player.team);

                    return (
                      <tr key={player.id} className="hover:bg-wc-card/85 transition-colors">
                        <td className="p-4 sm:p-5 font-bold text-white text-sm">
                          {player.name}
                        </td>
                        <td className="p-4 sm:p-5 text-slate-300">
                          <div className="flex items-center gap-2">
                            {flagUrl ? (
                              <img
                                src={flagUrl}
                                alt={`Bandera de ${player.team}`}
                                className="w-5 h-3.5 object-cover rounded shadow-sm shrink-0 border border-slate-700/50"
                              />
                            ) : (
                              <div className="w-5 h-3.5 bg-slate-800 rounded shrink-0 border border-slate-700/50"></div>
                            )}
                            <span className="font-medium text-xs sm:text-sm">{player.team}</span>
                          </div>
                        </td>
                        
                        {/* Goles Control */}
                        <td className="p-4 sm:p-5 text-center">
                          <div className="inline-flex items-center gap-2 bg-wc-dark/40 border border-wc-border p-1 rounded-xl">
                            <button
                              onClick={() => handleUpdateStat(player.id, 'goals', false)}
                              className="w-7 h-7 flex items-center justify-center rounded-lg bg-wc-card hover:bg-slate-800 text-slate-400 hover:text-white border border-wc-border font-bold text-xs select-none transition-colors"
                            >
                              -
                            </button>
                            <span className="w-8 font-mono font-extrabold text-wc-gold text-sm text-center">
                              {player.goals}
                            </span>
                            <button
                              onClick={() => handleUpdateStat(player.id, 'goals', true)}
                              className="w-7 h-7 flex items-center justify-center rounded-lg bg-wc-gold hover:bg-yellow-400 text-slate-950 font-bold text-xs select-none transition-colors"
                            >
                              +
                            </button>
                          </div>
                        </td>

                        {/* Asistencias Control */}
                        <td className="p-4 sm:p-5 text-center">
                          <div className="inline-flex items-center gap-2 bg-wc-dark/40 border border-wc-border p-1 rounded-xl">
                            <button
                              onClick={() => handleUpdateStat(player.id, 'assists', false)}
                              className="w-7 h-7 flex items-center justify-center rounded-lg bg-wc-card hover:bg-slate-800 text-slate-400 hover:text-white border border-wc-border font-bold text-xs select-none transition-colors"
                            >
                              -
                            </button>
                            <span className="w-8 font-mono font-semibold text-slate-200 text-sm text-center">
                              {player.assists}
                            </span>
                            <button
                              onClick={() => handleUpdateStat(player.id, 'assists', true)}
                              className="w-7 h-7 flex items-center justify-center rounded-lg bg-wc-card hover:bg-slate-800 text-slate-400 hover:text-white border border-wc-border font-bold text-xs select-none transition-colors"
                            >
                              +
                            </button>
                          </div>
                        </td>

                        {/* Acciones */}
                        <td className="p-4 sm:p-5 text-right">
                          <button
                            onClick={() => handleDeletePlayer(player.id, player.name)}
                            className="px-2.5 py-2 rounded-lg bg-wc-red/10 hover:bg-wc-red text-wc-red hover:text-white border border-wc-red/20 hover:border-wc-red transition-all duration-200 text-xs font-bold font-sports tracking-wider uppercase inline-flex items-center gap-1.5"
                            title="Eliminar Jugador"
                          >
                            <Trash2 className="w-4 h-4" strokeWidth={2.5} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Column: Gold Predictions Statistics */}
        <div className="space-y-6">
          <div className="p-5 rounded-2xl border border-wc-border bg-wc-card/50 backdrop-blur-sm relative overflow-hidden flex flex-col min-h-[350px]">
            <div className="absolute top-0 right-0 w-24 h-24 bg-wc-gold/5 rounded-full blur-2xl pointer-events-none"></div>
            <div className="flex items-center gap-2 pb-4 border-b border-wc-border relative z-10">
              <Trophy className="w-5 h-5 text-wc-gold" />
              <h3 className="text-sm font-bold font-sports uppercase tracking-wider text-white">
                Favoritos a Campeón (Oro)
              </h3>
            </div>

            <div className="mt-4 space-y-4 relative z-10 flex-grow">
              {loading ? (
                <div className="flex items-center justify-center p-8">
                  <RefreshCw className="w-6 h-6 text-wc-gold animate-spin" />
                </div>
              ) : goldPredictions.length === 0 ? (
                <p className="text-xs text-slate-500 italic text-center py-8">
                  Ningún equipo ha sido seleccionado todavía.
                </p>
              ) : (() => {
                const totalSelections = goldPredictions.reduce((acc, curr) => acc + curr.count, 0);

                return (
                  <div className="space-y-3.5 max-h-[450px] overflow-y-auto pr-1">
                    {goldPredictions.map((stat, idx) => {
                      const flagUrl = getTeamFlagUrl(stat.team);
                      const percentage = totalSelections > 0 ? Math.round((stat.count / totalSelections) * 100) : 0;

                      return (
                        <div key={stat.team} className="space-y-1">
                          <div className="flex justify-between items-center text-xs">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-slate-500 min-w-[16px]">#{idx + 1}</span>
                              {flagUrl ? (
                                <img
                                  src={flagUrl}
                                  alt={`Bandera de ${stat.team}`}
                                  className="w-5 h-3.5 object-cover rounded shadow-sm shrink-0 border border-slate-700/50"
                                />
                              ) : (
                                <div className="w-5 h-3.5 bg-slate-800 rounded shrink-0 border border-slate-700/50"></div>
                              )}
                              <span className="font-bold text-slate-200">{stat.team}</span>
                            </div>
                            <span className="font-bold text-wc-gold font-sports uppercase tracking-wide">
                              {stat.count} {stat.count === 1 ? 'voto' : 'votos'} ({percentage}%)
                            </span>
                          </div>
                          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-wc-gold to-amber-500 h-1.5 rounded-full"
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* Modal / Formulario para Agregar Jugador */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-wc-card border border-wc-border w-full max-w-md rounded-2xl overflow-hidden shadow-2xl relative">
            <div className="p-5 border-b border-wc-border flex justify-between items-center bg-wc-dark/40">
              <h3 className="font-bold text-white text-base font-sports tracking-wide uppercase flex items-center gap-2">
                <Award className="w-5 h-5 text-wc-gold" /> Registrar Goleador
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4.5 h-4.5" strokeWidth={2.5} />
              </button>
            </div>

            <form onSubmit={handleCreatePlayer} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-slate-400 text-[10px] font-sports font-bold tracking-wider uppercase block">Nombre del Jugador *</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ej: Kylian Mbappé"
                  className="w-full bg-wc-dark border border-wc-border rounded-xl p-3 text-xs text-slate-200 placeholder-slate-650 focus:outline-none focus:border-wc-gold/80 transition-all font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-400 text-[10px] font-sports font-bold tracking-wider uppercase block">Selección *</label>
                <div className="relative w-full">
                  <select
                    required
                    value={newTeam}
                    onChange={(e) => setNewTeam(e.target.value)}
                    className="w-full bg-wc-dark border border-wc-border text-slate-200 text-xs rounded-xl pl-3 pr-10 py-3 appearance-none focus:outline-none focus:border-wc-gold/80 transition-all cursor-pointer font-medium"
                  >
                    <option value="" disabled>Selecciona una Selección</option>
                    {TEAMS_LIST.map(team => (
                      <option key={team} value={team}>{team}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-450">
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-slate-400 text-[10px] font-sports font-bold tracking-wider uppercase block">Goles Iniciales</label>
                  <input
                    type="number"
                    min="0"
                    value={newGoals}
                    onChange={(e) => setNewGoals(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full bg-wc-dark border border-wc-border rounded-xl p-3 text-xs text-slate-200 font-mono focus:outline-none focus:border-wc-gold/80 transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-400 text-[10px] font-sports font-bold tracking-wider uppercase block">Asistencias</label>
                  <input
                    type="number"
                    min="0"
                    value={newAssists}
                    onChange={(e) => setNewAssists(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full bg-wc-dark border border-wc-border rounded-xl p-3 text-xs text-slate-200 font-mono focus:outline-none focus:border-wc-gold/80 transition-all"
                  />
                </div>
              </div>



              <div className="flex justify-end items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-wc-dark hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-wc-border rounded-xl text-xs font-bold font-sports tracking-wider uppercase transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-gradient-to-r from-wc-gold to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-slate-955 rounded-xl text-xs font-bold font-sports tracking-wider uppercase transition-all shadow-md shadow-wc-gold/10"
                >
                  {submitting ? 'Registrando...' : 'Confirmar Registro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
