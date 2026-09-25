
# 🚌 RSU Shuttle Tracking System — Complete Backend Engine

## 📖 Project Introduction
The RSU Shuttle Tracking System is a comprehensive, real-time transportation management platform designed to monitor, track, and display university shuttle buses as they navigate the campus. This repository houses the robust backend engine that powers the entire ecosystem, acting as the central bridge between physical tracking devices, the public web interface, and the administrator dashboard.

## 🛠️ Tech Stack
* **Runtime:** Node.js (v18+) + TypeScript (`ts-node-dev` for local dev, `tsc` for build)[cite: 8]
* **Framework:** Express[cite: 8]
* **ORM:** Prisma (v7.9.1) with the `@prisma/adapter-pg` driver adapter[cite: 8]
* **Database:** PostgreSQL 14+ with the PostGIS extension (used for spatial geographic tracking)[cite: 8]
* **Real-Time Engine:** Socket.IO
* **Security:** JWT (JSON Web Tokens)

---

## 🚀 Sprint Achievements

### Sprint 1: Core Architecture & Database Foundations
* **Schema Design:** Architected the relational database schema utilizing Prisma, defining relationships between `Routes`, `Stops`, `Vehicles`, and `RouteStops`[cite: 8].
* **Spatial Data Integration:** Configured PostgreSQL with the PostGIS extension to handle actual geographic coordinates for `Stop.location`[cite: 8].
* **Core APIs:** Built full CRUD endpoints for managing the core system data[cite: 8].

### Sprint 2: Real-Time Tracking & API Integration
* **Device Authentication:** Implemented secure JWT login (`/api/auth/vehicle/login`) to ensure only authorized vehicles can push GPS updates.
* **Trip Lifecycle Management:** Built robust guardrails preventing simultaneous trips (`/api/trips/start` and `/end`) and enabling active vehicle polling (`/api/trips/live`).
* **Socket.IO Pipeline:** Engineered a two-way WebSockets connection for sub-second, real-time GPS tracking.
* **Map Visualization APIs:** Added raw SQL query endpoints utilizing PostGIS `ST_AsGeoJSON` to extract precise route drawings for frontend map interfaces.

---

## ⚙️ Setup — Clone → Configure → Run

### Prerequisites
- Node.js (v18+)[cite: 8]
- PostgreSQL 14+ with the PostGIS extension installed[cite: 8]
- Git[cite: 8]

### Installation Steps
```bash
# 1. Clone and install
git clone <repo-url>
cd StackForce_Shuttle-Bus-Project
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your real DATABASE_URL (see notes below)

# 3. Generate Prisma Client
npx prisma generate

# 4. Run migrations
npx prisma migrate dev

# 5. Seed development data
npx prisma db seed

# 6. Start the dev server
npm run dev

```

Confirm the server is working:

```bash
curl http://localhost:5000/health
# expect: {"status":"OK","database":"connected"}

```

### Environment Variables

Create `.env` in the project root:

```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/shuttle_tracking"
PORT=5000
JWT_SECRET="your-secure-random-jwt-secret"

```

**Important:** If your Postgres password contains special characters (`@`, `:`, `/`, `%`, `#`), you must percent-encode them in the URL (e.g., `@` becomes `%40`).

---

## 🗄️ Database Notes

* **Migrations are the source of truth.** Do not create or alter tables manually through pgAdmin; always edit `prisma/schema.prisma` and run `npx prisma migrate dev`.


* **PostGIS Integration:** `Stop.location` is a PostGIS geography column (`Unsupported("geography")`), requiring raw SQL (`$queryRaw`) with `ST_MakePoint`, `ST_X`, and `ST_Y` to convert coordinates. Route geometry visualization also utilizes raw SQL with `ST_AsGeoJSON`.


* **Prisma Client:** The output path defaults to `node_modules/@prisma/client`. Ensure `src/config/prisma.ts` imports from this exact path.



---

## 🔌 REST API Reference

**Base URL:** `http://localhost:5000`

### 1. Core Data (Sprint 1 CRUD)

All four resources below support standard CRUD: `GET /`, `GET /:id`, `POST /`, `PUT /:id`, `DELETE /:id`.

| Resource | Base path | Notes |
| --- | --- | --- |
| **Health check** | `GET /health` | Confirms DB connectivity.

 |
| **Routes** | `/api/routes` | `color` must be a hex code, e.g. `#RRGGBB`.

 |
| **Vehicles** | `/api/vehicles` | `assignedRouteId` is optional, must reference an existing route.

 |
| **Stops** | `/api/stops` | `lat` (-90..90) and `lng` (-180..180) required on create.

 |
| **RouteStops** | `/api/route-stops` | Links a route + stop with a `stopOrder`; supports `?routeId=` filter on GET.

 |

