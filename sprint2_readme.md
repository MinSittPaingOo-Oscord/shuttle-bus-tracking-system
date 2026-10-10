# RSU Shuttle Tracking System — Backend Integration Guide

This document serves as the backend integration manual. The backend is fully prepped to handle secure device authentication, trip lifecycle management, PostGIS route geometry, and a high-performance Socket.IO real-time engine.

---

## 🚀 1. Local Setup & Installation

Follow these steps to get the backend running on your local machine.

### Prerequisites
* Node.js (v18 or higher)
* PostgreSQL database with the **PostGIS** extension installed and enabled.

### Step 1: Environment Configuration
Create a `.env` file in the root of the backend directory (where `package.json` is located). Add the following keys, ensuring each is on its own line:
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

Apply the database schema migrations (which includes the PostGIS `geometry` column) and populate the database with required default data (Routes, Stops, Vehicles, and Test Credentials).

```bash
npx prisma migrate dev
npx prisma db seed

```

*Note: The seed script provides a test vehicle device (sourceId: `TS01`, secret: `device123`) and an admin user (username: `admin`, password: `admin123`).*

### Step 4: Start the Server

```bash
npm run dev

```

The server (REST API and Socket.IO) will start on `http://localhost:5000`.

---

## 🔌 2. REST API Reference

### Authentication & Trips

*Protected endpoints require the `Authorization: Bearer <token>` header.*

| Method | Endpoint | Auth | Body Payload | Description |
| --- | --- | --- | --- | --- |
| **POST** | `/api/auth/vehicle/login` | None | `{ "sourceId": "...", "secret": "..." }` | Authenticates a vehicle tracking device and returns a JWT token. |
| **POST** | `/api/trips/start` | Device | `{ "routeId": "..." }` | Starts a new trip. Returns `409 Conflict` if the vehicle is already driving. |
| **POST** | `/api/trips/:id/end` | Device | *None* | Marks a specific trip status as `completed` and sets the `endTime`. |
| **GET** | `/api/trips/active` | Device | *None* | Checks if the requesting device currently has an `in_progress` trip. |
| **GET** | `/api/trips/live` | None | *None* | Returns a list of all vehicles across the system currently on an active trip. |

### Map Visualization

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| **GET** | `/api/routes/:id/stops` | None | Returns the list of stops for a specific route, ordered by `stopOrder`. |
| **GET** | `/api/routes/:id/geometry` | None | Returns the GeoJSON coordinate array representing the drawn route line. |

---

## 📡 3. Socket.IO Real-Time Engine

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

## 🧪 4. Testing Real-Time Sockets

A `test-socket.html` file is included in the root of the repository so developers can quickly verify the Socket.IO broadcasts without needing to build a frontend first.

1. Generate a JWT token using the `POST /api/auth/vehicle/login` endpoint.
2. Open the `test-socket.html` file in any web browser.
3. Paste your token into the designated variable in the file.
4. Click the **"Send Fake GPS Ping"** button to emit a `location:update` event to the server.
5. Watch the live feed instantly display the broadcasted `vehicle:location` data, confirming the two-way real-time pipeline is fully operational.

```

```
