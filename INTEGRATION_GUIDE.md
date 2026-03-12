# Guía de Integración: Frontend React + Backend NestJS

## Estructura del Monorepo

```
el-bunker/
├── package.json                  # Scripts para arrancar todo
├── apps/
│   ├── web/                      # React + Vite (frontend)
│   │   ├── src/
│   │   │   ├── main.jsx          # Entry point
│   │   │   ├── App.jsx           # ← Tu JSX actual (funciona tal cual)
│   │   │   ├── services/
│   │   │   │   └── api.js        # ★ Capa de conexión con el backend
│   │   │   ├── hooks/
│   │   │   │   └── useApi.js     # ★ Hooks que reemplazan datos mock
│   │   │   └── pages/
│   │   │       ├── Games.jsx     # ★ Ejemplo: Juegos con API real
│   │   │       └── Reservations.jsx  # ★ Ejemplo: Reservas con API real
│   │   ├── index.html
│   │   ├── vite.config.js        # Proxy /api → localhost:3000
│   │   └── package.json
│   │
│   └── api/                      # NestJS (backend)
│       ├── src/
│       │   ├── zones/            # Zonas y mesas
│       │   ├── reservations/     # Reservas + emails
│       │   ├── games/            # Catálogo de juegos
│       │   └── email/            # Envío de emails
│       ├── prisma/
│       │   ├── schema.prisma     # Modelo de datos
│       │   ├── seed.ts           # Datos iniciales
│       │   └── juegos.json       # Los 585 juegos
│       └── docker-compose.yml    # PostgreSQL
```

## Setup Rápido (5 minutos)

### 1. Instalar dependencias
```bash
cd el-bunker
npm run install:all
```

### 2. Levantar PostgreSQL
```bash
cd apps/api
docker compose up -d
```

### 3. Configurar backend
```bash
cd apps/api
cp .env.example .env
# Edita .env con tus datos SMTP si quieres emails reales
```

### 4. Crear base de datos
```bash
npx prisma migrate dev --name init
npm run db:seed
```

### 5. Arrancar todo
```bash
# Desde la raíz del monorepo:
npm run dev

# O por separado:
npm run dev:api   # Backend en localhost:3000
npm run dev:web   # Frontend en localhost:5173
```

### 6. Verificar
- Frontend: http://localhost:5173
- API: http://localhost:3000/api
- Swagger: http://localhost:3000/api/docs
- DB visual: `cd apps/api && npx prisma studio`

## Cómo funciona la conexión

```
Browser (localhost:5173)
    │
    ├── /api/zones ──────→ Vite proxy ──→ NestJS (localhost:3000/api/zones)
    ├── /api/reservations ──→ Vite proxy ──→ NestJS
    ├── /api/games ────────→ Vite proxy ──→ NestJS
    │
    └── Todo lo demás ───→ Vite sirve React
```

El `vite.config.js` tiene un proxy que redirige todas las llamadas `/api/*` al backend NestJS. Esto significa que en desarrollo no hay problemas de CORS.

## Plan de Migración: De Mocks a API Real

### Estrategia: Incremental, no Big Bang

Tu App.jsx actual funciona con datos mock. La migración es progresiva:

### Paso 1: Funciona tal cual (hoy)
El `App.jsx` sigue usando los datos hardcodeados. El backend ya está corriendo pero el front no lo llama aún. Puedes probar la API directamente en Swagger.

### Paso 2: Conectar Reservas (primer cambio real)

Cambios en `App.jsx`:

