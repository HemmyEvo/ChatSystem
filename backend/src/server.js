import express from 'express';
import dotenv from 'dotenv';
import authRoutes from './controller/routes/auth.js';
import messageRoutes from './controller/routes/message.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

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