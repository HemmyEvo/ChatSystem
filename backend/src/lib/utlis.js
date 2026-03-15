import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import User from '../models/User.js';
dotenv.config();// Debugging line to check if JWT_SECRET is loaded
const {JWT_SECRET,NODE_ENV}= process.env;

export const generateToken = (userId, res) => {
    if(!JWT_SECRET){
        console.error('JWT_SECRET is not defined in environment variables');
        throw new Error('JWT_SECRET is not defined');
    }
    const token = jwt.sign({ id: userId },JWT_SECRET || 'your_jwt_secret_key', { expiresIn: '7d' });
    res.cookie('token', token, {
        httpOnly: true,
        secure: NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    return token;
};

export const protectRoute = async (req, res, next) => {
    try{
        const token = req.cookies.token;
        if(!token){
            return res.status(401).json({ message: 'Unauthorized' });
        }
        const decoded = jwt.verify(token, JWT_SECRET || 'your_jwt_secret_key');
        if(!decoded) return res.status(401).json({ message: 'Unauthorized' });
        const user = await User.findById(decoded.id).select('-password');
        if(!user) return res.status(404).json({ message: 'User not found' });
        req.user = user;
        next();
    }
    catch(error){
        console.error('Error verifying token:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
}