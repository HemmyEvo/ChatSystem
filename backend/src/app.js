import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import messageRoutes from './routes/message.js';
import pushRoutes from './routes/push.js';

const app = express();

app.use(express.json({ limit: '5mb' }));
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(cookieParser());
app.get('/', (req, res) => {
  res.send('Welcome to the Chat System API');
});
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});
app.use('/api/auth', authRoutes);
app.use('/api/message', messageRoutes);
app.use('/api/push', pushRoutes);

export default app;
