import { Server } from 'socket.io';
import http from "http";
import express from 'express';
import dotenv from 'dotenv';
import { socketAuthmiddleware } from './utlis.js';

dotenv.config();

const app = express();

const server = http.createServer(app);


const io = new Server(server,{
    cors: {
        origin: process.env.CLIENT_URL,
        credentials: true
    }
})

//apply authentication middleware to socket.io
io.use(socketAuthmiddleware);

export function getReceiverSocketId(userId) {
    return userSocketMap[userId];
}

//Storing online users
const userSocketMap = {};

io.on('connection', (socket) => {
    const userId = socket.userId;
    userSocketMap[userId] = socket.id;

    // Handle online status
    io.emit('userOnline', Object.keys(userSocketMap));

    socket.on('isTyping', ({ senderId, receiverId }) => {
        const receiverSocketId = getReceiverSocketId(receiverId);
        
        // If the receiver is online, forward the message specifically to them
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('typing', { senderId });
        }
    });
    socket.on('disconnect', () => {
        delete userSocketMap[userId];
        io.emit('userOffline', Object.keys(userSocketMap));
    });
});

export { server, io,app };