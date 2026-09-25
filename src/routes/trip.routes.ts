import { Router, Response } from 'express';
import prisma from '../config/prisma';
import { requireDevice, AuthenticatedDeviceRequest } from '../middlewares/auth.middleware';

const router = Router();

// POST /api/trips/start
router.post(
  '/start',
  requireDevice,
  async (req: AuthenticatedDeviceRequest, res: Response): Promise<void> => {
    try {
      const vehicleId = req.device!.vehicleId;
      const { routeId } = req.body;

      if (!routeId) {
        res.status(400).json({ error: 'routeId is required' });
        return;
      }

      const routeExists = await prisma.route.findUnique({
        where: { id: routeId },
      });

      if (!routeExists) {
        res.status(404).json({ error: 'Route not found' });
        return;
      }

      const existingTrip = await prisma.trip.findFirst({
        where: {
          vehicleId,
          status: 'in_progress',
        },
      });

      if (existingTrip) {
        res.status(409).json({
          error: 'Vehicle already has a trip in progress',
          trip: existingTrip,
        });
        return;
      }

      const newTrip = await prisma.trip.create({
        data: {
          vehicleId,
          routeId,
          status: 'in_progress',
          startTime: new Date(),
        },
      });

      res.status(201).json(newTrip);
    } catch (error) {
      console.error('Failed to start trip:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// POST /api/trips/:id/end
router.post(
  '/:id/end',
  requireDevice,
  async (req: AuthenticatedDeviceRequest, res: Response): Promise<void> => {
    try {
      const vehicleId = req.device!.vehicleId;
      
      // Explicitly cast as string to satisfy TypeScript, and drop parseInt
      const tripId = req.params.id as string;

      if (!tripId) {
        res.status(400).json({ error: 'Trip ID is required' });
        return;
      }

      const trip = await prisma.trip.findUnique({
        where: { id: tripId },
      });

      if (!trip) {
        res.status(404).json({ error: 'Trip not found' });
        return;
      }

      if (trip.vehicleId !== vehicleId) {
        res.status(403).json({ error: 'Unauthorized to end this trip' });
        return;
      }

      if (trip.status === 'completed') {
        res.status(400).json({ error: 'Trip is already completed' });
        return;
      }

      const updatedTrip = await prisma.trip.update({
        where: { id: tripId },
        data: {
          status: 'completed',
          endTime: new Date(),
        },
      });

      res.status(200).json(updatedTrip);
    } catch (error) {
      console.error('Failed to end trip:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// GET /api/trips/active
router.get(
  '/active',
  requireDevice,
  async (req: AuthenticatedDeviceRequest, res: Response): Promise<void> => {
    try {
      const vehicleId = req.device!.vehicleId;

      const activeTrip = await prisma.trip.findFirst({
        where: {
          vehicleId,
          status: 'in_progress',
        },
      });

      res.status(200).json({ activeTrip });
    } catch (error) {
      console.error('Failed to get active trip:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// GET /api/trips/live
// Public endpoint for the mobile app to see all currently driving vehicles
router.get('/live', async (req, res) => {
  try {
    const activeTrips = await prisma.trip.findMany({
      where: {
        status: 'in_progress'
      }
    });

    res.json(activeTrips);
  } catch (error) {
    console.error('Failed to get live trips:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;