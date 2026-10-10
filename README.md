# 🚍 Shuttle Tracking System

This document is the unified technical integration and development manual for the **Shuttle Tracking System** backend, consolidating Sprint 1 baseline CRUD operations, Sprint 2 real-time WebSocket pipelines, and Sprint 2.5 cloud deployment.

---

## 🛠️ Tech Stack & Architecture

- **Runtime & Language:** Node.js (v18+) with TypeScript (`ts-node-dev` for local dev, `tsc` for production build)
- **API Framework:** Express.js
- **Real-Time Engine:** Socket.IO
- **ORM & Migrations:** Prisma Client (with PostgreSQL driver adapter)
- **Database Engine:** PostgreSQL 14+ with PostGIS extension (`geography` & `geometry` support)
- **Cloud Infrastructure:**
  - **Database:** Neon Serverless PostgreSQL
  - **Backend Hosting:** Render Web Service
  - **Frontend Staging:** Vercel

---

## 💻 Part 1: Local Development & Database Usage

Use this section to run the database and backend directly on your development machine, either via bare-metal Node.js or Docker Compose.

### 1.1 Local Environment Variables (`.env`)
Create a `.env` file in the project root:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/shuttle_tracking"
PORT=5000
JWT_SECRET="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.devSecretTokenForLocalTesting"
CORS_ORIGIN="*"

```

> **Note on Special Characters:** If your local PostgreSQL password includes special characters (`@`, `:`, `/`, `%`, `#`), percent-encode them or use an alphanumeric password to avoid connection string parser errors.

### 1.2 Option A: Docker Compose Workflow (Recommended)

The fastest way to spin up both PostgreSQL (with PostGIS) and the backend service:

```bash
# Start backend and database services
docker compose up -d

# Run migrations inside the backend container
docker compose exec backend npx prisma migrate deploy

# Seed test data (Stops, Routes, Vehicles, Test Credentials)
docker compose exec backend npx prisma db seed

```

### 1.3 Option B: Bare-Metal Setup

```bash
# 1. Install dependencies
npm install

# 2. Generate Prisma Client
npx prisma generate

# 3. Apply schema migrations
npx prisma migrate dev

# 4. Seed the database
npx prisma db seed

# 5. Start development server with hot-reload
npm run dev

```

### 1.4 How to Use Local Database & Backend

* **Base URL:** `http://localhost:5000`
* **Health Check Verification:**
```bash
curl http://localhost:5000/health
# Response: {"status":"OK","database":"connected"}

```


*(Returns 200 OK and confirms connection to local PostgreSQL).*
* **PostGIS Geographic Data Handling:** Stop locations use PostGIS `geography` types (`Unsupported("geography")` in schema). Spatial writes and queries use raw SQL (`ST_MakePoint`, `ST_X`, `ST_Y`) rather than standard Prisma object methods.

---

## ☁️ Part 2: Deployed Staging Environment (Render & Neon)

Use this section to connect frontend clients (Public Web, Admin Web) and Mobile devices to the shared staging infrastructure.

### 2.1 Staging Infrastructure Endpoints

* **Staging Backend URL:** `https://<your-render-service-name>.onrender.com`
* **Neon Cloud Database Host:** `ep-orange-firefly-b3vi3m1d-pooler.c-4.ap-southeast-1.aws.neon.tech`

### 2.2 Render Web Service Configuration Reference

The staging backend runs on Render configured with the following parameters:

* **Environment:** `Node`
* **Build Command:**
```bash
npm install && npx prisma generate && npm run build

```


* **Start Command:**
```bash
npm start

```


*(Executes `node dist/src/server.js`)*

#### Render Environment Variables:

| Variable Key | Purpose & Value Description |
| --- | --- |
| `DATABASE_URL` | Neon pooled connection string with `sslmode=require&channel_binding=require` |
| `PORT` | Set to `10000` (Render default port) |
| `JWT_SECRET` | Secret key used to sign and verify vehicle/device tokens |
| `CORS_ORIGIN` | Set to `*` for staging cross-origin requests from Vercel |

### 2.3 How to Connect to the Deployed Backend & Database

* **Web Frontend (`public-web`, Admin Web):** In your frontend `.env.local` or Vercel dashboard, point the API and socket base URLs to Render:
```env
NEXT_PUBLIC_API_URL="https://<your-render-service-name>.onrender.com"
NEXT_PUBLIC_SOCKET_URL="https://<your-render-service-name>.onrender.com"

```


* **Mobile App:** Point your HTTP client and Socket.IO client base URLs to the Render URL instead of local IP/localhost.
* **Cold Starts Notice:** Render free instances spin down following periods of inactivity; the initial connection may take up to 50 seconds to complete while the container spins up.

---

## 🔌 Part 3: Complete REST API Reference

All requests accept and return JSON (`Content-Type: application/json`).

### 3.1 System & Authentication

| Method | Endpoint | Auth Required | Body / Params | Description |
| --- | --- | --- | --- | --- |
| **GET** | `/health` | None | None | Checks server and database connectivity. |
| **POST** | `/api/auth/vehicle/login` | None | `{"sourceId": "TS01", "secret": "device123"}` | Device login; returns a signed JWT. |

### 3.2 Vehicle Management (`/api/vehicles`)

| Method | Endpoint | Auth | Body Payload | Description |
| --- | --- | --- | --- | --- |
| **GET** | `/api/vehicles` | None | None | Returns list of all vehicles. |
| **GET** | `/api/vehicles/:id` | None | None | Fetch single vehicle details. |
| **POST** | `/api/vehicles` | None | `{"id":"V05","name":"Van 5","type":"van","assignedRouteId":"R01"}` | Register new vehicle. |
| **PUT** | `/api/vehicles/:id` | None | `{"status":"inactive"}` | Update vehicle info/status. |
| **DELETE** | `/api/vehicles/:id` | None | None | Remove vehicle record. |

