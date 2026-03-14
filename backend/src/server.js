import express from 'express';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import messageRoutes from './routes/message.js';
import { connectDB } from './lib/db.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

connectDB();

// 1. ADDED "/api" prefix so it matches your vercel.json rewrites
app.use("/api/auth", authRoutes);
app.use("/api/message", messageRoutes);

console.log(`Environment: ${process.env.NODE_ENV}`);

if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`Server is running locally on http://localhost:${port}`);
  });
}

export default app;