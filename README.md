
# 🚍 Shuttle Tracking System — Backend & Staging Guide

This document is the unified technical integration and development manual for the **Shuttle Tracking System** backend, consolidating Sprint 1 baseline CRUD operations, Sprint 2 real-time WebSocket pipelines, and Sprint 2.5 cloud deployment. 

---

## 🛠️ Tech Stack & Architecture

- **Runtime & Language:** Node.js (v18+) with TypeScript (`ts-node-dev` for local dev, `tsc` for production build)
- **API Framework:** Express.js
- **Real-Time Engine:** Socket.IO
- **ORM & Migrations:** Prisma Client (with PostgreSQL driver adapter)
- **Database Engine:** PostgreSQL 14+ with PostGIS extension (`geography` & `geometry` support)
- **Cloud Infrastructure (Sprint 2.5):**
  - **Database:** Neon Serverless PostgreSQL
  - **Backend Hosting:** Render Web Service
  - **Frontend Staging:** Vercel

---

## 💻 Part 1: Local Development & Database Setup

Use this section to run the database and backend directly on your development machine.

### 1.1 Environment Variables (`.env`)
Create a `.env` file in the project root:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/shuttle_tracking"
PORT=5000
JWT_SECRET="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.devSecretTokenForLocalTesting"
CORS_ORIGIN="*"

```

> **Note on Passwords:** If your local PostgreSQL password includes special characters (`@`, `:`, `/`, `%`, `#`), percent-encode them to avoid connection string parser errors.
> 
> 

### 1.2 Option A: Docker Compose Workflow (Recommended)

The fastest way to spin up PostgreSQL (with PostGIS) and the backend:

```bash
# 1. Start backend and database services
docker compose up -d

# 2. Run migrations inside the backend container
docker compose exec backend npx prisma migrate deploy

# 3. Seed test data (Stops, Routes, Vehicles, Test Credentials)
docker compose exec backend npx prisma db seed

```

### 1.3 Option B: Bare-Metal Setup

Requires local Postgres with PostGIS installed.

```bash
npm install
npx prisma generate
npx prisma migrate dev
npx prisma db seed
npm run dev

```

**Verify Connection:** Run `curl http://localhost:5000/health`. Expect `{"status":"OK","database":"connected"}`.

---

## ☁️ Part 2: Deployed Staging Environment (Render & Neon)

The Sprint 2.5 shared staging environment is live and ready for frontend integration.

### 2.1 Staging Endpoints

* **Staging Backend URL:** `https://shuttle-bus-tracking-system.onrender.com`

* **Neon Database Host:** `ep-orange-firefly-b3vi3m1d-pooler.c-4.ap-southeast-1.aws.neon.tech`


### 2.2 Render Configuration

The backend runs on Render with these settings:

* **Build Command:** `npm install && npx prisma generate && npm run build`

* **Start Command:** `npm start`

* **Environment Variables:**
* `DATABASE_URL`: Your Neon connection string (must include `sslmode=require&channel_binding=require`)


* `PORT`: `10000`

* `JWT_SECRET`: Production secret string


* `CORS_ORIGIN`: `*` (Allows Vercel access)





---

## 🔑 Part 3: JWT Authentication Guide

The backend uses JSON Web Tokens (JWT) to securely authenticate vehicle devices.

### 3.1 Generating a Token

The database seed provides a test vehicle (`TS01` / `device123`). To get your token:

1. Send a `POST` request to `/api/auth/vehicle/login` (use `http://localhost:5000` for local, or the Render URL for staging).


2. **Payload:** `{"sourceId": "TS01", "secret": "device123"}`.


3. Copy the returned `token` string (starts with `eyJ...`).



*Tokens generated locally use your local `.env` secret; Render tokens use the cloud secret. They are not interchangeable.*

### 3.2 Using the Token

* **For REST API (Trips):** Pass in the header: `Authorization: Bearer <token>`.


* **For Socket.IO:** Pass in the handshake auth object:


```javascript
const socket = io("[https://shuttle-bus-tracking-system.onrender.com](https://shuttle-bus-tracking-system.onrender.com)", {
  auth: { token: "<your_token_here>" }
});

```



---

## 🔌 Part 4: REST API Reference

All endpoints accept and return JSON.

