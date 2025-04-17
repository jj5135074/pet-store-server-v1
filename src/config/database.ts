import { MongoClient, ServerApiVersion } from 'mongodb';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// Connection URL from environment variable with fallback
if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set');
const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
    //   strict: true,
      deprecationErrors: true
    },
    connectTimeoutMS: 60000,
    maxPoolSize: 10
});

export async function connectToDatabase(db?: string) {
    try {
        await client.connect();
        console.log('Connected to MongoDB');
        return client.db(db || process.env.MONGODB_DB_NAME || 'SHELTER');
    } catch (error) {
        console.error('Error connecting to MongoDB:', error);
        process.exit(1);
    }
}

export async function closeDatabaseConnection() {
    try {
        await client.close();
        console.log('Disconnected from MongoDB');
    } catch (error) {
        console.error('Error closing MongoDB connection:', error);
    }
}

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(uri as string, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    
    // Handle connection errors after initial connection
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected. Attempting to reconnect...');
    });

  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    process.exit(1);
  }
};

export default connectDB;
