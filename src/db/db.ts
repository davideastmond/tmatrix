import { Db, MongoClient } from "mongodb";

// Ensure your MongoDB URI environment variable is configured
const MONGODB_URI = process.env.MONGODB_URI;

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

export async function connectToDatabase(): Promise<{
  client: MongoClient;
  db: Db;
}> {
  if (!MONGODB_URI) {
    throw new Error(
      "Please define the MONGODB_URI environment variable inside .env.local",
    );
  }

  // If a connection instance is already cached, reuse it instantly
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  // Configure connection settings optimized for stateless cloud environments
  const client = await MongoClient.connect(MONGODB_URI, {
    maxPoolSize: 10,
    minPoolSize: 1,
  });

  const db = client.db();

  cachedClient = client;
  cachedDb = db;

  return { client, db };
}
