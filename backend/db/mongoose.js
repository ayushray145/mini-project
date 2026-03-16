import mongoose from 'mongoose';

let connectionPromise = null;
let logged = false;

export async function connectToMongo() {
  const uri = process.env.MONGODB_URI;
  if (!uri) return null;

  if (!connectionPromise) {
    connectionPromise = mongoose.connect(uri, {
      autoIndex: true,
    });
  }

  const conn = await connectionPromise;
  if (!logged) {
    logged = true;
    try {
      const dbName = conn?.connection?.name || mongoose.connection?.name || 'unknown';
      const host = conn?.connection?.host || mongoose.connection?.host || 'unknown';
      console.log(`MongoDB ready (db=${dbName}, host=${host})`);
    } catch {
      // ignore
    }
  }

  return conn;
}

export function getMongoStatus() {
  return {
    configured: Boolean(process.env.MONGODB_URI),
    readyState: mongoose.connection.readyState, // 0=disconnected,1=connected,2=connecting,3=disconnecting
    dbName: mongoose.connection?.name,
    host: mongoose.connection?.host,
  };
}
