import cloudinary from "../lib/cloudinary.js";
import { generateToken } from "../lib/utlis.js";
import User from "../models/User.js";
import bcrypt from "bcryptjs";

export const authController = {
    //Login to an account
    login: async (req, res) => {
        const { email, password } = req.body;
        try{
            if(!email || !password){
                return res.status(400).json({ message: 'Email and password are required' });
            }
            if(password.length < 6){
                return res.status(400).json({ message: 'Password must be at least 6 characters long' });
            }
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if(!emailRegex.test(email)){
                return res.status(400).json({ message: 'Invalid email format' });
            }
            const user = await User.findOne({ email });
            if(!user){
                return res.status(400).json({ message: 'Invalid email or password' });
            }
            const isMatch = await bcrypt.compare(password, user.password);
            if(!isMatch){
                return res.status(400).json({ message: 'Invalid email or password' });
            }
            const token = generateToken(user._id, res);
            res.status(200).json({ 
                message: 'Login successful',
                data: { id: user._id, fullname: user.fullname, email: user.email }, 
                token 
            });

        }
        catch(error){
            console.error('Error during login:', error);
            res.status(500).json({ message: 'Internal server error' });
        }

    },

    //Register an account
    register: async (req, res) => {
       const { fullname, email, password } = req.body;
       
       try{
        if(!fullname || !email || !password){
            return res.status(400).json({ message: 'All fields are required' });
        }
        if(password.length < 6){
            return res.status(400).json({ message: 'Password must be at least 6 characters long' });
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if(!emailRegex.test(email)){
            return res.status(400).json({ message: 'Invalid email format' });
        }

        const user = await User.findOne({ email });
        if(user){
            return res.status(400).json({ message: 'Email already in use' });
        }
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        const newUser = new User({ fullname, email, password: passwordHash });
        if(newUser){
            await newUser.save();
            const token = generateToken(newUser._id, res);
            res.status(201).json({ 
                message: 'User registered successfully',
                data: { id: newUser._id, fullname: newUser.fullname, email: newUser.email }, 
                token 
            });
        }
       }
       catch(error){
        console.error('Error during registration:', error);
        res.status(500).json({ message: 'Internal server error' });
       }
    },

    //logout from an account
    logout: (_, res) => {
        res.clearCookie('token', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
        });
        res.status(200).json({ message: 'Logout successful' });
    },

    //Update user profile
    updateProfile:async (req, res) => {
        try {
            const { profilePic } = req.body;
            if (!profilePic) return res.status(400).json({ message: 'Profile picture is required' });
            const userId = req.user._id;
           const uploadResult = await cloudinary.uploader.upload(profilePic)
           const updatedUser = await User.findByIdAndUpdate(userId, { profilePic: uploadResult.secure_url }, { new: true });
           return res.status(200).json({ message: 'Profile updated successfully', data: updatedUser });

        } catch (error) {
            console.error('Error uploading profile picture:', error);
            return res.status(500).json({ message: 'Error uploading profile picture' });
        }
    },
    

}