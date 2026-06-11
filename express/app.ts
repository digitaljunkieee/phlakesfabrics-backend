import dotenv from 'dotenv';
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import path from 'node:path';
import { mountNextApiRoutes } from './nextRouteAdapter';

dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });
dotenv.config({ path: path.resolve(process.cwd(), 'backend', '.env'), quiet: true });

type RawBodyRequest = Request & {
  rawBody?: Buffer;
};

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', true);
app.use(cors({ origin: true, credentials: true }));

function captureRawBody(req: RawBodyRequest, _res: Response, buffer: Buffer) {
  if (buffer?.length) req.rawBody = Buffer.from(buffer);
}

app.use(express.json({ limit: '10mb', verify: captureRawBody }));
app.use(express.urlencoded({ extended: true, limit: '10mb', verify: captureRawBody }));

function mongoState() {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  return states[mongoose.connection.readyState] || 'unknown';
}

async function ensureMongoConnection() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL;
  if (!uri) {
    return { configured: false, state: mongoState() };
  }

  if (mongoose.connection.readyState === 1) {
    return { configured: true, state: mongoState() };
  }

  await mongoose.connect(uri);
  return { configured: true, state: mongoState() };
}

app.get(['/health', '/api/health'], (_req, res) => {
  res.status(200).json({
    success: true,
    service: 'phlakesfabrics-express',
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/status', async (_req, res) => {
  try {
    const mongo = await ensureMongoConnection();
    res.status(200).json({
      success: true,
      service: 'phlakesfabrics-express',
      status: 'ok',
      mongo,
      routeMode: 'express-mounted-next-api-handlers',
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      service: 'phlakesfabrics-express',
      status: 'degraded',
      mongo: { configured: true, state: mongoState() },
      error: error instanceof Error ? error.message : 'MongoDB connection failed',
    });
  }
});

const mountedRoutes = mountNextApiRoutes(app);

app.use('/api', (_req, res) => {
  res.status(404).json({
    success: false,
    error: 'API route not found.',
    routeMode: 'express-mounted-next-api-handlers',
    mountedRouteCount: mountedRoutes.length,
  });
});

app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Not found' });
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Express API bridge error:', error);
  res.status(500).json({
    success: false,
    error: error instanceof Error ? error.message : 'Internal server error',
  });
});

export { mountedRoutes };
export default app;
