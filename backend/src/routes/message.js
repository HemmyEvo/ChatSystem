import express from 'express';
import { messageController } from '../controller/message.js';
import { protectRoute, arjectProtection } from '../lib/utlis.js';
const router = express.Router();

router.use(arjectProtection, protectRoute);
router.get('/people', messageController.people);
router.get('/friends', messageController.friendList);
router.post('/friend-request/:id', messageController.sendFriendRequest);
router.post('/friend-request/:id/respond', messageController.respondToFriendRequest);
router.get('/chats', messageController.chats);
router.get('/statuses', messageController.statuses);
router.post('/status', messageController.postStatus);
router.post('/status/:id/view', messageController.viewStatus);
router.post('/view-once/:id/open', messageController.openViewOnceMessage);
router.get('/:id', messageController.messageById);
router.post('/send/:id', messageController.sendMessage);
router.patch('/read/:id', messageController.markAsRead);
router.post('/block/:id', messageController.blockUser);
router.delete('/delete-chat/:id', messageController.deleteAllMessagesWithUser);
router.post('/react/:id', messageController.reactToMessage);
router.delete('/delete-for-me/:id', messageController.deleteMessageForMe);
router.delete('/delete-for-everyone/:id', messageController.deleteMessageForEveryone);

export default router;
