import 'dotenv/config';
import app from '../src/app.js';
import { connectDB } from '../src/lib/db.js';

export default async function handler(req, res) {
  try {
    await connectDB();
    return app(req, res);
  } catch (error) {
    console.error('Unable to connect to MongoDB:', error);
    return res.status(503).json({ message: 'Service temporarily unavailable' });
  }
}
