import { Router } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import prisma from "../config/prisma";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET as string;

// POST /api/auth/admin/login
router.post("/admin/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "username and password are required" });
    }

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign(
      { sub: user.id, role: "ADMIN", username: user.username },
      JWT_SECRET,
      { expiresIn: "12h" }
    );

    res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Login failed" });
  }
});

// POST /api/auth/vehicle/login  (device/tracking source logs in on behalf of a vehicle)
router.post("/vehicle/login", async (req, res) => {
  try {
    const { sourceId, secret } = req.body;
    if (!sourceId || !secret) {
      return res.status(400).json({ error: "sourceId and secret are required" });
    }

    const source = await prisma.trackingSource.findUnique({ where: { id: sourceId } });
    if (!source || !source.secretHash) return res.status(401).json({ error: "Invalid credentials" });
    if (source.status !== "active") return res.status(403).json({ error: "Device is not active" });

    const valid = await bcrypt.compare(secret, source.secretHash);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });

    await prisma.trackingSource.update({
      where: { id: source.id },
      data: { lastSeenAt: new Date() },
    });

    const token = jwt.sign(
      { sub: source.id, role: "DEVICE", vehicleId: source.vehicleId },
      JWT_SECRET,
      { expiresIn: "12h" }
    );

    res.json({ token, sourceId: source.id, vehicleId: source.vehicleId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Login failed" });
  }
});

export default router;