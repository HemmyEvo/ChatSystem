import express from 'express';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import messageRoutes from './routes/message.js';
import { connectDB } from './lib/db.js';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { app, server } from './lib/socket.js';
import path from 'path'; // 1. ADDED: Node.js built-in path module

dotenv.config();

const port = process.env.PORT || 3000;

// Since you are using ES modules, we create __dirname manually
const __dirname = path.resolve(); 

app.use(express.json({ limit: "5mb" }));
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(cookieParser());
connectDB();

app.use("/api/auth", authRoutes);
app.use("/api/message", messageRoutes);

console.log(`Environment: ${process.env.NODE_ENV}`);

// --- 2. ADDED: Serve Frontend in Production ---
if (process.env.NODE_ENV === "production") {
  // Tell Express to serve the static files from your React build folder.
  // NOTE: Change "../frontend/dist" if your frontend folder is named differently (e.g., "../client/dist")
  app.use(express.static(path.join(__dirname, "../frontend/dist")));

  // Catch-all route: If the user navigates to any URL not handled by our API, 
  // give them the React app so React Router can handle it.
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/dist", "index.html"));
  });
}

// --- 3. UPDATED: Start the server normally (Removed Vercel checks) ---
server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

export default app;