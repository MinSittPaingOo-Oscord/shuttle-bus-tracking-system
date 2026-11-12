import { Router, Request, Response } from 'express';
import prisma from '../config/prisma';

const router = Router();

type Point = { lat: number; lng: number };
type BucketSources = {
  LORAWAN: Point | null;
  ESP32: Point | null;
  MOBILE: Point | null;
};

// Haversine formula: distance between two GPS coordinates in meters
function getDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  return Number((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1));
}

// Format relative seconds (0, 30, 60...) as "+MM:SS"
function formatRelativeWindow(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `+${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// Helper: Ensure a valid vehicle and active trip exist
async function ensureVehicleAndTrip(requestedVehicleId?: string) {
  let vehicle = requestedVehicleId
    ? await prisma.vehicle.findUnique({ where: { id: requestedVehicleId } })
    : await prisma.vehicle.findFirst();

  if (!vehicle) {
    let route = await prisma.route.findFirst();
    if (!route) {
      route = await prisma.route.create({
        data: { id: 'R1', name: 'Main Campus Loop', color: '#2563EB', status: 'active' },
      });
    }
    const newId = requestedVehicleId || 'V03';
    vehicle = await prisma.vehicle.create({
      data: {
        id: newId,
        name: `Shuttle ${newId}`,
        type: 'bus',
        assignedRouteId: route.id,
        status: 'active',
      },
    });
  }

  const vehicleId = vehicle.id;
  let routeId = vehicle.assignedRouteId;
  if (!routeId) {
    let fallbackRoute = await prisma.route.findFirst();
    if (!fallbackRoute) {
      fallbackRoute = await prisma.route.create({
        data: { id: 'R1', name: 'Main Campus Loop', color: '#2563EB', status: 'active' },
      });
    }
    routeId = fallbackRoute.id;
  }

  let trip = await prisma.trip.findFirst({
    where: { vehicleId, status: 'in_progress' },
    orderBy: { startTime: 'desc' },
  });

  if (!trip) {
    trip = await prisma.trip.create({
      data: { vehicleId, routeId, status: 'in_progress', startTime: new Date() },
    });
  }

  return { vehicleId, tripId: trip.id };
}

// ============================================================================
// 1. GET /api/comparison
// Matches readings across devices using relative time windows (+00:00, +00:30)
// ============================================================================
router.get('/', async (req: Request, res: Response) => {
  try {
    const requestedVehicleId = req.query.vehicleId ? String(req.query.vehicleId) : undefined;
    const windowSeconds = Number(req.query.windowSeconds || 30);
    const windowMs = windowSeconds * 1000;

    const vehicle = requestedVehicleId
      ? await prisma.vehicle.findUnique({ where: { id: requestedVehicleId } })
      : await prisma.vehicle.findFirst();

    if (!vehicle) {
      return res.json({ vehicleId: requestedVehicleId || null, windowSeconds, rows: [] });
    }

    const vehicleId = vehicle.id;

    const readings = await prisma.$queryRaw<
      Array<{
        source_type: string;
        latitude: number;
        longitude: number;
        recorded_at: Date;
      }>
    >`
      SELECT 
        UPPER(ts.type) AS source_type,
        ST_Y(gt.location::geometry) AS latitude,
        ST_X(gt.location::geometry) AS longitude,
        gt.recorded_at
      FROM gps_tracks gt
      INNER JOIN tracking_sources ts ON gt.source_id = ts.id
      WHERE gt.vehicle_id = ${vehicleId}
        AND gt.location IS NOT NULL
      ORDER BY gt.recorded_at ASC
      LIMIT 300
    `;

    // Find the first timestamp for each device source (baseline T+00:00 per device)
    const firstSeenMs = new Map<string, number>();
    for (const r of readings) {
      const src = r.source_type;
      const tMs = new Date(r.recorded_at).getTime();
      const prev = firstSeenMs.get(src);
      if (prev === undefined || tMs < prev) {
        firstSeenMs.set(src, tMs);
      }
    }

    // Group readings into relative buckets (0s, 30s, 60s...)
    const buckets = new Map<number, BucketSources>();

    for (const r of readings) {
      const src = r.source_type;
      const tMs = new Date(r.recorded_at).getTime();
      const baseMs = firstSeenMs.get(src) ?? tMs;
      const elapsedMs = Math.max(0, tMs - baseMs);
      const bucketIndex = Math.floor(elapsedMs / windowMs);
      const offsetSeconds = bucketIndex * windowSeconds;

      let bucket = buckets.get(offsetSeconds);
      if (!bucket) {
        bucket = { LORAWAN: null, ESP32: null, MOBILE: null };
        buckets.set(offsetSeconds, bucket);
      }

      const pt: Point = {
        lat: Number(r.latitude),
        lng: Number(r.longitude),
      };

      if (src === 'LORAWAN') bucket.LORAWAN = pt;
      else if (src === 'ESP32') bucket.ESP32 = pt;
      else if (src === 'MOBILE') bucket.MOBILE = pt;
    }

    // Sort windows newest offset first (e.g., +01:00, +00:30, +00:00)
    const sortedEntries = Array.from(buckets.entries()).sort((a, b) => b[0] - a[0]);

    const rows = sortedEntries.map(([offsetSec, sources]) => {
      const lw = sources.LORAWAN;
      const esp = sources.ESP32;
      const mob = sources.MOBILE;

      const d_lw_esp = lw && esp ? getDistanceMeters(lw.lat, lw.lng, esp.lat, esp.lng) : null;
      const d_esp_mob = esp && mob ? getDistanceMeters(esp.lat, esp.lng, mob.lat, mob.lng) : null;
      const d_lw_mob = lw && mob ? getDistanceMeters(lw.lat, lw.lng, mob.lat, mob.lng) : null;

      const validDistances = [d_lw_esp, d_esp_mob, d_lw_mob].filter(
        (d): d is number => d !== null
      );
      const maxDiff = validDistances.length > 0 ? Math.max(...validDistances) : null;
      const isComplete = Boolean(lw && esp && mob);

      return {
        time: formatRelativeWindow(offsetSec),
        lorawan: lw,
        esp32: esp,
        mobile: mob,
        distances: {
          lorawan_esp32: d_lw_esp,
          esp32_mobile: d_esp_mob,
          lorawan_mobile: d_lw_mob,
        },
        maxDiffMeters: maxDiff,
        status: isComplete ? 'Complete' : 'Incomplete Data',
      };
    });

    return res.json({ vehicleId, windowSeconds, rows });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to compare readings' });
  }
});

// ============================================================================
// 2. POST /api/comparison/readings
// Ingests a single GPS reading from ESP32, LoRaWAN, or Mobile (live or test)
// ============================================================================
router.post('/readings', async (req: Request, res: Response) => {
  try {
    const { vehicleId: reqVehicleId, source, latitude, longitude, speed = 0, timestamp } = req.body;
    const normalizedSource = String(source || '').toLowerCase();

    if (!['lorawan', 'esp32', 'mobile'].includes(normalizedSource)) {
      return res.status(400).json({ error: 'source must be LORAWAN, ESP32, or MOBILE' });
    }

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: 'latitude and longitude are required' });
    }

    const { vehicleId, tripId } = await ensureVehicleAndTrip(
      reqVehicleId ? String(reqVehicleId) : undefined
    );

    const lat = Number(latitude);
    const lng = Number(longitude);
    const spd = Number(speed || 0);
    const recordedAt = timestamp ? new Date(timestamp) : new Date();

    const sourceId = `SRC-${normalizedSource.toUpperCase()}-${vehicleId}`;
    await prisma.trackingSource.upsert({
      where: { id: sourceId },
      update: { vehicleId, type: normalizedSource, status: 'active', lastSeenAt: recordedAt },
      create: {
        id: sourceId,
        name: `${normalizedSource.toUpperCase()} Tracker`,
        type: normalizedSource,
        vehicleId,
        status: 'active',
        lastSeenAt: recordedAt,
      },
    });

    await prisma.$executeRaw`
      INSERT INTO gps_tracks (trip_id, vehicle_id, location, speed, source_id, recorded_at)
      VALUES (
        ${tripId}::uuid,
        ${vehicleId},
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
        ${spd},
        ${sourceId},
        ${recordedAt}
      )
    `;

    return res.status(201).json({
      message: 'Reading saved to gps_tracks',
      data: {
        vehicleId,
        tripId,
        source: normalizedSource.toUpperCase(),
        latitude: lat,
        longitude: lng,
        speed: spd,
        recordedAt,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to save reading' });
  }
});

// ============================================================================
// 3. POST /api/comparison/seed-demo
// Seeds sequential test data (simulating ESP32 at 09:10, LoRaWAN at 09:00,
// and Mobile at 09:20) into existing gps_tracks & tracking_sources tables.
// ============================================================================
router.post('/seed-demo', async (req: Request, res: Response) => {
  try {
    const requestedVehicleId = req.body?.vehicleId ? String(req.body.vehicleId) : undefined;
    const { vehicleId, tripId } = await ensureVehicleAndTrip(requestedVehicleId);

    const devices = [
      { id: `SRC-LORAWAN-${vehicleId}`, name: 'LoRaWAN Tracker', type: 'lorawan' },
      { id: `SRC-ESP32-${vehicleId}`,   name: 'ESP32 Tracker',   type: 'esp32' },
      { id: `SRC-MOBILE-${vehicleId}`,  name: 'Driver Mobile',   type: 'mobile' },
    ];

    for (const d of devices) {
      await prisma.trackingSource.upsert({
        where: { id: d.id },
        update: { vehicleId, type: d.type, status: 'active' },
        create: { id: d.id, name: d.name, type: d.type, vehicleId, status: 'active' },
      });
    }

    await prisma.$executeRaw`
      DELETE FROM gps_tracks
      WHERE vehicle_id = ${vehicleId}
        AND source_id IN (
          ${`SRC-LORAWAN-${vehicleId}`},
          ${`SRC-ESP32-${vehicleId}`},
          ${`SRC-MOBILE-${vehicleId}`}
        )
    `;

    const demoPoints = [
      // Window +00:00 (All 3 devices tested 10 mins apart)
      { sourceId: `SRC-LORAWAN-${vehicleId}`, lat: 13.960000, lng: 100.580000, speed: 25, ts: '2026-11-11T09:00:00Z' },
      { sourceId: `SRC-ESP32-${vehicleId}`,   lat: 13.960030, lng: 100.580020, speed: 25, ts: '2026-11-11T09:10:00Z' },
      { sourceId: `SRC-MOBILE-${vehicleId}`,  lat: 13.960045, lng: 100.580015, speed: 24, ts: '2026-11-11T09:20:00Z' },

      // Window +00:30 (All 3 devices tested 10 mins apart)
      { sourceId: `SRC-LORAWAN-${vehicleId}`, lat: 13.961000, lng: 100.581000, speed: 28, ts: '2026-11-11T09:00:30Z' },
      { sourceId: `SRC-ESP32-${vehicleId}`,   lat: 13.961020, lng: 100.581010, speed: 28, ts: '2026-11-11T09:10:30Z' },
      { sourceId: `SRC-MOBILE-${vehicleId}`,  lat: 13.961030, lng: 100.581005, speed: 27, ts: '2026-11-11T09:20:30Z' },

      // Window +01:00 (Missing LoRaWAN -> Incomplete Data)
      { sourceId: `SRC-ESP32-${vehicleId}`,   lat: 13.962000, lng: 100.582000, speed: 30, ts: '2026-11-11T09:11:00Z' },
      { sourceId: `SRC-MOBILE-${vehicleId}`,  lat: 13.962025, lng: 100.582015, speed: 30, ts: '2026-11-11T09:21:00Z' },
    ];

    for (const pt of demoPoints) {
      await prisma.$executeRaw`
        INSERT INTO gps_tracks (trip_id, vehicle_id, location, speed, source_id, recorded_at)
        VALUES (
          ${tripId}::uuid,
          ${vehicleId},
          ST_SetSRID(ST_MakePoint(${pt.lng}, ${pt.lat}), 4326)::geography,
          ${pt.speed},
          ${pt.sourceId},
          ${new Date(pt.ts)}
        )
      `;
    }

    return res.json({
      message: 'Seeded sequential comparison data into gps_tracks & tracking_sources!',
      vehicleId,
      tripId,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to seed gps_tracks' });
  }
});

// ============================================================================
// 4. POST /api/comparison/reset
// Clears previous test readings for the vehicle before starting a fresh test
// ============================================================================
router.post('/reset', async (req: Request, res: Response) => {
  try {
    const vehicleId = String(req.body?.vehicleId || req.query.vehicleId || 'V03');

    await prisma.$executeRaw`
      DELETE FROM gps_tracks
      WHERE vehicle_id = ${vehicleId}
        AND source_id IN (
          ${`SRC-LORAWAN-${vehicleId}`},
          ${`SRC-ESP32-${vehicleId}`},
          ${`SRC-MOBILE-${vehicleId}`}
        )
    `;

    return res.json({ message: `Cleared comparison readings for vehicle ${vehicleId}` });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to reset readings' });
  }
});

export default router;