### 3.3 Route Management (`/api/routes`)

| Method | Endpoint | Auth | Body Payload | Description |
| --- | --- | --- | --- | --- |
| **GET** | `/api/routes` | None | None | Returns list of all routes. |
| **GET** | `/api/routes/:id` | None | None | Fetch specific route details. |
| **POST** | `/api/routes` | None | `{"id":"R04","name":"Green Line","color":"#00AA55"}` | Create route (`color` must be hex). |
| **PUT** | `/api/routes/:id` | None | `{"name":"Updated Name"}` | Update route details. |
| **DELETE** | `/api/routes/:id` | None | None | Delete a route. |
| **GET** | `/api/routes/:id/stops` | None | None | Ordered list of stops on this route. |
| **GET** | `/api/routes/:id/geometry` | None | None | Route line GeoJSON coordinate array. |

### 3.4 Stop Management (`/api/stops`)

| Method | Endpoint | Auth | Body Payload | Description |
| --- | --- | --- | --- | --- |
| **GET** | `/api/stops` | None | None | All stops with parsed `lat` and `lng`. |
| **GET** | `/api/stops/:id` | None | None | Fetch single stop details. |
| **POST** | `/api/stops` | None | `{"id":"S06","nameTh":"หน้าตึก 1","lat":13.9644,"lng":100.5871}` | Create stop (valid coordinates required). |
| **PUT** | `/api/stops/:id` | None | `{"nameEn":"Building 1"}` | Update stop metadata. |
| **DELETE** | `/api/stops/:id` | None | None | Delete stop (fails with 409 if linked). |

### 3.5 Route Stop Assignment (`/api/route-stops`)

| Method | Endpoint | Auth | Body Payload | Description |
| --- | --- | --- | --- | --- |
| **GET** | `/api/route-stops` | None | Optional query: `?routeId=R01` | Get route stop associations. |
| **POST** | `/api/route-stops` | None | `{"routeId":"R01","stopId":"S01","stopOrder":1}` | Link stop to route at specific sequence. |
| **PUT** | `/api/route-stops/:id` | None | `{"stopOrder":2}` | Update sequence order. |
| **DELETE** | `/api/route-stops/:id` | None | None | Unlink stop from route. |

### 3.6 Trip Lifecycle (`/api/trips`)

*Device-authenticated routes require header: `Authorization: Bearer <token>*`

| Method | Endpoint | Auth | Body Payload | Description |
| --- | --- | --- | --- | --- |
| **POST** | `/api/trips/start` | Bearer | `{"routeId":"R01"}` | Starts trip (409 Conflict if active). |
| **POST** | `/api/trips/:id/end` | Bearer | None | Marks trip completed with `endTime`. |
| **GET** | `/api/trips/active` | Bearer | None | Fetches calling device's active trip. |
| **GET** | `/api/trips/live` | None | None | Returns all active trips system-wide. |

---

## 📡 Part 4: Socket.IO Real-Time Engine

The real-time WebSocket server operates alongside the HTTP server on the same port.

### 4.1 Connection & Handshake Authentication

Mobile tracking devices must authenticate using their JWT token during connection handshake:

```javascript
import { io } from "socket.io-client";

const socket = io("https://<your-render-service-name>.onrender.com", {
  auth: {
    token: "YOUR_DEVICE_JWT_TOKEN"
  }
});

```

### 4.2 Events & Payloads

#### 1. Vehicle Telemetry Ping (Mobile -> Server)

Emitted by authenticated vehicle tracker:

* **Event:** `location:update`
* **Payload:**
```json
{
  "lat": 13.9644,
  "lng": 100.5871,
  "speed": 35.5,
  "heading": 180
}

```



#### 2. Vehicle Location Broadcast (Server -> Web Clients)

Listened to by Public Web and Admin Web map components:

* **Event:** `vehicle:location`
* **Payload Received:**
```json
{
  "vehicleId": "V01",
  "lat": 13.9644,
  "lng": 100.5871,
  "speed": 35.5,
  "heading": 180,
  "updatedAt": "2026-10-10T15:40:00.000Z"
}

```



### 4.3 Verifying Sockets Locally

Use the bundled `socket-test.html` file in the project root:

1. Log in via `POST /api/auth/vehicle/login` with `TS01` / `device123` to get a JWT.
2. Open `socket-test.html` in a web browser.
3. Paste the token and server URL (`http://localhost:5000` or Render staging URL).
4. Emit location updates and inspect the real-time reception logs.

---

## ⚠️ Troubleshooting & Common Pitfalls

| Error / Symptom | Root Cause | Solution |
| --- | --- | --- |
| `500 database: disconnected` | Invalid connection URL or DB offline | Verify `DATABASE_URL` credentials and ensure SSL mode is active (`sslmode=require`). |
| `table ... does not exist` | Missing migration run | Run `npx prisma migrate dev` (local) or `npx prisma migrate deploy` (Neon/Docker). |
| `Cannot find module '@prisma/client'` | Prisma client not generated | Execute `npx prisma generate` before compilation. |
| Render deploy timeout or crash | Missing build artifact or start script | Verify `Build Command` includes `npm run build` and `Start Command` is `npm start`. |
| Real-time events fail silently on mobile | Socket handshake unauthorized | Verify valid JWT is sent under `auth: { token }` property during socket connection. |

```

```
