import bcrypt from "bcryptjs";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  // 1. Create Routes
  await prisma.route.createMany({
    data: [
      { id: "R01", name: "Route A - Main Gate", color: "#FF5733", status: "active" },
      { id: "R02", name: "Route B - Library", color: "#33A1FF", status: "active" },
      { id: "R03", name: "Route C - Dormitory", color: "#33FF57", status: "active" },
    ],
    skipDuplicates: true,
  });

  // 2. Create Stops (using raw SQL because of PostGIS)
  await prisma.$executeRaw`
    INSERT INTO stops (id, name_th, name_en, location, status)
    VALUES
      ('S01', 'ประตูหลัก', 'Main Gate', ST_SetSRID(ST_MakePoint(100.5018, 13.7563), 4326)::geography, 'active'),
      ('S02', 'อาคารเรียนรวม', 'Main Building', ST_SetSRID(ST_MakePoint(100.5030, 13.7570), 4326)::geography, 'active'),
      ('S03', 'ห้องสมุด', 'Library', ST_SetSRID(ST_MakePoint(100.5045, 13.7580), 4326)::geography, 'active'),
      ('S04', 'หอพัก', 'Dormitory', ST_SetSRID(ST_MakePoint(100.5060, 13.7590), 4326)::geography, 'active'),
      ('S05', 'โรงอาหาร', 'Cafeteria', ST_SetSRID(ST_MakePoint(100.5025, 13.7555), 4326)::geography, 'active')
    ON CONFLICT (id) DO NOTHING;
  `;

  // 3. Create RouteStops
  await prisma.routeStop.createMany({
    data: [
      { routeId: "R01", stopId: "S01", stopOrder: 1 },
      { routeId: "R01", stopId: "S02", stopOrder: 2 },
      { routeId: "R01", stopId: "S05", stopOrder: 3 },
      { routeId: "R02", stopId: "S01", stopOrder: 1 },
      { routeId: "R02", stopId: "S03", stopOrder: 2 },
      { routeId: "R03", stopId: "S01", stopOrder: 1 },
      { routeId: "R03", stopId: "S04", stopOrder: 2 },
    ],
    skipDuplicates: true,
  });

  // 4. Create Vehicles
  await prisma.vehicle.createMany({
    data: [
      { id: "V01", name: "Shuttle 01", type: "bus", assignedRouteId: "R01", status: "active" },
      { id: "V02", name: "Shuttle 02", type: "bus", assignedRouteId: "R02", status: "active" },
      { id: "V03", name: "Shuttle 03", type: "minibus", assignedRouteId: "R03", status: "inactive" },
      { id: "V04", name: "Shuttle 04", type: "bus", status: "inactive" },
    ],
    skipDuplicates: true,
  });

  const adminPasswordHash = await bcrypt.hash("admin123",10);
  await prisma.user.upsert({
      where : {username : "admin"},
      update : {},
      create : {
          username : "admin",
          passwordHash : adminPasswordHash,
          role : "ADMIN",
      },
  });

  const devicePasswordHash = await bcrypt.hash("device123",10);
  await prisma.trackingSource.upsert({
      where : {id : "TS01"},
      update : {},
      create : {
          id : "TS01",
          name : "Mobile App - Shuttle 01",
          type : "mobile",
          vehicleId : "V01",
          secretHash : devicePasswordHash,
          credentialIssuedAt : new Date(),
        }
  });

  console.log("Seed completed!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());