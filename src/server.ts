import express from "express";
import cors from "cors";
import prisma from "./config/prisma";
import routeRoutes from "./routes/route.routes";
import vehicleRoutes from "./routes/vehicle.routes";
import stopRoutes from "./routes/stop.routes";
import routeStopRoutes from "./routes/routeStop.routes";
import authRoutes from "./routes/auth.routes";
import tripRoutes from './routes/trip.routes';
import http from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';


const app = express();

// 1. Wrap the Express app in a standard HTTP server
const server = http.createServer(app);

// 2. Attach Socket.IO to that HTTP server
const io = new Server(server, {
  cors: { origin: '*' }
});

const JWT_SECRET = process.env.JWT_SECRET || 'pick-any-long-random-string-here';

// 3. Socket Authentication Middleware
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  
  if (!token) {
    return next(new Error('Authentication error: Token missing'));
  }
  
  try {
    // Cast to 'any' to prevent TypeScript strict mode errors
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    // Attach the user data (like vehicleId and role) to the socket
    socket.data.user = decoded;
    next();
  } catch (err) {
    return next(new Error('Authentication error: Invalid token'));
  }
});


// 4. Handle connection events
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id} (Role: ${socket.data.user.role})`);
  
  // TASK 4 & 5: Listen for device location updates and broadcast them
  socket.on('location:update', (payload) => {
    const user = socket.data.user;
    
    // Security check: Only authenticated devices are allowed to send GPS updates
    if (user.role !== 'DEVICE') return;

    const { lat, lng, speed, heading } = payload;

    // Broadcast the formatted data to ALL connected clients (Public Web & Admin)
    io.emit('vehicle:location', {
      vehicleId: user.vehicleId,
      lat,
      lng,
      speed,
      heading,
      updatedAt: new Date()
    });
  });

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});


app.use(cors());
app.use(express.json());

app.use("/api/routes", routeRoutes);
app.use("/api/vehicles", vehicleRoutes);
app.use("/api/stops", stopRoutes);
app.use("/api/route-stops", routeStopRoutes);
app.use("/api/auth",authRoutes);
app.use('/api/trips',tripRoutes);

// ...keep your existing "/" and "/health" handlers unchanged
app.get("/", (_req, res) => {
  res.json({
    message: "Shuttle Tracking Backend API is running",
  });
});

app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      status: "OK",
      database: "connected",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      status: "ERROR",
      database: "disconnected",
    });
  }
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
