import mongoose from 'mongoose';

let connectionPromise = null;
let logged = false;

export async function connectToMongo() {
  const uri = process.env.MONGODB_URI;
  if (!uri) return null;
  const dbName = process.env.MONGODB_DB || undefined;

  if (!connectionPromise) {
    connectionPromise = mongoose
      .connect(uri, {
        autoIndex: true,
        ...(dbName ? { dbName } : {}),
      })
      .catch((error) => {
        connectionPromise = null;

        if (error?.syscall === 'querySrv' && error?.code === 'ECONNREFUSED') {
          error.message =
            `MongoDB Atlas SRV lookup failed for ${error?.hostname || 'the cluster host'}. ` +
            'This is usually a local DNS or network issue, not an application code issue. ' +
            'Try switching DNS, allowing network access to MongoDB Atlas, or using the non-SRV Atlas connection string.';
        }

        throw error;
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
