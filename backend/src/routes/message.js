import express from 'express';
import { messageController } from '../controller/message.js';
import { protectRoute, arjectProtection } from '../lib/utlis.js';
const router = express.Router();
router.use(arjectProtection, protectRoute); // Apply authentication middleware to all routes in this router
router.get('/contact', messageController.contact )
router.get('/chats', messageController.chats )
router.get('/:id', messageController.messageById );
router.post("/send/:id", messageController.sendMessage ); 
router.delete("/delete/:id", messageController.deleteMessage); 

export default router;