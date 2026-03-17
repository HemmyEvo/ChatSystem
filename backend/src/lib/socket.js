import { Server } from 'socket.io';
import http from 'http';
import express from 'express';
import dotenv from 'dotenv';
import { socketAuthmiddleware } from './utlis.js';
import User from '../models/User.js';
import Message from '../models/Message.js';
import { applyGameAction, clearInvite, createInvite, createSession, forfeitSession, getInvite, getPlayerState, getSession } from './gameEngine.js';

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
  return userSocketMap[userId?.toString()];
}

const emitGameState = (session) => {
  session.players.forEach((playerId) => {
    const socketId = getReceiverSocketId(playerId);
    if (!socketId) return;
    io.to(socketId).emit('game:state', getPlayerState(session.id, playerId));
  });
};

const updateGameStats = async (session) => {
  if (!session?.state?.winnerId) return;
  const loserId = session.players.find((id) => id !== session.state.winnerId);
  await Promise.all([
    User.findByIdAndUpdate(session.state.winnerId, {
      $inc: {
        [`gameStats.${session.gameType}.played`]: 1,
        [`gameStats.${session.gameType}.won`]: 1,
        'gameStats.totalPlayed': 1,
        'gameStats.totalWon': 1,
      },
      $push: {
        'gameStats.recentMatches': {
          $each: [{ gameType: session.gameType, opponentId: loserId, winnerId: session.state.winnerId, playedAt: new Date() }],
          $slice: -10,
        },
      },
    }),
    User.findByIdAndUpdate(loserId, {
      $inc: {
        [`gameStats.${session.gameType}.played`]: 1,
        'gameStats.totalPlayed': 1,
      },
      $push: {
        'gameStats.recentMatches': {
          $each: [{ gameType: session.gameType, opponentId: session.state.winnerId, winnerId: session.state.winnerId, playedAt: new Date() }],
          $slice: -10,
        },
      },
    }),
  ]);
};

export async function updateUserLastSeen(userId) {
  if (!userId) return;
  await User.findByIdAndUpdate(userId, { lastSeen: new Date() });
}

function emitPresence() {
  io.emit('presence:update', { onlineUsers: Object.keys(userSocketMap) });
}

async function processPendingDeliveries(userId) {
  if (!userId) return;

  try {
    const undeliveredMessages = await Message.find({ receiverId: userId, deliveredTo: { $ne: userId } });

    if (undeliveredMessages.length > 0) {
      await Message.updateMany({ _id: { $in: undeliveredMessages.map((m) => m._id) } }, { $addToSet: { deliveredTo: userId } });

      const sendersToNotify = [...new Set(undeliveredMessages.map((m) => m.senderId.toString()))];
      sendersToNotify.forEach((senderId) => {
        const senderSocket = getReceiverSocketId(senderId);
        if (senderSocket) {
          const deliveredMsgIds = undeliveredMessages.filter((m) => m.senderId.toString() === senderId).map((m) => m._id.toString());
          io.to(senderSocket).emit('messages:delivered', { receiverId: userId.toString(), messageIds: deliveredMsgIds });
        }
      });
    }
  } catch (error) {
    console.error('Error processing pending deliveries:', error);
  }
}

io.on('connection', async (socket) => {
  const userId = socket.user?._id?.toString() || socket.userId?.toString();

  if (!userId) {
    console.error('Socket connected but no userId found!');
    return;
  }

  userSocketMap[userId] = socket.id;

  await User.findByIdAndUpdate(userId, { lastSeen: new Date() });
  emitPresence();
  io.emit('user:last-seen', { userId, lastSeen: new Date().toISOString(), isOnline: true });
  await processPendingDeliveries(userId);

  socket.on('isTyping', ({ senderId, receiverId }) => {
    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) io.to(receiverSocketId).emit('typing', { senderId });
  });

  socket.on('game:invite', ({ toUserId, gameType }) => {
    if (!toUserId || !['whot', 'ludo'].includes(gameType)) return;
    const receiverSocketId = getReceiverSocketId(toUserId);
    if (!receiverSocketId) {
      socket.emit('game:error', { message: 'User is offline. Invite failed.' });
      return;
    }
    const invite = createInvite({ fromUserId: userId, toUserId, gameType });
    io.to(receiverSocketId).emit('game:invite', { ...invite, fromUser: { _id: userId, fullname: socket.user?.fullname || 'Player' } });
    socket.emit('game:invite:sent', invite);
  });

  socket.on('game:invite:response', ({ inviteId, accepted }) => {
    const invite = getInvite(inviteId);
    if (!invite || invite.toUserId !== userId) return;
    clearInvite(inviteId);
    const inviterSocket = getReceiverSocketId(invite.fromUserId);

    if (!accepted) {
      if (inviterSocket) io.to(inviterSocket).emit('game:invite:declined', { inviteId });
      return;
    }

    const session = createSession({ gameType: invite.gameType, playerA: invite.fromUserId, playerB: invite.toUserId });
    emitGameState(session);
    if (inviterSocket) io.to(inviterSocket).emit('game:started', { sessionId: session.id, gameType: session.gameType, opponentId: userId });
    socket.emit('game:started', { sessionId: session.id, gameType: session.gameType, opponentId: invite.fromUserId });
  });

  socket.on('game:action', async ({ sessionId, action }) => {
    const result = applyGameAction({ sessionId, playerId: userId, action });
    if (result.error) {
      socket.emit('game:error', { message: result.error });
      return;
    }

    emitGameState(result.session);
    if (result.session.status === 'completed') {
      await updateGameStats(result.session);
      result.session.players.forEach((id) => {
        const sid = getReceiverSocketId(id);
        if (sid) io.to(sid).emit('game:ended', { sessionId, winnerId: result.session.state.winnerId, gameType: result.session.gameType });
      });
    }
  });

  socket.on('game:forfeit', async ({ sessionId }) => {
    const session = forfeitSession({ sessionId, playerId: userId });
    if (!session) return;
    emitGameState(session);
    await updateGameStats(session);
    session.players.forEach((id) => {
      const sid = getReceiverSocketId(id);
      if (sid) io.to(sid).emit('game:ended', { sessionId, winnerId: session.state.winnerId, gameType: session.gameType });
    });
  });

  socket.on('game:dashboard:request', async () => {
    const me = await User.findById(userId).select('gameStats');
    socket.emit('game:dashboard', me?.gameStats || null);
  });

  socket.on('chat:opened', async ({ chatUserId }) => {
    const filter = { senderId: chatUserId, receiverId: userId, readBy: { $ne: userId } };

    try {
      const unreadMessages = await Message.find(filter).select('_id senderId receiverId');
      if (unreadMessages.length > 0) {
        await Message.updateMany(
          { _id: { $in: unreadMessages.map((m) => m._id) } },
          { $addToSet: { readBy: userId, deliveredTo: userId }, $set: { readAt: new Date() } },
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
      console.error('Error in chat:opened:', error);
    }
  });

  socket.on('user:active', async () => {
    userSocketMap[userId] = socket.id;
    await User.findByIdAndUpdate(userId, { lastSeen: new Date() });
    emitPresence();
    io.emit('user:last-seen', { userId, lastSeen: new Date().toISOString(), isOnline: true });
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

export { server, io, app, getSession };
