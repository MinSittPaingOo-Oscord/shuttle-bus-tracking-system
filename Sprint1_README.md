# Shuttle Tracking Backend

Backend & Database service for the Shuttle Tracking System — Express + TypeScript + Prisma + PostgreSQL/PostGIS.

This README covers the **Backend & Database** scope: `Route`, `Vehicle`, `Stop`, and `RouteStop` CRUD. The database also contains other tables (`users`, `trips`, `gps_tracks`, `feedback`, `tracking_sources`) that belong to other parts of the system (mobile app, live tracking, feedback) — those are out of scope here.

---

## Tech Stack

- **Runtime:** Node.js + TypeScript (`ts-node-dev` for local dev, `tsc` for build)
- **Framework:** Express
- **ORM:** Prisma (v7.9.1) with the `@prisma/adapter-pg` driver adapter
- **Database:** PostgreSQL with the PostGIS extension (used for `Stop` coordinates)

---

## Prerequisites

- Node.js (v18+)
- PostgreSQL 14+ with the PostGIS extension installed
- Git

---

## Setup — Clone → Configure → Run

```bash
# 1. Clone and install
git clone <repo-url>
cd StackForce_Shuttle-Bus-Project
npm install

# 2. Configure environment
cp .env.example .env
# then edit .env with your real DATABASE_URL — see "Environment Variables" below

# 3. Generate Prisma Client
npx prisma generate

# 4. Run migrations
npx prisma migrate dev

# 5. Seed development data
npx prisma db seed

# 6. Start the dev server
npm run dev
```

Confirm it's working:
```bash
curl http://localhost:5000/health
# expect: {"status":"OK","database":"connected"}
```

---

## Environment Variables

