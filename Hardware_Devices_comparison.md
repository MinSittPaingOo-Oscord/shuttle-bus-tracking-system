# Hardware GPS Comparison API Documentation

This documentation covers the production API endpoints, payload formats, and step-by-step workflow for recording and comparing GPS accuracy across **ESP32**, **LoRaWAN**, and **Mobile** tracking devices.

---

## 1. System Overview & Base Configuration

* **Production Base URL:** `[https://shuttle-bus-tracking-system.onrender.com](https://shuttle-bus-tracking-system.onrender.com)`


* **Comparison Route Base:** `[https://shuttle-bus-tracking-system.onrender.com/api/comparison](https://shuttle-bus-tracking-system.onrender.com/api/comparison)`


* **Database Storage:** Readings are stored directly in the production **Neon PostgreSQL** database using the existing PostGIS `gps_tracks` and `tracking_sources` tables.


* **How Sequential (One-by-One) Matching Works:** Because hardware devices are tested one after another rather than simultaneously, the backend aligns readings using **relative time windows** (`+00:00`, `+00:30`, `+01:00`, etc.). Each device's very first reading in a test session sets its own `T+00:00` baseline, allowing readings captured 10 or 20 minutes apart to be compared side-by-side in the same time bucket.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Wakes up the Render server and verifies Neon database connectivity. |
| `POST` | `/api/comparison/reset` | Clears previous test readings for a vehicle before starting a new hardware test. |
| `POST` | `/api/comparison/readings` | Ingests a live GPS coordinate from `ESP32`, `LORAWAN`, or `MOBILE`. |
| `GET` | `/api/comparison` | Returns the time-window comparison report and pairwise meter differences. |
| `POST` | `/api/comparison/seed-demo` | Populates demo data into `gps_tracks` for offline/UI testing.|

---

## 2. Endpoint Reference

### 2.1 Clear Previous Test Data (`POST /api/comparison/reset`)

Call this endpoint **before starting a new hardware test session** so old coordinates do not shift the `T+00:00` baseline.

* **URL:** `[https://shuttle-bus-tracking-system.onrender.com/api/comparison/reset](https://shuttle-bus-tracking-system.onrender.com/api/comparison/reset)`
* **Method:** `POST`
* **Headers:** `Content-Type: application/json`
* **Request Body (Optional):**
```json
{
  "vehicleId": "V03"
}

```


* **Success Response (`200 OK`):**
```json
{
  "message": "Cleared comparison readings for vehicle V03"
}

```



---

### 2.2 Send Live Hardware GPS Reading (`POST /api/comparison/readings`)

Your ESP32 firmware, LoRaWAN webhook/script, and Mobile client send GPS data to this endpoint. It automatically links the reading to an active trip in `trips`, registers the device in `tracking_sources`, and writes the PostGIS `geography` point into `gps_tracks`.

* **URL:** `[https://shuttle-bus-tracking-system.onrender.com/api/comparison/readings](https://shuttle-bus-tracking-system.onrender.com/api/comparison/readings)`
* **Method:** `POST`
* **Headers:** `Content-Type: application/json`
* **Request Body Parameters:**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `vehicleId` | `string` | Optional | Vehicle ID in the database (defaults to `"V03"`). |
| `source` | `string` | **Required** | Must be `"ESP32"`, `"LORAWAN"`, or `"MOBILE"` (case-insensitive). |
| `latitude` | `number` | **Required** | Decimal latitude (e.g., `13.964000`). Use at least 5–6 decimal places. |
| `longitude` | `number` | **Required** | Decimal longitude (e.g., `100.585000`). Use at least 5–6 decimal places. |
| `speed` | `number` | Optional | Speed in km/h (defaults to `0`). |
| `timestamp` | `string` | Optional | ISO-8601 timestamp (defaults to server time `NOW()` if omitted). |

* **Example Request Body:**
```json
{
  "vehicleId": "V03",
  "source": "ESP32",
  "latitude": 13.964000,
  "longitude": 100.585000,
  "speed": 25.5
}

```


* **Success Response (`201 Created`):**
```json
{
  "message": "Reading saved to gps_tracks",
  "data": {
    "vehicleId": "V03",
    "tripId": "4047a1f2-4252-47c2-bca3-9100f2482cc2",
    "source": "ESP32",
    "latitude": 13.964,
    "longitude": 100.585,
    "speed": 25.5,
    "recordedAt": "2026-11-13T08:00:00.000Z"
  }
}

```



---

### 2.3 Get Comparison Report (`GET /api/comparison`)

Retrieves all readings for the vehicle, buckets them into relative time windows, calculates pairwise Haversine distances in meters, and flags whether all 3 devices reported within each window.