### 4.1 Core CRUD (No Auth Required)

| Resource | Method | Endpoint | Payload / Description |
| --- | --- | --- | --- |
| **Vehicles** | GET | `/api/vehicles` | List all vehicles.|
|  | POST | `/api/vehicles` | `{"id":"V05","name":"Van 5","type":"van","assignedRouteId":"R01"}`<br> |
| **Routes** | GET | `/api/routes` | List all routes. |
|  | POST | `/api/routes` | `{"id":"R04","name":"Green","color":"#00AA55"}`<br> |
|  | GET | `/api/routes/:id/stops` | Ordered list of stops on this route.|
|  | GET | `/api/routes/:id/geometry` | GeoJSON coordinate array. |
| **Stops** | GET | `/api/stops` | All stops with parsed `lat` and `lng`. |
|  | POST | `/api/stops` | `{"id":"S06","nameTh":"หน้าตึก 1","lat":13.9644,"lng":100.5871}`<br> |
| **RouteStops** | POST | `/api/route-stops` | `{"routeId":"R01","stopId":"S01","stopOrder":1}`<br> |

Standard `GET /:id`, `PUT /:id`, and `DELETE /:id` are supported across all CRUD resources.

### 4.2 Trip Lifecycle (Auth Required)

Requires `Authorization: Bearer <token>` header, except `/live`.

| Method | Endpoint | Body Payload | Description |
| --- | --- | --- | --- |
| **POST** | `/api/trips/start` | `{"routeId":"R01"}` | Starts trip (409 Conflict if already active).|
| **POST** | `/api/trips/:id/end` | None | Marks trip completed.|
| **GET** | `/api/trips/active` | None | Fetches calling device's active trip. |
| **GET** | `/api/trips/live` | None | Returns all active trips system-wide (No Auth). |

---

## 📡 Part 5: Socket.IO Real-Time Engine

### 5.1 Emitting GPS (Mobile -> Server)

Emitted by the authenticated vehicle tracker:

* **Event:** `location:update`

* **Payload:** `{"lat": 13.9644, "lng": 100.5871, "speed": 35.5, "heading": 180}`


### 5.2 Receiving GPS (Server -> Web Clients)

Listened to by Public Web and Admin Web map components:

* **Event:** `vehicle:location`

* **Payload Received:** `{"vehicleId": "V01", "lat": 13.9644, "lng": 100.5871, "speed": 35.5, "heading": 180, "updatedAt": "2026-10-10T15:40:00.000Z"}`


### 5.3 Local Socket Testing

1. Get a JWT using `POST /api/auth/vehicle/login`.


2. Open the included `socket-test.html` file in a browser.


3. Paste the token and server URL, then emit fake GPS updates to verify the broadcast pipeline.



---

## 🤝 Part 6: Stackforce Team Integration Tasks (Sprint 2.5)

To meet the definition of done, the target flow (`Mobile -> Backend -> GPS -> Public + Admin`) must be integrated against the staging environment.

### 📱 Mobile Developer Tasks

1. Point HTTP/Socket URLs to `https://shuttle-bus-tracking-system.onrender.com`.


2. Implement device login and securely pass the JWT into the Socket.IO handshake.


3. Manage trip states (`/api/trips/start` & `/end`).


4. Emit real GPS coordinates via the `location:update` socket event.



### 💻 Web Developers (Public & Admin)

1. Set `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_SOCKET_URL` to the Render backend.


2. Connect map components to Socket.IO and listen for `vehicle:location` broadcasts.


3. Improve dashboard layouts to ensure map visibility is the core focus.


4. Deploy both frontends to Vercel.



---

## ⚠️ Part 7: Troubleshooting

| Symptom | Root Cause | Solution |
| --- | --- | --- |
| `500 database: disconnected` | Invalid DB URL or DB offline | Check `DATABASE_URL` credentials. Ensure `sslmode=require` is set for Neon.|
| `table ... does not exist` | Missing schema migration | Run `npx prisma migrate dev` (local) or `npx prisma migrate deploy` (Docker/Render).|
| `Cannot find module '@prisma/client'` | Missing Prisma client | Run `npx prisma generate` before starting the server. |
| Real-time events fail silently | Auth failure | Verify valid JWT is sent inside `auth: { token: "..." }` during socket initialization. |

```

```
