import { Router, Request, Response } from 'express';
import prisma from '../config/prisma';

const router = Router();

// Haversine formula: distance between two coordinates in meters
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

// 1. GET /api/comparison -> Reads directly from existing gps_tracks & tracking_sources
router.get('/', async (req: Request, res: Response) => {
  try {
    const vehicleId = String(req.query.vehicleId || 'BUS-01');
    const windowSeconds = Number(req.query.windowSeconds || 30);
    const windowMs = windowSeconds * 1000;

    // Query existing gps_tracks joined with tracking_sources using PostGIS ST_Y (lat) and ST_X (lng)
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
      ORDER BY gt.recorded_at DESC
      LIMIT 300
    `;

    const buckets: Record<string, Record<string, { lat: number; lng: number }>> = {};

    for (const r of readings) {
      const bucketTimeMs = Math.floor(new Date(r.recorded_at).getTime() / windowMs) * windowMs;
      const bucketKey = new Date(bucketTimeMs).toISOString().slice(11, 19);

      if (!buckets[bucketKey]) buckets[bucketKey] = {};
      const src = r.source_type;
      if (!buckets[bucketKey][src]) {
        buckets[bucketKey][src] = { lat: Number(r.latitude), lng: Number(r.longitude) };
      }
    }

    const rows = Object.entries(buckets).map(([time, sources]) => {
      const lw = sources['LORAWAN'] || null;
      const esp = sources['ESP32'] || null;
      const mob = sources['MOBILE'] || null;

      const d_lw_esp = lw && esp ? getDistanceMeters(lw.lat, lw.lng, esp.lat, esp.lng) : null;
      const d_esp_mob = esp && mob ? getDistanceMeters(esp.lat, esp.lng, mob.lat, mob.lng) : null;
      const d_lw_mob = lw && mob ? getDistanceMeters(lw.lat, lw.lng, mob.lat, mob.lng) : null;

      const validDistances = [d_lw_esp, d_esp_mob, d_lw_mob].filter((d): d is number => d !== null);
      const maxDiff = validDistances.length > 0 ? Math.max(...validDistances) : null;
      const isComplete = Boolean(lw && esp && mob);

      return {
        time,
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

// 2. POST /api/comparison/seed-demo -> Seeds test readings into existing gps_tracks & tracking_sources
router.post('/seed-demo', async (req: Request, res: Response) => {
  try {
    // Find any existing vehicle & route (or create a default one if DB is empty)
    let vehicle = await prisma.vehicle.findFirst();
    if (!vehicle) {
      await prisma.route.upsert({
        where: { id: 'R1' },
        update: {},
        create: { id: 'R1', name: 'Main Campus Loop', color: '#2563EB', status: 'active' },
      });
      vehicle = await prisma.vehicle.create({
        data: { id: 'BUS-01', name: 'Shuttle Bus 1', type: 'bus', assignedRouteId: 'R1', status: 'active' },
      });
    }

    const vehicleId = vehicle.id;
    const routeId = vehicle.assignedRouteId || (await prisma.route.findFirst())!.id;

    // Ensure an active trip exists for this vehicle (required by gps_tracks.trip_id)
    let trip = await prisma.trip.findFirst({ where: { vehicleId, status: 'in_progress' } });
    if (!trip) {
      trip = await prisma.trip.create({
        data: { vehicleId, routeId, status: 'in_progress', startTime: new Date() },
      });
    }

    // Ensure the 3 physical devices exist in tracking_sources for this vehicle
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

    // Insert test coordinates into existing gps_tracks table using PostGIS geography
    const demoPoints = [
      // Window 09:00:00 (All 3 present)
      { sourceId: `SRC-LORAWAN-${vehicleId}`, lat: 13.960000, lng: 100.580000, speed: 25, ts: '2026-11-11T09:00:02Z' },
      { sourceId: `SRC-ESP32-${vehicleId}`,   lat: 13.960030, lng: 100.580020, speed: 25, ts: '2026-11-11T09:00:05Z' },
      { sourceId: `SRC-MOBILE-${vehicleId}`,  lat: 13.960045, lng: 100.580015, speed: 24, ts: '2026-11-11T09:00:08Z' },

      // Window 09:00:30 (All 3 present)
      { sourceId: `SRC-LORAWAN-${vehicleId}`, lat: 13.961000, lng: 100.581000, speed: 28, ts: '2026-11-11T09:00:31Z' },
      { sourceId: `SRC-ESP32-${vehicleId}`,   lat: 13.961020, lng: 100.581010, speed: 28, ts: '2026-11-11T09:00:34Z' },
      { sourceId: `SRC-MOBILE-${vehicleId}`,  lat: 13.961030, lng: 100.581005, speed: 27, ts: '2026-11-11T09:00:36Z' },

      // Window 09:01:00 (Missing LoRaWAN -> Incomplete Data)
      { sourceId: `SRC-ESP32-${vehicleId}`,   lat: 13.962000, lng: 100.582000, speed: 30, ts: '2026-11-11T09:01:03Z' },
      { sourceId: `SRC-MOBILE-${vehicleId}`,  lat: 13.962025, lng: 100.582015, speed: 30, ts: '2026-11-11T09:01:07Z' },
    ];

    for (const pt of demoPoints) {
      await prisma.$executeRaw`
        INSERT INTO gps_tracks (trip_id, vehicle_id, location, speed, source_id, recorded_at)
        VALUES (
          ${trip.id}::uuid,
          ${vehicleId},
          ST_SetSRID(ST_MakePoint(${pt.lng}, ${pt.lat}), 4326)::geography,
          ${pt.speed},
          ${pt.sourceId},
          ${new Date(pt.ts)}
        )
      `;
    }

    return res.json({
      message: 'Seeded into existing gps_tracks & tracking_sources tables!',
      vehicleId,
      tripId: trip.id,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to seed gps_tracks' });
  }
});

export default router;