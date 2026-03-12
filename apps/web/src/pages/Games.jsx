/**
 * PJuegos — versión conectada a la API real
 * 
 * CAMBIOS vs la versión mock:
 * 1. import { useGames, useGameTypes, useGameDetail } from hooks
 * 2. Eliminar GDATA constante hardcodeada
 * 3. Los filtros llaman a la API con cada cambio
 * 4. La paginación viene del servidor
 * 5. El modal carga detalle del juego desde la API
 */
import { useState } from 'react';
import { useGames, useGameTypes, useGameDetail } from '../hooks/useApi.js';

// Import shared components (Icons, MockImg, etc.) from your main App
// In a full refactor these would be in /components/

export default function PJuegos() {
  const [search, setSearch] = useState('');
  const [players, setPlayers] = useState(0);
  const [maxDiff, setMaxDiff] = useState(5);
  const [maxDur, setMaxDur] = useState(240);
  const [typeFilter, setTypeFilter] = useState(0);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(null);

  // ← Antes: const filtered = GDATA.filter(...)
  // ← Ahora: la API filtra y pagina en el servidor
  const { games, pagination, loading } = useGames({
    search: search || undefined,
    typeId: typeFilter || undefined,
    players: players || undefined,
    maxDifficulty: maxDiff < 5 ? maxDiff : undefined,
    maxDuration: maxDur < 240 ? maxDur : undefined,
    page,
    limit: 24,
  });

  // Tipos de juego para los botones de filtro
  const types = useGameTypes();

  // Detalle del juego seleccionado
  const { game: selectedGame, loading: loadingDetail } = useGameDetail(selectedId);

  const resetFilters = () => {
    setSearch('');
    setPlayers(0);
    setMaxDiff(5);
    setMaxDur(240);
    setTypeFilter(0);
    setPage(1);
  };

  return (
    <>
      <div className="ph">
        <h1>Nuestros Juegos</h1>
        <p>¡Una colección de {pagination.total || '500+'} juegos!</p>
      </div>

      <section className="sec rbg" style={{ background: 'var(--cream)' }}>
        <div className="ctn">
          <div className="jbrowser">
            {/* SIDEBAR — same as before, but filters trigger API calls */}
            <aside className="jside">
              <div className="jside-head">
                <h3>Filtros</h3>
                <button className="jreset" onClick={resetFilters}>Limpiar</button>
              </div>

              <div className="jfield">
                <label>Buscar por nombre</label>
                <input
                  type="text"
                  placeholder="Escribe un nombre..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                />
              </div>

              <div className="jfield">
                <label>Jugadores: {players === 0 ? 'Todos' : players}</label>
                <input type="range" min="0" max="10" value={players}
                  onChange={(e) => { setPlayers(+e.target.value); setPage(1); }} />
              </div>

              <div className="jfield">
                <label>Dificultad máx: {maxDiff}</label>
                <input type="range" min="0" max="5" value={maxDiff}
                  onChange={(e) => { setMaxDiff(+e.target.value); setPage(1); }} />
              </div>

              <div className="jfield">
                <label>Duración máx: {maxDur >= 240 ? 'Sin límite' : maxDur + ' min'}</label>
                <input type="range" min="10" max="240" step="10" value={maxDur}
                  onChange={(e) => { setMaxDur(+e.target.value); setPage(1); }} />
              </div>

              {/* Type filter buttons */}
              <div className="jfield">
                <label>Tipo de juego</label>
                <div className="jtype-grid">
                  <button
                    className={`jtype-btn ${typeFilter === 0 ? 'on' : ''}`}
                    onClick={() => { setTypeFilter(0); setPage(1); }}
                  >Todos</button>
                  {types.map((t) => (
                    <button
                      key={t.id}
                      className={`jtype-btn ${typeFilter === t.id ? 'on' : ''}`}
                      onClick={() => { setTypeFilter(t.id); setPage(1); }}
                    >{t.name}</button>
                  ))}
                </div>
              </div>

              <div className="jcount">
                {loading ? 'Buscando...' : `${pagination.total} juegos encontrados`}
              </div>
            </aside>

            {/* GRID — now uses API data */}
            <div className="jmain">
              {loading && <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--tm)' }}>Cargando juegos...</div>}

              <div className="jgrid">
                {games.map((g) => (
                  <div className="jcard" key={g.id} onClick={() => setSelectedId(g.id)}>
                    {/* ← Antes: MockImg con gradiente */}
                    {/* ← Ahora: imagen real del juego si existe */}
                    {g.imageUrl ? (
                      <img src={g.imageUrl} alt={g.name} style={{ width: '100%', height: 120, objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: 120, background: 'linear-gradient(135deg,#8B5E3C,#E8A33C,#FFD60A)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.8)', fontFamily: "'Lilita One',sans-serif", fontSize: '.85rem' }}>
                        {g.name}
                      </div>
                    )}
                    <div className="jcard-body">
                      <h4>{g.name}</h4>
                      {/* Types come from API now */}
                      {g.types?.length > 0 && (
                        <span className="game-badge">{g.types[0].name}</span>
                      )}
                      <div className="jcard-meta">
                        <span>👥 {g.playersMin}-{g.playersMax}</span>
                        <span>⏱ {g.durationMin}'{g.durationMax !== g.durationMin ? `-${g.durationMax}'` : ''}</span>
                        <span>📊 {g.difficulty}/5</span>
                      </div>
                    </div>
                    <div className="jcard-cta">Ver detalles</div>
                  </div>
                ))}
              </div>

              {/* Pagination — comes from API */}
              {pagination.totalPages > 1 && (
                <div className="jpag">
                  <button className="jpag-btn" disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}>← Anterior</button>
                  <span className="jpag-info">Página {page} de {pagination.totalPages}</span>
                  <button className="jpag-btn" disabled={page >= pagination.totalPages}
                    onClick={() => setPage((p) => p + 1)}>Siguiente →</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Game detail modal — now loads from API */}
      {selectedGame && (
        <div className="gmodal-overlay" onClick={() => setSelectedId(null)}>
          <div className="gmodal" onClick={(e) => e.stopPropagation()}>
            <button className="gmodal-close" onClick={() => setSelectedId(null)}>×</button>
            <div className="gmodal-grid">
              <div className="gmodal-img">
                {selectedGame.imageUrl ? (
                  <img src={selectedGame.imageUrl} alt={selectedGame.name}
                    style={{ width: '100%', borderRadius: 16 }} />
                ) : (
                  <div style={{ height: 300, background: 'linear-gradient(135deg,#0077B6,#00B4D8)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: "'Lilita One',sans-serif", fontSize: '1.2rem' }}>
                    {selectedGame.name}
                  </div>
                )}
              </div>
              <div className="gmodal-info">
                <h2>{selectedGame.name}</h2>

                {/* Tags from API — categories, types, mechanics */}
                {selectedGame.types?.length > 0 && (
                  <div className="gmodal-tagrow">
                    <span className="gmodal-taglabel">Tipos:</span>
                    {selectedGame.types.map((t) => <span key={t.id} className="gtag tipo">{t.name}</span>)}
                  </div>
                )}
                {selectedGame.categories?.length > 0 && (
                  <div className="gmodal-tagrow">
                    <span className="gmodal-taglabel">Categorías:</span>
                    {selectedGame.categories.map((c) => <span key={c.id} className="gtag cat">{c.name}</span>)}
                  </div>
                )}

                <div className="gmodal-stats">
                  <div className="gstat">⏱<div><small>Duración</small><strong>{selectedGame.durationMin}-{selectedGame.durationMax} min</strong></div></div>
                  <div className="gstat">👥<div><small>Jugadores</small><strong>{selectedGame.playersMin}-{selectedGame.playersMax}</strong></div></div>
                  <div className="gstat">⭐<div><small>Mejor para</small><strong>{selectedGame.playersBest || '—'}</strong></div></div>
                  <div className="gstat">🎂<div><small>Edad</small><strong>{selectedGame.ageMin}+</strong></div></div>
                </div>

                {selectedGame.description && (
                  <p className="gmodal-desc">{selectedGame.description}</p>
                )}

                {selectedGame.mechanics?.length > 0 && (
                  <div className="gmodal-tagrow">
                    <span className="gmodal-taglabel">Mecánicas:</span>
                    {selectedGame.mechanics.map((m) => <span key={m.id} className="gtag mech">{m.name}</span>)}
                  </div>
                )}

                {selectedGame.location && (
                  <p style={{ marginTop: '1rem', fontSize: '.85rem', color: 'var(--tm)', fontWeight: 600 }}>
                    📍 Ubicación en el local: <strong>{selectedGame.location}</strong>
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
