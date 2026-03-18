import cloudinary from "../lib/cloudinary.js";
import { generateToken } from "../lib/utlis.js";
import User from "../models/User.js";
import bcrypt from "bcryptjs";

const normalizeUsername = (value = '') => value.trim().toLowerCase().replace(/[^a-z0-9._]/g, '');

const buildUsernameSuggestions = async (rawUsername = '') => {
  const base = normalizeUsername(rawUsername).replace(/\.+/g, '.').slice(0, 20) || 'player';
  const suggestions = [];
  const candidates = [
    base,
    `${base}${Math.floor(100 + Math.random() * 900)}`,
    `${base}_${Math.floor(10 + Math.random() * 90)}`,
    `${base}.${Math.floor(10 + Math.random() * 90)}`,
    `${base}${new Date().getUTCFullYear()}`,
    `${base}${Math.floor(Date.now() % 10000)}`,
    `${base}_official`,
    `${base}_plays`,
  ];

  for (const candidate of candidates) {
    const cleaned = normalizeUsername(candidate).slice(0, 30);
    if (!cleaned || suggestions.includes(cleaned)) continue;
    const exists = await User.exists({ username: cleaned });
    if (!exists) suggestions.push(cleaned);
    if (suggestions.length === 5) break;
  }

  let counter = 1;
  while (suggestions.length < 5) {
    const fallback = `${base}${counter}`.slice(0, 30);
    const exists = await User.exists({ username: fallback });
    if (!exists && !suggestions.includes(fallback)) suggestions.push(fallback);
    counter += 1;
  }

  return suggestions;
};

const sanitizeUser = (user) => ({
  id: user._id,
  _id: user._id,
  username: user.username,
  email: user.email,
  profilePicture: user.profilePicture,
  friends: user.friends,
  friendRequestsSent: user.friendRequestsSent,
  friendRequestsReceived: user.friendRequestsReceived,
});

export const authController = {
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
                data: sanitizeUser(user), 
                token 
            });

        }
        catch(error){
            console.error('Error during login:', error);
            res.status(500).json({ message: 'Internal server error' });
        }

    },

    register: async (req, res) => {
       const { username, email, password } = req.body;
       try{
        const normalizedUsername = normalizeUsername(username);
        if(!normalizedUsername || !email || !password){
            return res.status(400).json({ message: 'All fields are required' });
        }
        if(normalizedUsername.length < 3){
            return res.status(400).json({ message: 'Username must be at least 3 characters long' });
        }
        if(password.length < 6){
            return res.status(400).json({ message: 'Password must be at least 6 characters long' });
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if(!emailRegex.test(email)){
            return res.status(400).json({ message: 'Invalid email format' });
        }

        const [emailUser, usernameUser] = await Promise.all([
          User.findOne({ email }),
          User.findOne({ username: normalizedUsername }),
        ]);
        if(emailUser){
            return res.status(400).json({ message: 'Email already in use' });
        }
        if(usernameUser){
            const suggestions = await buildUsernameSuggestions(normalizedUsername);
            return res.status(409).json({ message: 'Username already in use', suggestions });
        }
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        const newUser = new User({ username: normalizedUsername, email, password: passwordHash });
        if(newUser){
            await newUser.save();
            const token = generateToken(newUser._id, res);
            res.status(201).json({ 
                message: 'User registered successfully',
                data: sanitizeUser(newUser), 
                token 
            });
        }
       }
       catch(error){
        console.error('Error during registration:', error);
        res.status(500).json({ message: 'Internal server error' });
       }
    },

    suggestUsernames: async (req, res) => {
      try {
        const username = normalizeUsername(req.query.username || '');
        if (!username) return res.status(200).json({ available: false, suggestions: [] });
        const existingUser = await User.findOne({ username });
        if (!existingUser) {
          return res.status(200).json({ available: true, suggestions: [username] });
        }
        const suggestions = await buildUsernameSuggestions(username);
        return res.status(200).json({ available: false, suggestions });
      } catch (error) {
        console.error('Error suggesting usernames:', error);
        return res.status(500).json({ message: 'Internal server error' });
      }
    },

    logout: (_, res) => {
        res.clearCookie('token', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
        });
        res.status(200).json({ message: 'Logout successful' });
    },

    updateProfile:async (req, res) => {
        try {
            const { profilePic } = req.body;
            if (!profilePic) return res.status(400).json({ message: 'Profile picture is required' });
            const userId = req.user._id;
           const uploadResult = await cloudinary.uploader.upload(profilePic);
          
            const updatedUser = await User.findByIdAndUpdate(
                userId,
                { profilePicture: uploadResult.secure_url },
                { new: true }
            ).select('-password');

           return res.status(200).json({ message: 'Profile updated successfully', data: updatedUser });

        } catch (error) {
            console.error('Error uploading profile picture:', error);
            return res.status(500).json({ message: 'Error uploading profile picture' });
        }
    }, 
    getUserInfo: async (req, res) => {
        try {
            const userId = req.params.id;
            const user = await User.findById(userId).select('-password');
            if (!user) return res.status(404).json({ message: 'User not found' });
            return res.status(200).json({ message: 'User info retrieved successfully', data: user });
        } catch (error) {
            console.error('Error retrieving user info:', error);
            return res.status(500).json({ message: 'Error retrieving user info' });
        }
    }


}
