import { Server } from 'socket.io';
import http from "http";
import express from 'express';
import dotenv from 'dotenv';
import { socketAuthmiddleware } from './utlis.js';
import User from '../models/User.js';
import Message from '../models/Message.js';

dotenv.config();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL,
    credentials: true,
  },
});

io.use(socketAuthmiddleware);

const userSocketMap = {};

export function getReceiverSocketId(userId) {
  return userSocketMap[userId];
}

export async function updateUserLastSeen(userId) {
  await User.findByIdAndUpdate(userId, { lastSeen: new Date() });
}

function emitPresence() {
  io.emit('presence:update', { onlineUsers: Object.keys(userSocketMap) });
}

io.on('connection', async (socket) => {
  const userId = socket.userId;
  userSocketMap[userId] = socket.id;

  await User.findByIdAndUpdate(userId, { lastSeen: new Date() });
  emitPresence();
  io.emit('user:last-seen', { userId, lastSeen: new Date().toISOString(), isOnline: true });

  socket.on('isTyping', ({ senderId, receiverId }) => {
    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('typing', { senderId });
    }
  });

  socket.on('chat:opened', async ({ chatUserId }) => {
    const filter = {
      senderId: chatUserId,
      receiverId: userId,
      readBy: { $ne: socket.user._id },
    };

    const unreadMessages = await Message.find(filter).select('_id senderId receiverId');

    await Message.updateMany(
      { _id: { $in: unreadMessages.map((m) => m._id) } },
      {
        $addToSet: { readBy: socket.user._id },
        $set: { readAt: new Date() },
      },
    );
    const senderSocketId = getReceiverSocketId(chatUserId);
    if (senderSocketId && unreadMessages.length > 0) {
      io.to(senderSocketId).emit('messages:read', {
        readerId: userId,
        chatUserId,
        messageIds: unreadMessages.map((m) => m._id.toString()),
        readAt: new Date().toISOString(),
      });
    }
  });


  socket.on('user:active', async () => {
    userSocketMap[userId] = socket.id;
    await User.findByIdAndUpdate(userId, { lastSeen: new Date() });
    emitPresence();
    io.emit('user:last-seen', { userId, lastSeen: new Date().toISOString(), isOnline: true });
  });

  socket.on('user:away', async () => {
    await updateUserLastSeen(userId);
    delete userSocketMap[userId];
    emitPresence();
    io.emit('user:last-seen', { userId, lastSeen: new Date().toISOString(), isOnline: false });
  });

  socket.on('auth:signout', async () => {
    await updateUserLastSeen(userId);
    delete userSocketMap[userId];
    emitPresence();
    io.emit('user:last-seen', { userId, lastSeen: new Date().toISOString(), isOnline: false });
  });

  socket.on('disconnect', async () => {
    await updateUserLastSeen(userId);
    delete userSocketMap[userId];
    emitPresence();
    io.emit('user:last-seen', { userId, lastSeen: new Date().toISOString(), isOnline: false });
  });
});

export { server, io, app };
