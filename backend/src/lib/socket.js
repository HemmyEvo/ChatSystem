import { Server } from 'socket.io';
import http from "http";
import express from 'express';
import dotenv from 'dotenv';
import { socketAuthmiddleware } from './utlis.js'; // Ensure your path is correct
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

// Store active users (Key: userId string, Value: socket.id string)
const userSocketMap = {}; 

export function getReceiverSocketId(userId) {
  // Ensure we are always looking up by string
  return userSocketMap[userId?.toString()];
}

export async function updateUserLastSeen(userId) {
  if (!userId) return;
  await User.findByIdAndUpdate(userId, { lastSeen: new Date() });
}

function emitPresence() {
  io.emit('presence:update', { onlineUsers: Object.keys(userSocketMap) });
}

// NEW: Reusable function to instantly process deliveries
async function processPendingDeliveries(userId) {
  if (!userId) return;
  
  try {
    // Find all messages sent to this user that they haven't marked as delivered yet
    const undeliveredMessages = await Message.find({
      receiverId: userId,
      deliveredTo: { $ne: userId }
    });

    if (undeliveredMessages.length > 0) {
      // 1. Update database to mark them as delivered
      await Message.updateMany(
        { _id: { $in: undeliveredMessages.map(m => m._id) } },
        { $addToSet: { deliveredTo: userId } }
      );

      // 2. Group the messages by sender so we can notify them
      const sendersToNotify = [...new Set(undeliveredMessages.map(m => m.senderId.toString()))];
      
      sendersToNotify.forEach(senderId => {
        const senderSocket = getReceiverSocketId(senderId);
        
        // If the sender is online, shoot them the double gray ticks!
        if (senderSocket) {
          const deliveredMsgIds = undeliveredMessages
            .filter(m => m.senderId.toString() === senderId)
            .map(m => m._id.toString());
            
          io.to(senderSocket).emit('messages:delivered', {
            receiverId: userId.toString(),
            messageIds: deliveredMsgIds
          });
        }
      });
    }
  } catch (error) {
    console.error("Error processing pending deliveries:", error);
  }
}

io.on('connection', async (socket) => {
  // FIX: Robustly grab the userId as a string, regardless of how middleware attaches it
  const userId = socket.user?._id?.toString() || socket.userId?.toString();
  
  if (!userId) {
    console.error("Socket connected but no userId found!");
    return;
  }

  // Register user as online
  userSocketMap[userId] = socket.id;

  await User.findByIdAndUpdate(userId, { lastSeen: new Date() });
  emitPresence();
  io.emit('user:last-seen', { userId, lastSeen: new Date().toISOString(), isOnline: true });

  // --- TRIGGER DELIVERY CHECK ON CONNECTION ---
  await processPendingDeliveries(userId);

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
      readBy: { $ne: userId },
    };

    try {
      const unreadMessages = await Message.find(filter).select('_id senderId receiverId');

      if (unreadMessages.length > 0) {
        await Message.updateMany(
          { _id: { $in: unreadMessages.map((m) => m._id) } },
          {
            $addToSet: { readBy: userId, deliveredTo: userId }, // Ensure delivery is tracked too
            $set: { readAt: new Date() },
          },
        );
        
        const senderSocketId = getReceiverSocketId(chatUserId);
        if (senderSocketId) {
          io.to(senderSocketId).emit('messages:read', {
            readerId: userId,
            chatUserId,
            messageIds: unreadMessages.map((m) => m._id.toString()),
            readAt: new Date().toISOString(),
          });
        }
      }
    } catch (error) {
      console.error("Error in chat:opened:", error);
    }
  });

  socket.on('user:active', async () => {
    userSocketMap[userId] = socket.id;
    await User.findByIdAndUpdate(userId, { lastSeen: new Date() });
    emitPresence();
    io.emit('user:last-seen', { userId, lastSeen: new Date().toISOString(), isOnline: true });
    
    // --- TRIGGER DELIVERY CHECK WHEN TAB BECOMES ACTIVE ---
    await processPendingDeliveries(userId);
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