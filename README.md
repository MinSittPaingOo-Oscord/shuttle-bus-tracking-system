
# 🚍 RSU Shuttle Tracking System
### StackForce — Full Project Overview

Real-time university shuttle tracking system for Rangsit University (RSU).  
Drivers / devices send live GPS → Backend broadcasts → Public web map + Admin tools show vehicles in real time.  
Also supports multi-device GPS accuracy comparison (ESP32, LoRaWAN, Mobile).

---

## 🏗 System Architecture

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
│  Mobile App     │     │  ESP32 / LoRaWAN     │     │  Public Web (Next)  │
│  (Flutter)      │     │  Hardware Devices    │     │  + Admin views      │
└────────┬────────┘     └──────────┬───────────┘     └──────────▲──────────┘
         │  JWT + GPS              │  GPS readings              │
         │  Socket.IO              │  REST                      │ Socket.IO
         ▼                         ▼                            │  vehicle:location
┌────────────────────────────────────────────────────────────────┴──────────┐
│                         Backend (Express + Socket.IO)                     │
│  • Auth (JWT for devices)                                                 │
│  • Trip lifecycle                                                         │
│  • CRUD (Routes / Stops / Vehicles)                                       │
│  • Real-time location broadcast                                           │
│  • Hardware GPS Comparison API                                            │
└───────────────────────────────────┬───────────────────────────────────────┘
                                    │
                                    ▼
                         Neon PostgreSQL + PostGIS
```

---

## 📦 Repository Structure

```
StackForce_Shuttle-Bus-Project/
├── src/                     # Backend (Express + TypeScript)
├── prisma/                  # Schema, migrations, seed
├── public-web/              # Next.js public map frontend
├── mobile/                  # Flutter driver / tracker app
├── socket-test.html         # Quick Socket.IO test page
├── docker-compose.yml
├── Backend_Sprint1_README.md
├── Backend_Sprint2_README.md
├── Backend_Sprint2.5_README.md
└── README.md                # ← this file
```

---

## 🛠 Tech Stack

| Layer              | Technology                                      |
|--------------------|-------------------------------------------------|
| Backend            | Node.js 18+, Express, TypeScript, Socket.IO     |
| ORM / DB           | Prisma + PostgreSQL 14+ with PostGIS            |
| Database (Staging) | Neon Serverless PostgreSQL                      |
| Backend Hosting    | Render                                          |
| Public Web         | Next.js 16, React 19, Leaflet / react-leaflet   |
| Mobile             | Flutter (geolocator + socket_io_client)         |
| Auth               | JWT (device login) + bcrypt                     |
| Real-time          | Socket.IO (`location:update` → `vehicle:location`) |

---

## 🌐 Staging Environment (Current)

| Service          | URL / Host                                                                 |
|------------------|----------------------------------------------------------------------------|
| Backend API      | https://shuttle-bus-tracking-system.onrender.com                           |
| Socket.IO        | same host (wss)                                                            |
| Database         | Neon (`ep-orange-firefly-b3vi3m1d-pooler...`)                              |
| Public Web       | Deploy to Vercel (point `NEXT_PUBLIC_API_BASE_URL` to Render)              |

**Health check**
```bash
curl https://shuttle-bus-tracking-system.onrender.com/health
# → {"status":"OK","database":"connected"}
```

---

## 🔑 Test Credentials (after seeding)

| Role            | Credentials                          | Notes                                      |
|-----------------|--------------------------------------|--------------------------------------------|
| Admin           | `admin` / `admin123`                 | Admin authentication                       |
| Test Device     | `sourceId: TS01` / `secret: device123` | Used for mobile + Socket.IO testing       |
| Vehicle linked  | `VH001`                              | TS01 is linked to this vehicle             |

Login example:
```bash
curl -X POST https://shuttle-bus-tracking-system.onrender.com/api/auth/vehicle/login \
  -H "Content-Type: application/json" \
  -d '{"sourceId":"TS01","secret":"device123"}'
```

---

## 🗺 Current Master Data (from seed)

**Routes**
- `R01` — วนภายในมหาลัย (active)
- `R02` — สถานีรถไฟ-มหาลัย (active)
- `R03` — มหาลัย-ฟิวเจอร์ (inactive)

**Vehicles**
- `VH001`, `VH002`, `VH003` → assigned to R01
- `VN001`, `VN002` → assigned to R02

**Stops**
- `ST001` … `ST017` (full campus + train station)

**Tracking Sources**
- Mobile, ESP32, and LoRaWAN devices (plus test device `TS01`)

> Important: Older documentation sometimes used `V01` / `V03` / `S01`.  
> Current production data uses the IDs above (`VH001`, `ST001`, etc.).

---

## 🚀 Quick Start

### 1. Backend (Local)

```bash
# Prerequisites: Node 18+, PostgreSQL + PostGIS

cp .env.example .env
# Edit DATABASE_URL, JWT_SECRET, PORT=5000

