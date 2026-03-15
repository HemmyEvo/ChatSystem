import express from 'express';
import { authController } from '../controller/auth.js';
import { arjectProtection, protectRoute } from '../lib/utlis.js';

const router = express.Router();
router.use(arjectProtection); // Apply Arcjet protection to all routes in this router
router.post('/login', authController.login);
router.post('/register', authController.register);
router.get('/logout',protectRoute, authController.logout);
router.put('/update-profile',protectRoute, authController.updateProfile);
router.get('/check-auth', protectRoute, (req, res) => { res.status(200).json({ message: 'Authenticated', data: req.user });});
router.get('/user-info/:id', protectRoute, authController.getUserInfo);

export default router;