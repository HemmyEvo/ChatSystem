import express from 'express';
import dotenv from 'dotenv'
import authRoutes from './controller/routes/auth.js';
import messageRoutes from './controller/routes/message.js';
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;


app.use(express.json());

  app.use("/auth", authRoutes);
  app.use("/message", messageRoutes);
  app.get('/', (req, res) => {
    res.send('The backend server is running!');
});


app.listen(port, () => {
  console.log(`Server is running on port http://localhost:${port}`);
});