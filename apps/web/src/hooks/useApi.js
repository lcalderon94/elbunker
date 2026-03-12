import { useState, useEffect, useCallback } from 'react';
import { zonesApi, reservationsApi, gamesApi } from '../services/api.js';

/**
 * Hook para cargar las zonas del local con sus mesas.
 * Reemplaza el FLOOR hardcodeado del frontend.
 */
export function useZones() {
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    zonesApi.getAll()
      .then((data) => {
        // Transform API response to match the FLOOR format the components expect
        const zonesMap = {};
        data.forEach((z) => {
          zonesMap[z.slug] = {
            name: z.name,
            w: z.mapWidth,
            h: z.mapHeight,
            furniture: z.furniture || [],
            tables: z.tables.map((t) => ({
              id: t.code,
              seats: t.seats,
              x: t.posX,
              y: t.posY,
              w: t.width,
              h: t.height,
              shape: t.shape,
              label: t.label,
              adj: t.adjacentIds,
              _dbId: t.id, // Keep the DB id for API calls
            })),
          };
        });
        setZones(zonesMap);
      })
      .catch((err) => {
        console.error('Error loading zones:', err);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, []);

  return { zones, loading, error };
}

/**
 * Hook para comprobar disponibilidad de una zona en fecha+hora.
 * Reemplaza MOCK_RES + getOccupied().
 */
export function useAvailability(zoneSlug, date, hour) {
  const [occupied, setOccupied] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!zoneSlug || !date || !hour) {
      setOccupied([]);
      return;
    }

    setLoading(true);
    zonesApi.getAvailability(zoneSlug, date, hour)
      .then((data) => {
        // Extract occupied table codes
        const occ = data.tables
          .filter((t) => t.isOccupied)
          .map((t) => t.code);
        setOccupied(occ);
      })
      .catch((err) => {
        console.error('Error checking availability:', err);
        setOccupied([]);
      })
      .finally(() => setLoading(false));
  }, [zoneSlug, date, hour]);

  return { occupied, loading };
}

/**
 * Hook para crear una reserva.
 */
export function useCreateReservation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const create = useCallback(async (data) => {
    setLoading(true);
    setError(null);
    try {
      const res = await reservationsApi.create(data);
      setResult(res);
      return res;
    } catch (err) {
      setError(err.message || 'Error al crear la reserva');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const createSpecial = useCallback(async (data) => {
    setLoading(true);
    setError(null);
    try {
      const res = await reservationsApi.specialRequest(data);
      setResult(res);
      return res;
    } catch (err) {
      setError(err.message || 'Error al enviar la solicitud');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = () => { setResult(null); setError(null); };

  return { create, createSpecial, loading, error, result, reset };
}

/**
 * Hook para buscar juegos con filtros y paginación.
 * Reemplaza GDATA hardcodeado.
 */
export function useGames(filters) {
  const [games, setGames] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    gamesApi.search(filters)
      .then((data) => {
        setGames(data.games);
        setPagination(data.pagination);
      })
      .catch((err) => {
        console.error('Error loading games:', err);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [
    filters.search,
    filters.typeId,
    filters.players,
    filters.maxDifficulty,
    filters.maxDuration,
    filters.page,
  ]);

  return { games, pagination, loading, error };
}

/**
 * Hook para cargar detalle de un juego.
 */
export function useGameDetail(gameId) {
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!gameId) { setGame(null); return; }

    setLoading(true);
    gamesApi.getById(gameId)
      .then(setGame)
      .catch((err) => console.error('Error loading game:', err))
      .finally(() => setLoading(false));
  }, [gameId]);

  return { game, loading };
}

/**
 * Hook para cargar tipos de juego (para filtros).
 */
export function useGameTypes() {
  const [types, setTypes] = useState([]);

  useEffect(() => {
    gamesApi.getTypes()
      .then(setTypes)
      .catch((err) => console.error('Error loading types:', err));
  }, []);

  return types;
}
