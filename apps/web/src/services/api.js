/**
 * El Búnker API Service
 * 
 * Capa de abstracción entre el frontend React y el backend NestJS.
 * En desarrollo, las llamadas van al proxy de Vite (localhost:5173/api → localhost:3000/api).
 * En producción, van directamente a la API.
 */

const API_BASE = import.meta.env.VITE_API_URL || '/api';

class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const config = {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  };

  // Add auth token if present
  const token = localStorage.getItem('elbunker_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, config);
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(
      data?.message || `Error ${response.status}`,
      response.status,
      data,
    );
  }

  return data;
}

// ============================================================
// ZONES & AVAILABILITY
// ============================================================

export const zonesApi = {
  /**
   * Get all zones with their tables and floor plan data.
   * Replaces: FLOOR constant in the frontend
   */
  getAll: () => request('/zones'),

  /**
   * Get a specific zone by slug.
   */
  getBySlug: (slug) => request(`/zones/${slug}`),

  /**
   * Check availability for a zone at a date+hour.
   * Returns zone with tables annotated as occupied/free.
   * Replaces: MOCK_RES + getOccupied() in the frontend
   */
  getAvailability: (slug, date, hour) =>
    request(`/zones/${slug}/availability?date=${date}&hour=${hour}`),
};

// ============================================================
// RESERVATIONS
// ============================================================

export const reservationsApi = {
  /**
   * Create a reservation.
   * Server validates: availability, adjacency, capacity, date.
   * Sends confirmation email to client + notification to staff.
   */
  create: (data) =>
    request('/reservations', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /**
   * Submit a special request for large groups.
   * Status = PENDING, staff must confirm.
   */
  specialRequest: (data) =>
    request('/reservations/special-request', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /**
   * Get reservation details by ID.
   */
  getById: (id) => request(`/reservations/${id}`),

  /**
   * Cancel a reservation using the cancel token.
   */
  cancel: (cancelToken, email) =>
    request(`/reservations/${cancelToken}`, {
      method: 'DELETE',
      body: JSON.stringify({ email }),
    }),
};

// ============================================================
// GAMES
// ============================================================

export const gamesApi = {
  /**
   * Search games with filters and pagination.
   * Replaces: GDATA array in the frontend
   */
  search: (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.search) params.set('search', filters.search);
    if (filters.typeId) params.set('typeId', filters.typeId);
    if (filters.players) params.set('players', filters.players);
    if (filters.maxDifficulty !== undefined) params.set('maxDifficulty', filters.maxDifficulty);
    if (filters.maxDuration) params.set('maxDuration', filters.maxDuration);
    if (filters.page) params.set('page', filters.page);
    if (filters.limit) params.set('limit', filters.limit);
    return request(`/games?${params}`);
  },

  /**
   * Get full game details with categories, mechanics, types.
   */
  getById: (id) => request(`/games/${id}`),

  /**
   * Get all game types (for filter buttons).
   */
  getTypes: () => request('/games/types'),

  /**
   * Get all categories.
   */
  getCategories: () => request('/games/categories'),

  /**
   * Get all mechanics.
   */
  getMechanics: () => request('/games/mechanics'),
};

// ============================================================
// AUTH (for admin panel — Phase 3)
// ============================================================

export const authApi = {
  login: (email, password) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  me: () => request('/auth/me'),
};

// ============================================================
// ADMIN (Phase 4)
// ============================================================

export const adminApi = {
  getReservationsByDate: (date) => request(`/admin/reservations?date=${date}`),

  updateReservationStatus: (id, status, staffNotes) =>
    request(`/admin/reservations/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, staffNotes }),
    }),
};
