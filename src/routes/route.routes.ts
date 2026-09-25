import { Router } from "express";
import prisma from "../config/prisma";

const router = Router();

// GET all routes
router.get("/", async (req, res) => {
  try {
    const routes = await prisma.route.findMany();
    res.json(routes);
  } catch (error) {
    console.error(error); // add this line temporarily
    res.status(500).json({ error: "Failed to get routes" });
  }
});

// GET one route
router.get("/:id", async (req, res) => {
  try {
    const route = await prisma.route.findUnique({
      where: { id: req.params.id },
    });

    if (!route) {
      return res.status(404).json({ error: "Route not found" });
    }

    res.json(route);
  } catch (error) {
    res.status(500).json({ error: "Failed to get route" });
  }
});

// CREATE route
router.post("/", async (req, res) => {
  try {
    const { id, name, color, status } = req.body;

    if (!id || !name || !color) {
      return res.status(400).json({ error: "id, name and color are required" });
    }

    if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
      return res.status(400).json({ error: "color must be a hex code like #RRGGBB" });
    }

    const route = await prisma.route.create({
      data: { id, name, color, status: status || "active" },
    });

    res.status(201).json(route);
  } catch (error: any) {
    if (error.code === "P2002") {
      return res.status(409).json({ error: "Route id already exists" });
    }
    res.status(500).json({ error: "Failed to create route" });
  }
});

// UPDATE route
router.put("/:id", async (req, res) => {
  try {
    const { name, color, status } = req.body;

    if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
      return res.status(400).json({ error: "color must be a hex code like #RRGGBB" });
    }

    const route = await prisma.route.update({
      where: { id: req.params.id },
      data: { name, color, status },
    });

    res.json(route);
  } catch (error: any) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Route not found" });
    }
    res.status(500).json({ error: "Failed to update route" });
  }
});

// DELETE route
router.delete("/:id", async (req, res) => {
  try {
    await prisma.route.delete({
      where: { id: req.params.id },
    });

    res.json({ message: "Route deleted" });
  } catch (error: any) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Route not found" });
    }
    res.status(500).json({ error: "Failed to delete route" });
  }
});

// GET /api/routes/:id/stops
router.get('/:id/stops', async (req, res) => {
  try {
    const routeId = req.params.id;
    // We assume your prisma client is imported at the top of this file
    const routeStops = await prisma.routeStop.findMany({
      where: { routeId: routeId },
      include: { stop: true } // This attaches the actual stop details (name, location)
    });
    
    res.json(routeStops);
  } catch (error) {
    console.error('Failed to fetch route stops:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/routes/:id/geometry
router.get('/:id/geometry', async (req, res): Promise<void> => {
  try {
    const routeId = req.params.id;
    
    // Querying the "routes" table exactly as mapped in schema.prisma
    const result = await prisma.$queryRaw`
      SELECT ST_AsGeoJSON(geometry)::json as geometry 
      FROM routes 
      WHERE id = ${routeId}
    `;

    const rows = result as any[];

    if (!rows || rows.length === 0 || !rows[0].geometry) {
      res.status(404).json({ error: 'Geometry not found for this route' });
      return;
    }

    res.status(200).json(rows[0].geometry);
  } catch (error) {
    console.error('Failed to fetch route geometry:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;