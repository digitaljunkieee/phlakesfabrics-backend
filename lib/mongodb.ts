import mongoose from 'mongoose';

type MongoUriSource = 'MONGODB_URI' | 'MONGO_URI' | 'DATABASE_URL';

function normalizeMongoUri(raw: string | undefined | null) {
  if (!raw) return null;

  const trimmed = raw.trim().replace(/^['"]|['"]$/g, '');
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase();
  if (lower === 'undefined' || lower === 'null') return null;

  return trimmed;
}

export function resolveMongoUri() {
  const candidates: Array<{ name: MongoUriSource; raw: string | undefined }> = [
    { name: 'MONGODB_URI', raw: process.env.MONGODB_URI },
    { name: 'MONGO_URI', raw: process.env.MONGO_URI },
    { name: 'DATABASE_URL', raw: process.env.DATABASE_URL },
  ];

  for (const candidate of candidates) {
    const uri = normalizeMongoUri(candidate.raw);
    if (uri && /^mongodb(\+srv)?:\/\//i.test(uri)) {
      return { uri, source: candidate.name };
    }
  }

  const checked = candidates
    .map(({ name, raw }) => {
      const uri = normalizeMongoUri(raw);
      if (!uri) return `${name}=missing`;
      return `${name}=invalid`;
    })
    .join(', ');

  throw new Error(
    `No valid MongoDB connection string found. Expected one of MONGODB_URI, MONGO_URI, or DATABASE_URL to start with mongodb:// or mongodb+srv://. Checked: ${checked}`
  );
}

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections from growing exponentially
 * during API Route usage.
 */
let cached = (global as any).mongoose;

if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null };
}

async function dbConnect(): Promise<typeof mongoose> {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };
    const { uri, source } = resolveMongoUri();

    cached.promise = mongoose
      .connect(uri, opts)
      .then((mongoose) => {
        console.log(`[MongoDB] Connected to database using ${source}`);
        return mongoose;
      })
      .catch((err) => {
        console.error('[MongoDB] Connection error:', err);
        throw err;
      });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

export default dbConnect;
