# 🚌 RSU Shuttle Tracking System — Backend Engine

## 📖 Project Introduction
The RSU Shuttle Tracking System is a comprehensive, real-time transportation management platform designed to monitor, track, and display university shuttle buses (trams) as they navigate the campus. This repository houses the robust backend engine that powers the entire ecosystem, acting as the central bridge between physical tracking devices (or mobile apps), the public web interface, and the administrator dashboard.

## 🎯 Project Description
Built with a high-performance Node.js and Socket.IO stack, this backend securely authenticates hardware tracking devices and mobile simulators, ingests high-frequency GPS telemetry data, and instantly broadcasts those locations to connected web and mobile clients. Backed by a PostgreSQL database with PostGIS spatial extensions, the system natively handles complex geographical queries—such as fetching drawn route geometries and ordered stops—ensuring the frontend map visualizations are smooth and accurate. 

### Tech Stack
* **Runtime:** Node.js (TypeScript)
* **Framework:** Express.js
* **Database:** PostgreSQL with PostGIS extension
* **ORM:** Prisma
* **Real-Time Engine:** Socket.IO
* **Security:** JWT (JSON Web Tokens)

---

## 🚀 Sprint Achievements

### Sprint 1: Core Architecture & Database Foundations
* **Schema Design:** Architected the relational database schema utilizing Prisma, defining relationships between `Routes`, `Stops`, `Vehicles`, `Trips`, and `TrackingSources`.
* **Spatial Data Integration:** Configured PostgreSQL with the PostGIS extension to handle actual geographic coordinates (`Unsupported("geography")` in Prisma) for accurate map rendering.
* **Seed Data:** Created foundational seed scripts to populate the system with active routes, ordered stops, dummy vehicles, and administrative test credentials.

### Sprint 2: Real-Time Tracking & API Integration
* **Device Authentication:** Implemented secure JWT login (`/api/auth/vehicle/login`) to ensure only authorized vehicles can push GPS updates.
* **Trip Lifecycle Management:** Built robust guardrails preventing simultaneous trips (`/api/trips/start` and `/end`) and enabling active vehicle polling (`/api/trips/live`).
* **Socket.IO Pipeline:** Engineered a two-way WebSockets connection for sub-second, real-time GPS tracking. The server catches `location:update` events from devices and broadcasts `vehicle:location` events to web dashboards.
* **Map Visualization APIs:** Added raw SQL query endpoints utilizing PostGIS `ST_AsGeoJSON` to extract precise route drawings for the frontend map interfaces.

---

## 🛠️ Local Setup & Installation

### Prerequisites
* Node.js (v18 or higher)
* PostgreSQL database with the **PostGIS** extension installed and enabled.

### Step 1: Environment Configuration
Create a `.env` file in the root directory. Add the following keys:
```env
DATABASE_URL="postgresql://postgres:<password>@localhost:5432/shuttle_tracking"
PORT=5000
JWT_SECRET="your-secure-random-jwt-secret"

```

### Step 2: Install Dependencies

```bash
npm install

```

### Step 3: Database Setup & Seeding

Apply the migrations (including the PostGIS `geometry` column) and populate the database with default test data.

```bash
npx prisma migrate dev
npx prisma db seed

```

*Note: The seed script provides a test vehicle device (sourceId: `TS01`, secret: `device123`).*

### Step 4: Start the Server

```bash
npm run dev

```

The REST API and Socket.IO server will start on `http://localhost:5000`.

---

## 🔌 REST API Reference

### Authentication & Trips (Mobile App & Simulator)

*Protected endpoints require the `Authorization: Bearer <token>` header.*

| Method | Endpoint | Auth | Body Payload | Description |
| --- | --- | --- | --- | --- |
| **POST** | `/api/auth/vehicle/login` | None | `{ "sourceId": "...", "secret": "..." }` | Authenticates a vehicle tracking device and returns a JWT token. |
| **POST** | `/api/trips/start` | Device | `{ "routeId": "..." }` | Starts a new trip. Returns `409 Conflict` if the vehicle is already driving. |
| **POST** | `/api/trips/:id/end` | Device | *None* | Marks a specific trip status as `completed` and sets the `endTime`. |
| **GET** | `/api/trips/active` | Device | *None* | Checks if the requesting device currently has an `in_progress` trip. |
| **GET** | `/api/trips/live` | None | *None* | Returns a list of all vehicles across the system currently on an active trip. |

### Map Visualization (Public Web & Admin Dashboard)

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

### Emitting Data (Vehicle Tracking)

Authenticated devices ping this event to update their location.

* **Event:** `location:update`
* **Payload:** `{ "lat": 13.9644, "lng": 100.5871, "speed": 45, "heading": 90 }`

### Listening for Data (Map Dashboards)

Clients listen to this broadcast to update vehicle markers on the map in real-time.

* **Event:** `vehicle:location`
* **Payload Received:** `{ "vehicleId": "V01", "lat": 13.9644, "lng": 100.5871, "speed": 45, "heading": 90, "updatedAt": "2026-09-26T..." }`

---

## 🧪 Testing Real-Time Sockets

A `test-socket.html` file is included in the root of the repository so developers can quickly verify the Socket.IO broadcasts without needing to build a frontend first.

1. Generate a JWT token using the `POST /api/auth/vehicle/login` endpoint (use `TS01` and `device123`).
2. Open the `test-socket.html` file in any web browser.
3. Paste your token into the designated variable in the file and save.
4. Click the **"Send Fake GPS Ping"** button to emit a `location:update` event to the server.
5. Watch the live feed instantly display the broadcasted `vehicle:location` data, confirming the two-way real-time pipeline is fully operational.

```

```
