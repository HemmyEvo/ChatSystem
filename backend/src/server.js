import 'dotenv/config';
import { connectDB } from './lib/db.js';
import { server } from './lib/socket.js';

const port = process.env.PORT || 3000;

try {
  await connectDB();
  server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
} catch (error) {
  console.error('Unable to start server:', error);
  process.exitCode = 1;
}