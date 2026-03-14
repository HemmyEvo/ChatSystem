import express from 'express';
import dotenv from 'dotenv'
import authRoutes from './controller/routes/auth.js';
import messageRoutes from './controller/routes/message.js';
import path from 'path';


dotenv.config();

const app = express();
const __dirname = path.resolve();


const port = process.env.PORT || 3000;


app.use(express.json());

app.use("/auth", authRoutes);
app.use("/message", messageRoutes);



console.log(`Environment: ${process.env.NODE_ENV}`);
//make ready for deployment
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/dist')));

  app.get('*', (_, res) => { 
    res.sendFile(path.join(__dirname, '../frontend','dist', 'index.html'));
  });
}

app.listen(port, () => {
  console.log(`Server is running on port http://localhost:${port}`);
});