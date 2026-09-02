import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();
const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';

// Auth
app.post('/auth/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email & password required' });
  const hashed = await bcrypt.hash(password, 10);
  try {
    const user = await prisma.user.create({ data: { email, password: hashed } });
    res.json({ id: user.id, email: user.email });
  } catch (err) {
    res.status(400).json({ error: 'cannot create user' });
  }
});

app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email & password required' });
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: 'invalid credentials' });
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ error: 'invalid credentials' });
  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '8h' });
  res.json({ token });
});

function authMiddleware(req: any, res: any, next: any) {
  const header = req.headers['authorization'];
  if (!header) return res.status(401).json({ error: 'missing auth' });
  const parts = header.split(' ');
  if (parts.length !== 2) return res.status(401).json({ error: 'invalid auth' });
  const token = parts[1];
  try {
    const payload: any = jwt.verify(token, JWT_SECRET);
    (req as any).userId = payload.userId;
    next();
  } catch (err) {
    res.status(401).json({ error: 'invalid token' });
  }
}

// Drivers
app.get('/drivers', authMiddleware, async (req, res) => {
  const drivers = await prisma.driver.findMany({ include: { vehicles: true } });
  res.json(drivers);
});

app.post('/drivers', authMiddleware, async (req, res) => {
  const { name, licenseNo } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const driver = await prisma.driver.create({ data: { name, licenseNo } });
  res.json(driver);
});

// Vehicles
app.post('/vehicles', authMiddleware, async (req, res) => {
  const { plate, model, driverId } = req.body;
  if (!plate) return res.status(400).json({ error: 'plate required' });
  const vehicle = await prisma.vehicle.create({ data: { plate, model, driverId } });
  res.json(vehicle);
});

// Trips
app.get('/trips', authMiddleware, async (req, res) => {
  const trips = await prisma.trip.findMany({ include: { driver: true, vehicle: true, incidents: true } });
  res.json(trips);
});

app.post('/trips', authMiddleware, async (req, res) => {
  const { startAt, endAt, origin, destination, driverId, vehicleId } = req.body;
  if (!startAt || !driverId) return res.status(400).json({ error: 'startAt and driverId required' });
  const trip = await prisma.trip.create({ data: { startAt: new Date(startAt), endAt: endAt ? new Date(endAt) : undefined, origin, destination, driverId, vehicleId } });
  res.json(trip);
});

// Incidents
app.get('/incidents', authMiddleware, async (req, res) => {
  const incidents = await prisma.incident.findMany({ include: { trip: true } });
  res.json(incidents);
});

app.post('/incidents', authMiddleware, async (req, res) => {
  const { tripId, type, notes } = req.body;
  if (!tripId || !type) return res.status(400).json({ error: 'tripId and type required' });
  const inc = await prisma.incident.create({ data: { tripId, type, notes } });
  res.json(inc);
});

// Health
app.get('/', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});
