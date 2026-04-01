import mongoose from 'mongoose';

let connectionPromise = null;
let logged = false;
let connectionMode = 'disconnected';

function isSrvLookupError(error) {
  return error?.syscall === 'querySrv' && error?.code === 'ECONNREFUSED';
}

function isSrvUri(uri) {
  return String(uri || '').trim().toLowerCase().startsWith('mongodb+srv://');
}

function buildMongoConnectionError(error, { hasDirectFallback = false } = {}) {
  if (!isSrvLookupError(error)) return error;

  const nextError = error instanceof Error ? error : new Error(String(error || 'MongoDB connection failed'));
  const fallbackHint = hasDirectFallback
    ? ' The configured non-SRV fallback also failed.'
    : ' Add a non-SRV Atlas URI as MONGODB_URI_DIRECT to bypass SRV DNS on restrictive networks.';

  nextError.message =
    `MongoDB Atlas SRV lookup failed for ${error?.hostname || 'the cluster host'}. ` +
    'This is usually a local DNS or network issue, not an application code issue. ' +
    'Try switching DNS, allowing network access to MongoDB Atlas, or using the non-SRV Atlas connection string.' +
    fallbackHint;

  return nextError;
}

export function getPublicMongoErrorMessage(error, fallbackMessage = 'MongoDB request failed') {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallbackMessage;
}

export async function connectToMongo() {
  const uri = process.env.MONGODB_URI;
  if (!uri) return null;
  const dbName = process.env.MONGODB_DB || undefined;
  const directUri = String(process.env.MONGODB_URI_DIRECT || '').trim();

  if (!connectionPromise) {
    connectionPromise = (async () => {
      const connect = async (targetUri, mode) => {
        const conn = await mongoose.connect(targetUri, {
          autoIndex: true,
          ...(dbName ? { dbName } : {}),
        });
        connectionMode = mode;
        return conn;
      };

      try {
        return await connect(uri, isSrvUri(uri) ? 'srv' : 'standard');
      } catch (error) {
        const canFallbackToDirect = isSrvUri(uri) && directUri && isSrvLookupError(error);

        if (canFallbackToDirect) {
          try {
            await mongoose.disconnect().catch(() => {});
            return await connect(directUri, 'direct-fallback');
          } catch (fallbackError) {
            throw buildMongoConnectionError(fallbackError, { hasDirectFallback: true });
          }
        }

        throw buildMongoConnectionError(error, { hasDirectFallback: Boolean(directUri) });
      }
    })().catch((error) => {
        connectionPromise = null;
        connectionMode = 'disconnected';
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
    hasDirectFallback: Boolean(process.env.MONGODB_URI_DIRECT),
    connectionMode,
    readyState: mongoose.connection.readyState, // 0=disconnected,1=connected,2=connecting,3=disconnecting
    dbName: mongoose.connection?.name,
    host: mongoose.connection?.host,
  };
}
