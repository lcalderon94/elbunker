/**
 * PReservas — versión conectada a la API real
 * 
 * CAMBIOS vs la versión mock:
 * 1. Zonas y mesas vienen de la API (useZones hook)
 * 2. Disponibilidad viene de la API (useAvailability hook)
 * 3. Crear reserva llama a POST /api/reservations
 * 4. Solicitud especial llama a POST /api/reservations/special-request
 * 5. El servidor valida todo (disponibilidad, adyacencia, capacidad)
 * 6. El servidor envía los emails automáticamente
 */
import { useState, useEffect } from 'react';
import { useZones, useAvailability, useCreateReservation } from '../hooks/useApi.js';

// Import FloorPlan, HourGrid2 from your components
// (these stay almost identical, just receive data from hooks instead of constants)

const HOURS = ['12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00','22:00'];

export default function PReservas() {
  const [form, setForm] = useState({
    name: '', email: '', phone: '', people: '',
    date: '', hour: '', zone: '', type: '', notes: '',
  });
  const [step, setStep] = useState(1);
  const [selectedTables, setSelectedTables] = useState([]);
  const [specialMode, setSpecialMode] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // ← ANTES: const FLOOR = { principal: {...}, sillones: {...}, ... };
  // ← AHORA: viene de la API
  const { zones: FLOOR, loading: loadingZones } = useZones();

  // ← ANTES: getOccupied() buscaba en MOCK_RES
  // ← AHORA: la API devuelve qué mesas están ocupadas
  const { occupied, loading: loadingAvail } = useAvailability(form.zone, form.date, form.hour);

  // Hook para crear reserva / solicitud especial
  const { create, createSpecial, loading: submitting, error: submitError, result } = useCreateReservation();

  // Reset tables when zone/hour/date change
  useEffect(() => { setSelectedTables([]); }, [form.zone, form.hour, form.date]);

  const floor = FLOOR[form.zone];
  const numPeople = parseInt(form.people) || 0;
  const selTables = floor ? floor.tables.filter((t) => selectedTables.includes(t.id)) : [];
  const totalSeats = selTables.reduce((s, t) => s + t.seats, 0);
  const selectionOk = selectedTables.length > 0 && totalSeats >= numPeople;
  const canProceed1 = form.date && form.hour && form.zone && form.people && selectionOk;
  const canProceed2 = form.name && form.email && form.phone;

  // ============================
  // SUBMIT RESERVATION (to API)
  // ============================
  const handleSubmitReservation = async () => {
    if (!canProceed2) return;

    try {
      // ← ANTES: setStep(3) y ya (mock)
      // ← AHORA: llama a la API real
      await create({
        date: form.date,
        hour: form.hour,
        zoneSlug: form.zone,
        tableCodes: selectedTables,      // ["M4", "M5"]
        people: numPeople,
        customerName: form.name,
        customerEmail: form.email,
        customerPhone: form.phone,
        eventType: form.type || undefined,
        notes: form.notes || undefined,
      });
      // ← El servidor valida disponibilidad, adyacencia, capacidad
      // ← El servidor envía email de confirmación al cliente
      // ← El servidor notifica al staff por email
      setStep(3);
    } catch (err) {
      // El servidor rechazó — mesa ya ocupada, etc.
      alert(err.message || 'Error al reservar. Por favor, inténtalo de nuevo.');
    }
  };

  // ============================
  // SUBMIT SPECIAL REQUEST (to API)
  // ============================
  const handleSubmitSpecial = async () => {
    if (!(form.name && form.email && form.phone)) return;

    try {
      await createSpecial({
        date: form.date,
        hour: form.hour,
        zoneSlug: form.zone,
        people: numPeople,
        customerName: form.name,
        customerEmail: form.email,
        customerPhone: form.phone,
        eventType: form.type || undefined,
        notes: form.notes,
      });
      // ← El servidor crea reserva con status PENDING
      // ← El servidor notifica al staff
      setSpecialMode(false);
      setStep(4);
    } catch (err) {
      alert(err.message || 'Error al enviar solicitud.');
    }
  };

  // ============================
  // The FloorPlan component stays the same, but uses `occupied` from the API hook
  // instead of getOccupied(date, hour, zone) from mock data.
  //
  // The key change is:
  //   BEFORE:  const occ = getOccupied(date, hour, zone);  ← from MOCK_RES array
  //   AFTER:   const occ = occupied;                        ← from useAvailability hook
  // ============================

  // ... rest of the component renders the same UI ...
  // Step 2 calls handleSubmitReservation() instead of just setStep(3)
  // Special request calls handleSubmitSpecial() instead of just setStep(4)

  return (
    <>
      {/* All the JSX stays the same — FloorPlan, HourGrid, forms, steps */}
      {/* The only difference is where the data comes from (API) */}
      {/* and that form submission calls the API */}

      {loadingZones && (
        <div style={{ textAlign: 'center', padding: '4rem' }}>
          <p>Cargando zonas del local...</p>
        </div>
      )}

      {submitError && (
        <div className="av-msg av-no" style={{ maxWidth: 600, margin: '1rem auto' }}>
          <strong>Error del servidor</strong>
          <span>{submitError}</span>
        </div>
      )}

      {/* ... same JSX as before, replacing:
          - setStep(3) → handleSubmitReservation()
          - setStep(4) → handleSubmitSpecial()
          - FLOOR[form.zone] → floor (from useZones hook)
          - getOccupied() calls → occupied (from useAvailability hook)
      */}
    </>
  );
}

/**
 * RESUMEN DE CAMBIOS para integrar con API:
 * 
 * En FloorPlan component:
 *   - Recibe `occupied` como prop (del hook) en vez de llamar getOccupied()
 *   - El resto de la lógica de selección/adyacencia NO cambia
 * 
 * En HourGrid2 component:
 *   - Para cada hora, hace una llamada ligera a la API de disponibilidad
 *   - O mejor: un endpoint nuevo GET /api/zones/:slug/hours-status?date=
 *     que devuelve el estado de TODAS las horas de un tirón (1 sola llamada)
 * 
 * En PReservas:
 *   - FLOOR viene de useZones() en vez de una constante
 *   - occupied viene de useAvailability() en vez de MOCK_RES
 *   - Submit llama a la API real
 *   - Los emails los envía el servidor, no el front
 */