```jsx
// AÑADIR al principio del archivo:
import { zonesApi, reservationsApi } from './services/api.js';

// EN PReservas, CAMBIAR getOccupied() por llamada a API:

// ANTES:
function getOccupied(date, hour, zone) {
  return MOCK_RES.filter(r => r.date === date && r.hour === hour && r.zone === zone)
    .map(r => r.tableId);
}

// DESPUÉS:
async function getOccupiedFromAPI(date, hour, zone) {
  try {
    const data = await zonesApi.getAvailability(zone, date, hour);
    return data.tables.filter(t => t.isOccupied).map(t => t.code);
  } catch (err) {
    console.error('Error:', err);
    return [];
  }
}

// EN PReservas, CAMBIAR el submit:

// ANTES:
onClick={() => setStep(3)}  // fake confirm

// DESPUÉS:
onClick={async () => {
  try {
    await reservationsApi.create({
      date: form.date,
      hour: form.hour,
      zoneSlug: form.zone,
      tableCodes: selectedTables,
      people: +form.people,
      customerName: form.name,
      customerEmail: form.email,
      customerPhone: form.phone,
      eventType: form.type || undefined,
      notes: form.notes || undefined,
    });
    setStep(3); // El servidor ya envió los emails
  } catch (err) {
    alert(err.message);
  }
}}
```

### Paso 3: Conectar Juegos

```jsx
// CAMBIAR PJuegos para que cargue de la API:

// ANTES: const filtered = GDATA.filter(...)
// DESPUÉS: 
const [games, setGames] = useState([]);
const [total, setTotal] = useState(0);

useEffect(() => {
  gamesApi.search({ search, typeId: typeFilter || undefined, players: players || undefined, maxDifficulty: maxDiff, maxDuration: maxDur, page, limit: 24 })
    .then(data => { setGames(data.games); setTotal(data.pagination.total); })
    .catch(console.error);
}, [search, typeFilter, players, maxDiff, maxDur, page]);
```

### Paso 4: Cargar Zonas dinámicamente

```jsx
// ANTES: const FLOOR = { principal: {...}, sillones: {...}, ... };
// DESPUÉS:
const [FLOOR, setFLOOR] = useState({});

useEffect(() => {
  zonesApi.getAll().then(zones => {
    const map = {};
    zones.forEach(z => {
      map[z.slug] = {
        name: z.name, w: z.mapWidth, h: z.mapHeight,
        furniture: z.furniture || [],
        tables: z.tables.map(t => ({
          id: t.code, seats: t.seats, x: t.posX, y: t.posY,
          w: t.width, h: t.height, shape: t.shape,
          label: t.label, adj: t.adjacentIds,
        })),
      };
    });
    setFLOOR(map);
  });
}, []);
```

## Endpoints que usa cada página

| Página | Endpoint | Qué reemplaza |
|---|---|---|
| Reservas | `GET /api/zones` | `FLOOR` constante |
| Reservas | `GET /api/zones/:slug/availability?date=&hour=` | `MOCK_RES` + `getOccupied()` |
| Reservas | `POST /api/reservations` | `setStep(3)` fake |
| Reservas | `POST /api/reservations/special-request` | `setStep(4)` fake |
| Juegos | `GET /api/games?search=&typeId=&page=` | `GDATA` array de 585 juegos |
| Juegos | `GET /api/games/:id` | Modal con datos estáticos |
| Juegos | `GET /api/games/types` | `TYPE_NAMES` constante |

## Lo que NO cambia

- **Inicio, Carta, Preguntas, Nosotros, Contacto**: Siguen con datos estáticos en el JSX. Se conectarán cuando hagas el panel admin (Fase 4).
- **CSS**: No cambia nada.
- **Componentes visuales** (FloorPlan, HourGrid, Nav, Footer): La lógica visual no cambia, solo de dónde viene la data.
- **Estructura de la UI**: Exactamente igual.

## Orden recomendado de trabajo

1. ✅ Arrancar backend + seed de datos
2. ✅ Probar API en Swagger (http://localhost:3000/api/docs)
3. Conectar `GET /api/zones` → PReservas carga zonas dinámicamente
4. Conectar `GET /api/zones/:slug/availability` → FloorPlan muestra ocupación real
5. Conectar `POST /api/reservations` → Reserva real + emails
6. Conectar `GET /api/games` → PJuegos con datos reales de BD
7. Configurar SMTP real para emails
8. Deploy inicial