Standard Error Responses for CRUD:

* `400`: Missing/invalid required field.
* `404`: Resource ID not found.
* `409`: Duplicate unique value.
* `500`: Unexpected server error.

### 2. Authentication & Trips (Mobile App & Simulator)

*Protected endpoints require the `Authorization: Bearer <token>` header.*

| Method | Endpoint | Auth | Body Payload | Description |
| --- | --- | --- | --- | --- |
| **POST** | `/api/auth/vehicle/login` | None | `{ "sourceId": "...", "secret": "..." }` | Authenticates a vehicle tracking device and returns a JWT token. |
| **POST** | `/api/trips/start` | Device | `{ "routeId": "..." }` | Starts a new trip. Returns `409 Conflict` if the vehicle is already driving. |
| **POST** | `/api/trips/:id/end` | Device | *None* | Marks a specific trip status as `completed` and sets the `endTime`. |
| **GET** | `/api/trips/active` | Device | *None* | Checks if the requesting device currently has an `in_progress` trip. |
| **GET** | `/api/trips/live` | None | *None* | Returns a list of all vehicles across the system currently on an active trip. |

### 3. Map Visualization (Public Web & Admin Dashboard)

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| **GET** | `/api/routes/:id/stops` | None | Returns the list of stops for a specific route, ordered by `stopOrder`. |
| **GET** | `/api/routes/:id/geometry` | None | Returns the GeoJSON coordinate array representing the drawn route line. |

---

## 📡 Socket.IO Real-Time Engine

The backend socket server runs on the same port as the REST API.

### Connection & Authentication

To connect, authenticated devices must pass their JWT token in the handshake payload.

```javascript
const socket = io("http://localhost:5000", {
  auth: { token: "YOUR_JWT_TOKEN" }
});

```

### Emitting Data (Simulator & Mobile App)

Authenticated devices ping this event to update their location.

* **Event:** `location:update`
* **Payload:** `{ "lat": 13.9644, "lng": 100.5871, "speed": 45, "heading": 90 }`

### Listening for Data (Public Web & Admin Dashboard)

Clients listen to this broadcast to update vehicle markers on the map in real-time.

* **Event:** `vehicle:location`
* **Payload Received:** `{ "vehicleId": "V01", "lat": 13.9644, "lng": 100.5871, "speed": 45, "heading": 90, "updatedAt": "2026-09-26T..." }`

---

## 🎯 Team Integration Requirements

### 🌐 Public Web

1. Load Routes and Stops from the Backend (`GET /api/routes/:id/stops`).
2. Allow users to select a Route and display Stops in the correct `stopOrder`.
3. Draw the selected Route path (`GET /api/routes/:id/geometry`).
4. Connect to Socket.IO to receive realtime Vehicle location updates (`vehicle:location`).
5. Display and update Vehicle markers on the map.

### 🎛️ Admin Dashboard

1. Display Routes, Stops, and Route paths on the map.
2. Connect to Socket.IO to receive realtime updates (`vehicle:location`).
3. Display and update Vehicle markers.
4. Prepare basic Vehicle / Active Trip status UI (utilizing `GET /api/trips/live`).

### 📱 Mobile Application

1. Connect to the Backend API and prepare authentication (`POST /api/auth/vehicle/login`).
2. Load Vehicle and Route information.
3. Manage the Start Trip / End Trip flow (`POST /api/trips/start` & `/end`).
4. Handle GPS permissions and location tracking (emitting `location:update`).

### 🚗 Vehicle Simulator

* Create a simple Simulator that authenticates using test credentials (`sourceId: TS01`, `secret: device123`).
* Loop through coordinates and send test Vehicle locations (`location:update`) to the Backend via Socket.IO on an interval to test the system before the physical app is ready.

---

## 🧪 Troubleshooting & Testing

### Common Errors



| Symptom | Likely cause |
| --- | --- |
| `/health` returns 500 `database: disconnected` | Wrong `DATABASE_URL`, Postgres not running, or an un-encoded special character in the password. |
| `/api/routes` returns 500 `"table ... does not exist"` | Migrations weren't applied, or `src/config/prisma.ts` is importing a stale client. Run `npx prisma generate`. |
| Server won't start | Node process crashed — check the terminal running `npm run dev` for a stack trace. |

### Testing Real-Time Sockets

A `socket-test.html` file is included in the root of the repository so developers can quickly verify the Socket.IO broadcasts without needing to build a frontend first.

1. Generate a JWT token using the `POST /api/auth/vehicle/login` endpoint.
2. Open the `socket-test.html` file in any web browser.
3. Paste your token into the designated variable in the file.
4. Click the **"Send Fake GPS Ping"** button to emit a `location:update` event to the server.
5. Watch the live feed instantly display the broadcasted data.

```

```
