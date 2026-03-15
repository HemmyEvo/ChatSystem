import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import aj from './arcject.js';
import { isSpoofedBot } from "@arcjet/inspect";
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


export const arjectProtection = async (req, res, next) => {
    try{
        const decision = await aj.protect(req); 
        if(decision.isDenied()){
            if(decision.reason.isRateLimit){
                return res.status(429).json({ message: 'Too many requests, Please try again later' });
            } else if (decision.reason.isBot){
                return res.status(403).json({ message: 'Bot access detected' });
            } else {
                return res.status(403).json({ message: 'Access denied by security policy' });
            }
        }

        if(decision.results.some(isSpoofedBot)){
            return res.status(403).json({ error: 'Spoofed bot detected', message:"Malicious bot activity detected" });
        }
        next();
    }
    catch(error){
        console.error('Error in Arcjet protection:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
}