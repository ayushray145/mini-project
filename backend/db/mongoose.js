import mongoose from 'mongoose';

let connectionPromise = null;

export async function connectToMongo() {
  const uri = process.env.MONGODB_URI;
  if (!uri) return null;

  if (!connectionPromise) {
    connectionPromise = mongoose.connect(uri, {
      autoIndex: true,
    });
  }

  return connectionPromise;
}

