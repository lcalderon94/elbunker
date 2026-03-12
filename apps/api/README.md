# El Búnker API

Backend API para El Búnker Board Game Café.

**Stack:** NestJS + PostgreSQL + Prisma + Nodemailer

## Setup rápido

### 1. Requisitos
- Node.js 20+
- Docker (para PostgreSQL)

### 2. Instalar dependencias
```bash
npm install
```

### 3. Levantar PostgreSQL
```bash
docker compose up -d
```

### 4. Configurar variables de entorno
```bash
cp .env.example .env
# Edita .env con tus datos de SMTP si quieres probar emails
```

### 5. Crear base de datos y ejecutar migraciones
```bash
npx prisma migrate dev --name init
```

### 6. Seed de datos iniciales
```bash
npm run db:seed
```

Esto crea:
- 3 zonas (Principal, Sillones, Terraza) con todas las mesas
- Tipos, categorías y mecánicas de juegos
- Usuario admin: `admin@elbunker.es` / `admin123`

### 7. (Opcional) Importar juegos
Copia tu `juegos.json` a `prisma/juegos.json` y descomenta la sección de importación en `prisma/seed.ts`. Luego:
```bash
npm run db:seed
```

### 8. Arrancar el servidor
```bash
npm run start:dev
```

### 9. Acceder
- API: http://localhost:3000/api
- Swagger docs: http://localhost:3000/api/docs
- Prisma Studio (ver BD): `npx prisma studio`

## Endpoints principales

| Método | Endpoint | Descripción |
|---|---|---|
| GET | `/api/zones` | Lista zonas con mesas |
| GET | `/api/zones/:slug/availability?date=&hour=` | Disponibilidad |
| POST | `/api/reservations` | Crear reserva |
| POST | `/api/reservations/special-request` | Solicitud grupo grande |
| DELETE | `/api/reservations/:cancelToken` | Cancelar reserva |
| GET | `/api/games?search=&typeId=&players=&page=` | Buscar juegos |
| GET | `/api/games/:id` | Detalle juego |
| GET | `/api/games/types` | Tipos de juego |

## Estructura del proyecto

```
src/
├── main.ts                     # Entry point + Swagger
├── app.module.ts               # Root module
├── common/
│   └── prisma.service.ts       # Database access
├── zones/                      # Zonas y mesas
│   ├── zones.module.ts
│   ├── zones.controller.ts
│   └── zones.service.ts
├── reservations/               # Sistema de reservas
│   ├── reservations.module.ts
│   ├── reservations.controller.ts
│   ├── reservations.service.ts
│   └── dto/
│       └── reservation.dto.ts
├── email/                      # Envío de emails
│   ├── email.module.ts
│   └── email.service.ts
└── games/                      # Catálogo de juegos
    ├── games.module.ts
    ├── games.controller.ts
    └── games.service.ts
```
