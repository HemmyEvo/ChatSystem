import express from 'express';
import { pushController } from '../controller/push.js';
import { protectRoute } from '../lib/utlis.js';

const router = express.Router();

router.get('/public-key', pushController.publicKey);
router.post('/subscription', protectRoute, pushController.subscribe);
router.delete('/subscription', protectRoute, pushController.unsubscribe);

export default router;