* **URL:** `[https://shuttle-bus-tracking-system.onrender.com/api/comparison?vehicleId=V03&windowSeconds=30](https://shuttle-bus-tracking-system.onrender.com/api/comparison?vehicleId=V03&windowSeconds=30)`
* **Method:** `GET`
* **Query Parameters:**

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `vehicleId` | `string` | First vehicle (`V03`) | The vehicle ID to query.|
| `windowSeconds` | `number` | `30` | Size of each relative time bucket in seconds (e.g., `30`, `15`, `60`). |

* **Success Response (`200 OK`):**
```json
{
  "vehicleId": "V03",
  "windowSeconds": 30,
  "rows": [
    {
      "time": "+00:30",
      "lorawan": null,
      "esp32": { "lat": 13.962, "lng": 100.582 },
      "mobile": { "lat": 13.962025, "lng": 100.582015 },
      "distances": {
        "lorawan_esp32": null,
        "esp32_mobile": 3.2,
        "lorawan_mobile": null
      },
      "maxDiffMeters": 3.2,
      "status": "Incomplete Data"
    },
    {
      "time": "+00:00",
      "lorawan": { "lat": 13.96402, "lng": 100.585015 },
      "esp32": { "lat": 13.964, "lng": 100.585 },
      "mobile": { "lat": 13.964035, "lng": 100.58501 },
      "distances": {
        "lorawan_esp32": 2.8,
        "esp32_mobile": 4,
        "lorawan_mobile": 1.8
      },
      "maxDiffMeters": 4,
      "status": "Complete"
    }
  ]
}

```



---

## 3. Step-by-Step Field Testing Workflow (Sequential Testing)

Because you will connect and test one hardware device at a time, follow this exact sequence during field testing so your time windows (`+00:00`, `+00:30`, `+01:00`) align accurately:

### Step 1: Wake Up the Render Server

Render's free instance spins down after inactivity and can take ~50 seconds to wake up on the first request. Before turning on your hardware, send a `GET` request in your browser or Thunder Client:

```text
GET https://shuttle-bus-tracking-system.onrender.com/health

```

Wait until you receive `{"status": "OK", "database": "connected"}`.

### Step 2: Reset the Vehicle's Comparison Data

Clear any previous mock or test runs for `V03`:

```text
POST https://shuttle-bus-tracking-system.onrender.com/api/comparison/reset

```

### Step 3: Test Device 1 (`ESP32`)

1. Power on the ESP32 and wait until the GPS module gets a valid satellite lock (do not send `0.0, 0.0` coordinates).
2. Configure the ESP32 to send a `POST` request to `/api/comparison/readings` with `"source": "ESP32"` every **10 to 15 seconds** (or once every **30 seconds**).
3. Stand at your starting point (or walk/drive your test path) for a fixed duration (e.g., 2 minutes = four 30-second windows: `+00:00`, `+00:30`, `+01:00`, `+01:30`).
4. Power off or disconnect the ESP32.

### Step 4: Test Device 2 (`LORAWAN`)

1. Move back to the **exact same starting point** used in Step 3.
2. Connect the LoRaWAN device and wait for a valid GPS lock.
3. Have it post to `/api/comparison/readings` with `"source": "LORAWAN"` at the same interval along the same path/duration.
4. Disconnect the LoRaWAN device.

### Step 5: Test Device 3 (`MOBILE`)

1. Return to the **exact same starting point**.
2. Start the Mobile tracker posting to `/api/comparison/readings` with `"source": "MOBILE"` along the same path/duration.

### Step 6: Fetch the Final Comparison Results

Open your browser or Thunder Client and query:

```text
GET https://shuttle-bus-tracking-system.onrender.com/api/comparison?vehicleId=V03&windowSeconds=30

```

---

## 4. Important Hardware Implementation Notes

* **GPS Fix Check on Arduino/ESP32:** Always check `gps.location.isValid()` (if using `TinyGPS++`) before firing the HTTP `POST` request. If the ESP32 sends an invalid reading before locking onto satellites, that invalid coordinate will become your `+00:00` baseline.
* **Transmission Interval vs. `windowSeconds`:** If multiple readings from the same device arrive within the same 30-second bucket (for example, at `+00:05`, `+00:15`, and `+00:25`), the backend automatically keeps the **latest reading** inside that bucket for that device. Sending once every **15 seconds** or **20 seconds** guarantees you never miss a 30-second bucket due to network lag.
* **HTTPS on ESP32:** Because Render uses `https://`, use `WiFiClientSecure` in your ESP32 code with `client.setInsecure()` so the microcontroller does not reject Render's SSL certificate without needing to hardcode root CA certificates.
