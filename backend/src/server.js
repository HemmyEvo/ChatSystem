import express from 'express';
import dotenv from 'dotenv';
import authRoutes from './controller/routes/auth.js';
import messageRoutes from './controller/routes/message.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Your API Routes
app.use("/api/auth", authRoutes);
app.use("/api/message", messageRoutes);

if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    console.log(`Server is running on port http://localhost:${port}`);
  });
}

// CRITICAL FOR VERCEL: Export the app as a module
export default app;