npm install
npx prisma generate
npx prisma migrate dev
npx prisma db seed          # or: npx ts-node prisma/seed.ts

npm run dev
# → http://localhost:5000
```

Docker alternative:
```bash
docker compose up -d
docker compose exec backend npx prisma migrate deploy
docker compose exec backend npx prisma db seed
```

### 2. Public Web (Next.js)

```bash
cd public-web
npm install
# Create .env.local
# NEXT_PUBLIC_API_BASE_URL=http://localhost:5000
# (or the Render URL for staging)

npm run dev
# → http://localhost:3000
```

Main features (Sprint 1):
- Load routes
- Select route → show ordered stops
- Display stops on map (Leaflet)

### 3. Mobile (Flutter)

```bash
cd mobile
flutter pub get
flutter run
```

Key packages:
- `geolocator` — GPS
- `socket_io_client` — real-time
- `http` — REST (login, start/end trip)

Flow the mobile app must implement:
1. Login with `sourceId` + `secret` → receive JWT
2. Connect Socket.IO with `auth: { token }`
3. `POST /api/trips/start` with `routeId`
4. Emit `location:update` periodically
5. `POST /api/trips/:id/end` when finished

---

## 📡 Core Real-time Contract

**Device → Server**
```js
socket.emit("location:update", {
  lat: 13.9644,
  lng: 100.5871,
  speed: 35.5,
  heading: 180
});
```

**Server → Web clients**
```js
socket.on("vehicle:location", (data) => {
  // { vehicleId, lat, lng, speed, heading, updatedAt }
});
```

---

## 🚌 Trip Lifecycle (Device)

1. Login → JWT
2. `POST /api/trips/start` `{ "routeId": "R01" }`
3. Emit GPS via Socket.IO
4. `POST /api/trips/:id/end`
5. `GET /api/trips/live` (public) shows all active vehicles

---

## 🔧 Hardware GPS Comparison (Sprint Hardware)

Endpoints under `/api/comparison`:

| Method | Endpoint                    | Purpose                                      |
|--------|-----------------------------|----------------------------------------------|
| POST   | `/api/comparison/reset`     | Clear previous test readings for a vehicle   |
| POST   | `/api/comparison/readings`  | Ingest reading from ESP32 / LORAWAN / MOBILE |
| GET    | `/api/comparison`           | Time-window comparison + meter differences   |

**Important:** Always pass a real vehicle ID, e.g.:
```
?vehicleId=VH001
```
(Do not rely on the old default `V03`.)

Typical field test flow:
1. `GET /health` (wake Render)
2. `POST /api/comparison/reset`
3. Send readings from one device at a time along the same path
4. `GET /api/comparison?vehicleId=VH001&windowSeconds=30`

---

## 📚 Sprint History

| Sprint       | Focus                                                                 |
|--------------|-----------------------------------------------------------------------|
| **Sprint 1** | Backend CRUD (Routes, Stops, Vehicles, RouteStops) + Public Web map   |
| **Sprint 2** | Trip lifecycle + Socket.IO real-time location pipeline                |
| **Sprint 2.5**| Neon + Render staging, frontend/mobile integration against cloud      |
| **Hardware** | Multi-device GPS comparison (ESP32 / LoRaWAN / Mobile)                |

Detailed backend docs:
- `Backend_Sprint1_README.md`
- `Backend_Sprint2_README.md`
- `Backend_Sprint2.5_README.md`

---

## ⚠️ Common Gotchas

1. **Vehicle & Stop IDs changed**  
   Use `VH001`, `ST001`, etc. (not the old `V01` / `S01`).

2. **Hardware comparison default**  
   Old docs used `V03`. Always pass `vehicleId=VH001` (or another existing ID).

3. **Render cold start**  
   Free tier sleeps. Call `/health` first and wait ~30–60 s.

4. **PostGIS stops**  
   Stops use `geography`. Seed and stop routes use raw SQL (`ST_MakePoint`).

5. **JWT is environment-specific**  
   Token from local backend will not work on Render (different `JWT_SECRET`).

6. **Socket auth**  
   Must pass token in handshake:
   ```js
   io(url, { auth: { token: "..." } })
   ```

---

## 👥 Team Integration Checklist

**Mobile**
- [ ] Point to Render URL
- [ ] Device login + store JWT
- [ ] Socket.IO with auth token
- [ ] Start / End trip
- [ ] Emit real GPS

**Public Web**
- [ ] `NEXT_PUBLIC_API_BASE_URL` → Render
- [ ] Load routes + ordered stops
- [ ] Listen to `vehicle:location` and move markers
- [ ] Deploy to Vercel

**Backend / Data**
- [ ] Neon seeded with latest master data
- [ ] Test device `TS01` / `device123` works
- [ ] Comparison endpoints tested with real vehicle IDs

---

## 📄 License & Team

Internal project — StackForce team (RSU Shuttle Tracking).

For questions about a specific layer, see the corresponding README inside each folder or the Sprint documents listed above.
