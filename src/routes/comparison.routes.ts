import { Router, Request, Response } from 'express';
import prisma from '../config/prisma';

const router = Router();

// Haversine formula to calculate distance in meters between 2 GPS points
function getDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  return Number((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1));
}

// 1. Ingest reading from ESP32, LoRaWAN, or Mobile
router.post('/readings', async (req: Request, res: Response) => {
  try {
    const { vehicleId = 1, source, latitude, longitude, speed = 0, timestamp } = req.body;
    const normalizedSource = String(source).toUpperCase();

    if (!['LORAWAN', 'ESP32', 'MOBILE'].includes(normalizedSource)) {
      return res.status(400).json({ error: 'source must be LORAWAN, ESP32, or MOBILE' });
    }

    const reading = await prisma.deviceReading.create({
      data: {
        vehicleId: Number(vehicleId),
        source: normalizedSource,
        latitude: Number(latitude),
        longitude: Number(longitude),
        speed: Number(speed),
        timestamp: timestamp ? new Date(timestamp) : new Date(),
      },
    });

    res.status(201).json(reading);
  } catch (error) {
    res.status(500).json({ error: 'Failed to save reading' });
  }
});

// 2. Seed fake test data into Neon (So you can test without hardware)
router.post('/seed-demo', async (_req: Request, res: Response) => {
  try {
    await prisma.deviceReading.deleteMany({ where: { vehicleId: 1 } });

    const demoData = [
      // Window 09:00:00 -> All 3 devices present (~5.2m max diff)
      { vehicleId: 1, source: 'LORAWAN', latitude: 13.960000, longitude: 100.580000, speed: 25, timestamp: new Date('2026-11-11T09:00:02Z') },
      { vehicleId: 1, source: 'ESP32',   latitude: 13.960030, longitude: 100.580020, speed: 25, timestamp: new Date('2026-11-11T09:00:05Z') },
      { vehicleId: 1, source: 'MOBILE',  latitude: 13.960045, longitude: 100.580015, speed: 24, timestamp: new Date('2026-11-11T09:00:08Z') },

      // Window 09:00:30 -> All 3 devices present (~3.4m max diff)
      { vehicleId: 1, source: 'LORAWAN', latitude: 13.961000, longitude: 100.581000, speed: 28, timestamp: new Date('2026-11-11T09:00:31Z') },
      { vehicleId: 1, source: 'ESP32',   latitude: 13.961020, longitude: 100.581010, speed: 28, timestamp: new Date('2026-11-11T09:00:34Z') },
      { vehicleId: 1, source: 'MOBILE',  latitude: 13.961030, longitude: 100.581005, speed: 27, timestamp: new Date('2026-11-11T09:00:36Z') },

      // Window 09:01:00 -> Missing LoRaWAN (Tests "Incomplete Data" requirement)
      { vehicleId: 1, source: 'ESP32',   latitude: 13.962000, longitude: 100.582000, speed: 30, timestamp: new Date('2026-11-11T09:01:03Z') },
      { vehicleId: 1, source: 'MOBILE',  latitude: 13.962025, longitude: 100.582015, speed: 30, timestamp: new Date('2026-11-11T09:01:07Z') },
    ];

    await prisma.deviceReading.createMany({ data: demoData });
    res.json({ message: 'Demo comparison data seeded to Neon successfully!' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to seed demo data' });
  }
});

// 3. Get matched time-window comparisons
router.get('/', async (req: Request, res: Response) => {
  try {
    const vehicleId = Number(req.query.vehicleId || 1);
    const windowSeconds = Number(req.query.windowSeconds || 30); // Agreed 30s time window
    const windowMs = windowSeconds * 1000;

    const readings = await prisma.deviceReading.findMany({
      where: { vehicleId },
      orderBy: { timestamp: 'desc' },
      take: 300,
    });

    // Group readings into agreed time windows
    const buckets: Record<string, Record<string, { lat: number; lng: number }>> = {};

    for (const r of readings) {
      const bucketTimeMs = Math.floor(new Date(r.timestamp).getTime() / windowMs) * windowMs;
      const bucketKey = new Date(bucketTimeMs).toISOString().substr(11, 8); // "HH:MM:SS"

      if (!buckets[bucketKey]) buckets[bucketKey] = {};
      if (!buckets[bucketKey][r.source]) {
        buckets[bucketKey][r.source] = { lat: r.latitude, lng: r.longitude };
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

    res.json({ windowSeconds, rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to compare readings' });
  }
});

export default router;