Create `.env` in the project root (never commit this file — it's already gitignored):

```
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/shuttle_tracking"
PORT=5000
```

**Important:** if your Postgres password contains special characters (`@`, `:`, `/`, `%`, `#`), you must either avoid them entirely (recommended — simplest) or percent-encode them in the URL (e.g. `@` becomes `%40`). An un-encoded `@` in the password will break the connection string, since `@` is also the delimiter between the password and the host.

---

## Database Notes

- **Migrations are the source of truth.** Don't create or alter tables manually through pgAdmin — always edit `prisma/schema.prisma` and run `npx prisma migrate dev`. If Prisma detects the database is out of sync with its migration history, it may reset the database (drop and recreate), which wipes any data added outside of Prisma.
- **`Stop.location` is a PostGIS geography column** (`Unsupported("geography")` in the schema), so Prisma's normal `create`/`update`/`findMany` can't read or write it directly. The stop routes use raw SQL (`$queryRaw` / `$executeRaw`) with `ST_MakePoint` / `ST_X` / `ST_Y` to convert between `lat`/`lng` and the geography column.
- **Prisma Client output path:** the schema's generator block does not set a custom `output`, so `npx prisma generate` always writes to the default `node_modules/@prisma/client`. Make sure `src/config/prisma.ts` imports from `"@prisma/client"` — not a custom path like `../../generated/prisma/client`. If someone changes the generator's `output` path in the future, this import needs to match.

---

## Project Structure

```
src/
  config/prisma.ts       # Prisma Client instance (pg adapter)
  routes/
    route.routes.ts      # Route CRUD
    vehicle.routes.ts    # Vehicle CRUD
    stop.routes.ts       # Stop CRUD (raw SQL for geography column)
    routeStop.routes.ts  # RouteStop CRUD
  server.ts               # Express app entry point
prisma/
  schema.prisma
  migrations/
  seed.ts
```

**Note:** `src/routes/tram.routes.ts` and `src/controllers/tram.controller.ts` are legacy/unused leftovers from an earlier naming convention — not imported by `server.ts`. Safe to delete.

---

## API Reference

Base URL: `http://localhost:5000`

| Resource | Base path | Notes |
|---|---|---|
| Health check | `GET /health` | Confirms DB connectivity |
| Routes | `/api/routes` | `color` must be a hex code, e.g. `#RRGGBB` |
| Vehicles | `/api/vehicles` | `assignedRouteId` is optional, must reference an existing route if set |
| Stops | `/api/stops` | `lat` (-90..90) and `lng` (-180..180) required on create |
| RouteStops | `/api/route-stops` | Links a route + stop with a `stopOrder`; supports `?routeId=` filter on GET |

All four resources support standard CRUD: `GET /`, `GET /:id`, `POST /`, `PUT /:id`, `DELETE /:id`.

**Standard error responses:**

| Status | Meaning |
|---|---|
| 400 | Missing/invalid required field (missing field, bad hex color, invalid lat/lng, invalid FK reference) |
| 404 | Resource ID not found |
| 409 | Duplicate unique value (id already exists, or duplicate `stopOrder` on the same route) |
| 500 | Unexpected server error |

Every error response is JSON: `{"error": "..."}`.

---

## Testing the API

Use Thunder Client, Postman, or curl against `http://localhost:5000`. Full endpoint-by-endpoint checklist below — every row lists the exact request and the expected status code.

### Health Check
- [ ] `GET /health` → 200, `{"status":"OK","database":"connected"}`

### Routes — `/api/routes`

| Method | URL | Body | Expected |
|---|---|---|---|
| GET | `/api/routes` | — | 200, array of routes |
| GET | `/api/routes/R01` | — | 200, single route |
| GET | `/api/routes/doesnotexist` | — | 404 |
| POST | `/api/routes` | `{"id":"RT1","name":"Test Route","color":"#00FF00"}` | 201, created route |
| POST | `/api/routes` | `{"id":"RT1","name":"Dup","color":"#00FF00"}` (same id again) | 409 |
| POST | `/api/routes` | `{"id":"RT2","name":"Bad"}` (missing color) | 400 |
| POST | `/api/routes` | `{"id":"RT3","name":"Bad","color":"blue"}` (invalid hex) | 400 |
| PUT | `/api/routes/RT1` | `{"status":"inactive"}` | 200, updated |
| PUT | `/api/routes/doesnotexist` | `{"status":"inactive"}` | 404 |
| DELETE | `/api/routes/RT1` | — | 200 |
| GET | `/api/routes/RT1` (after delete) | — | 404 |

### Vehicles — `/api/vehicles`

| Method | URL | Body | Expected |
|---|---|---|---|
| GET | `/api/vehicles` | — | 200, array of vehicles |
| GET | `/api/vehicles/V01` | — | 200, single vehicle |
| GET | `/api/vehicles/doesnotexist` | — | 404 |
| POST | `/api/vehicles` | `{"id":"VT1","name":"Test Van","type":"van","assignedRouteId":"R01"}` | 201 |
| POST | `/api/vehicles` | `{"id":"VT1", ...}` (same id again) | 409 |
| POST | `/api/vehicles` | `{"id":"VT2","name":"Bad"}` (missing type) | 400 |
| POST | `/api/vehicles` | `{"id":"VT3","name":"Bad","type":"bus","assignedRouteId":"doesnotexist"}` | 400 |
| PUT | `/api/vehicles/VT1` | `{"status":"inactive"}` | 200 |
| DELETE | `/api/vehicles/VT1` | — | 200 |
| GET | `/api/vehicles/VT1` (after delete) | — | 404 |

### Stops — `/api/stops`

| Method | URL | Body | Expected |
|---|---|---|---|
| GET | `/api/stops` | — | 200, array with numeric `lat`/`lng` |
| GET | `/api/stops/S01` | — | 200, single stop |
| GET | `/api/stops/doesnotexist` | — | 404 |
| POST | `/api/stops` | `{"id":"ST1","nameTh":"ทดสอบ","lat":13.75,"lng":100.52}` | 201 |
| POST | `/api/stops` | `{"id":"ST1", ...}` (same id again) | 409 |
| POST | `/api/stops` | `{"id":"ST2","nameTh":"Bad"}` (missing lat/lng) | 400 |
| POST | `/api/stops` | `{"id":"ST3","nameTh":"Bad","lat":999,"lng":100}` (invalid lat) | 400 |
| PUT | `/api/stops/ST1` | `{"nameEn":"Test Stop"}` | 200 |
| DELETE | `/api/stops/ST1` | — | 200 |
| DELETE | `/api/stops/S01` (a stop still used in a route) | — | 409 (blocked — referenced by a route) |

### RouteStops — `/api/route-stops`

| Method | URL | Body | Expected |
|---|---|---|---|
| GET | `/api/route-stops` | — | 200, array with nested `stop` data |
| GET | `/api/route-stops?routeId=R01` | — | 200, filtered to that route only |
| GET | `/api/route-stops/doesnotexist` | — | 404 |
| POST | `/api/route-stops` | `{"routeId":"R01","stopId":"S01","stopOrder":99}` | 201 |
| POST | `/api/route-stops` | same `routeId`+`stopOrder` again | 409 |
| POST | `/api/route-stops` | `{"routeId":"doesnotexist","stopId":"S01","stopOrder":1}` | 400 |
| POST | `/api/route-stops` | `{"routeId":"R01","stopId":"S01","stopOrder":0}` (invalid order) | 400 |
| PUT | `/api/route-stops/<id from above>` | `{"stopOrder":98}` | 200 |
| DELETE | `/api/route-stops/<id from above>` | — | 200 |

### What "pass" looks like
- Every success case returns the documented status code and a JSON body (never a blank response or an HTML error page)
- Every error case returns the documented status code with `{"error": "..."}` — never a 500 or a crash
- Deleting/creating test records above should not affect the original seeded data (R01–R03, V01–V04, S01–S05)

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `/health` returns 500 `database: disconnected` | Wrong `DATABASE_URL`, Postgres not running, or an un-encoded special character in the password |
| `/api/routes` (or any resource) returns 500 `"table ... does not exist"` | Migrations weren't applied, or `src/config/prisma.ts` is importing a stale Prisma Client from the wrong path — run `npx prisma generate` and confirm the import path is `@prisma/client` |
| Data you added manually in pgAdmin disappeared | `prisma migrate dev` detected schema drift and reset the database — always change data through `prisma/seed.ts`, not pgAdmin, going forward |
| Server won't start / "Connection refused" on every endpoint including `/health` | The Node process itself crashed — check the terminal running `npm run dev` for a stack trace |
