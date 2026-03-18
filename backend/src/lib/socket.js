import crypto from 'crypto';
import { Server } from 'socket.io';
import http from 'http';
import express from 'express';
import dotenv from 'dotenv';
import { socketAuthmiddleware } from './utlis.js';
import User from '../models/User.js';
import Message from '../models/Message.js';
import { applyGameAction, clearInvite, createInvite, createSession, forfeitSession, getActiveSessionByPlayer, getInvite, getPlayerState } from './gameEngine.js';

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


const callSessionMap = new Map();

const findCallSessionByUserId = (userId) => {
  const normalizedUserId = userId?.toString();
  if (!normalizedUserId) return null;
  return [...callSessionMap.values()].find((session) => session.participants.includes(normalizedUserId)) || null;
};

const buildCallSession = ({ callerId, calleeId, media }) => {
  const session = {
    id: crypto.randomUUID(),
    callerId: callerId.toString(),
    calleeId: calleeId.toString(),
    participants: [callerId.toString(), calleeId.toString()],
    media: { video: Boolean(media?.video) },
    status: 'ringing',
    createdAt: Date.now(),
  };
  callSessionMap.set(session.id, session);
  return session;
};

const removeCallSession = (sessionId) => {
  if (!sessionId) return;
  callSessionMap.delete(sessionId);
};

const getOtherParticipantId = (session, userId) => session?.participants.find((participantId) => participantId !== userId?.toString()) || null;

const loadCallPeer = async (userId) => {
  const user = await User.findById(userId).select('username profilePicture');
  if (!user) return null;
  return { _id: user._id.toString(), username: user.username, profilePicture: user.profilePicture || '' };
};

const emitCallResumeIfNeeded = async (socket, userId) => {
  const session = findCallSessionByUserId(userId);
  if (!session) return;
  const otherUserId = getOtherParticipantId(session, userId);
  const otherUser = await loadCallPeer(otherUserId);
  if (!otherUser) return;
  socket.emit('call:resume', {
    sessionId: session.id,
    status: session.status,
    media: session.media,
    otherUser,
    shouldRing: session.status === 'ringing' && session.calleeId === userId.toString(),
  });
};

const tryRenegotiateCall = (session) => {
  if (!session || session.status !== 'active') return;
  const callerSocketId = getReceiverSocketId(session.callerId);
  const calleeSocketId = getReceiverSocketId(session.calleeId);
  if (!(callerSocketId && calleeSocketId)) return;
  io.to(callerSocketId).emit('call:renegotiate', { toUserId: session.calleeId, media: session.media, sessionId: session.id });
};

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
  if (!session?.state?.winnerId) return null;
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

  const [winner, loser] = await Promise.all([
    User.findById(session.state.winnerId).select('username gameStats'),
    User.findById(loserId).select('username gameStats'),
  ]);

  return { winner, loser };
};

const emitLastMessageToParticipants = (messageDoc) => {
  const senderSocketId = getReceiverSocketId(messageDoc.senderId.toString());
  const receiverSocketId = getReceiverSocketId(messageDoc.receiverId.toString());
  if (senderSocketId) io.to(senderSocketId).emit('chat:last-message', messageDoc);
  if (receiverSocketId) io.to(receiverSocketId).emit('chat:last-message', messageDoc);
};

const sendGameSummaryMessages = async (session, statsPayload) => {
  if (!statsPayload?.winner || !statsPayload?.loser) return;
  const winnerId = session.state.winnerId.toString();
  const loserId = session.players.find((id) => id !== winnerId).toString();
  const summaries = [
    {
      senderId: winnerId,
      receiverId: loserId,
      text: `📊 ${session.gameType.toUpperCase()} finished. @${statsPayload.winner.username} won. My total wins: ${statsPayload.winner.gameStats?.totalWon || 0}/${statsPayload.winner.gameStats?.totalPlayed || 0}.`,
    },
    {
      senderId: loserId,
      receiverId: winnerId,
      text: `📊 ${session.gameType.toUpperCase()} finished. @${statsPayload.winner.username} won this round. My total wins: ${statsPayload.loser.gameStats?.totalWon || 0}/${statsPayload.loser.gameStats?.totalPlayed || 0}.`,
    },
  ];

  for (const payload of summaries) {
    const summaryMessage = await Message.create(payload);
    const populatedMessage = await Message.findById(summaryMessage._id);
    const receiverSocketId = getReceiverSocketId(payload.receiverId);
    const senderSocketId = getReceiverSocketId(payload.senderId);
    if (receiverSocketId) io.to(receiverSocketId).emit('newMessage', populatedMessage);
    if (senderSocketId) io.to(senderSocketId).emit('newMessage', populatedMessage);
    emitLastMessageToParticipants(populatedMessage);
  }
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

  const resumedSession = getActiveSessionByPlayer(userId);
  if (resumedSession) {
    socket.emit('game:resume-required', getPlayerState(resumedSession.id, userId));
  }

  socket.on('isTyping', ({ senderId, receiverId }) => {
    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) io.to(receiverSocketId).emit('typing', { senderId });
  });

  socket.on('isTypingStop', ({ senderId, receiverId }) => {
    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) io.to(receiverSocketId).emit('typing:stop', { senderId });
  });

  socket.on('game:invite', ({ toUserId, gameType }) => {
    if (!toUserId || !['whot', 'ludo'].includes(gameType)) return;

    const senderSession = getActiveSessionByPlayer(userId);
    if (senderSession) {
      socket.emit('game:error', { message: 'You are already in a room. Finish or forfeit that game first.' });
      return;
    }

    const receiverSocketId = getReceiverSocketId(toUserId);
    if (!receiverSocketId) {
      socket.emit('game:error', { message: 'User is offline. Invite failed.' });
      return;
    }

    const receiverSession = getActiveSessionByPlayer(toUserId);
    if (receiverSession) {
      socket.emit('game:error', { message: 'That user is already in a room.' });
      io.to(receiverSocketId).emit('game:invite:missed', {
        id: crypto.randomUUID(),
        gameType,
        fromUserId: userId,
        fromName: socket.user?.username || 'Player',
        createdAt: Date.now(),
      });
      return;
    }

    const invite = createInvite({ fromUserId: userId, toUserId, gameType });
    io.to(receiverSocketId).emit('game:invite', { ...invite, fromUser: { _id: userId, username: socket.user?.username || 'Player' } });
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
      const statsPayload = await updateGameStats(result.session);
      await sendGameSummaryMessages(result.session, statsPayload);
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
    const statsPayload = await updateGameStats(session);
    await sendGameSummaryMessages(session, statsPayload);
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

  socket.on('call:start', ({ toUserId, media }) => {
    if (!toUserId || toUserId === userId) return;
    if (findCallSessionByUserId(userId) || findCallSessionByUserId(toUserId)) {
      socket.emit('call:unavailable', { toUserId, reason: 'busy' });
      return;
    }

    const receiverSocketId = getReceiverSocketId(toUserId);
    if (!receiverSocketId) {
      socket.emit('call:unavailable', { toUserId, reason: 'offline' });
      return;
    }

    const session = buildCallSession({ callerId: userId, calleeId: toUserId, media });
    io.to(receiverSocketId).emit('call:incoming', {
      sessionId: session.id,
      media: session.media,
      fromUserId: userId,
      fromUser: {
        _id: userId,
        username: socket.user?.username || 'User',
        profilePicture: socket.user?.profilePicture || '',
      },
    });
  });

  socket.on('call:accept', ({ toUserId, media, sessionId }) => {
    const session = callSessionMap.get(sessionId) || findCallSessionByUserId(userId);
    if (!session || !session.participants.includes(toUserId?.toString())) return;
    session.status = 'active';
    session.media = { video: Boolean(media?.video) };

    const receiverSocketId = getReceiverSocketId(toUserId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('call:accepted', { fromUserId: userId, media: session.media, sessionId: session.id });
    }
  });

  socket.on('call:decline', ({ toUserId, sessionId }) => {
    const session = callSessionMap.get(sessionId) || findCallSessionByUserId(userId);
    if (session) removeCallSession(session.id);
    const receiverSocketId = getReceiverSocketId(toUserId);
    if (receiverSocketId) io.to(receiverSocketId).emit('call:declined', { fromUserId: userId });
  });

  socket.on('call:end', ({ toUserId, sessionId }) => {
    const session = callSessionMap.get(sessionId) || findCallSessionByUserId(userId);
    if (session) removeCallSession(session.id);
    const receiverSocketId = getReceiverSocketId(toUserId);
    if (receiverSocketId) io.to(receiverSocketId).emit('call:ended', { fromUserId: userId });
  });

  socket.on('call:signal', ({ toUserId, description, candidate }) => {
    const receiverSocketId = getReceiverSocketId(toUserId);
    if (!receiverSocketId) {
      socket.emit('call:unavailable', { toUserId, reason: 'offline' });
      return;
    }

    io.to(receiverSocketId).emit('call:signal', {
      fromUserId: userId,
      description: description || null,
      candidate: candidate || null,
    });
  });

  socket.on('call:resume:request', async () => {
    await emitCallResumeIfNeeded(socket, userId);
  });

  socket.on('call:rejoin', ({ sessionId }) => {
    const session = callSessionMap.get(sessionId) || findCallSessionByUserId(userId);
    if (!session) return;
    tryRenegotiateCall(session);
  });

  socket.on('user:active', async () => {
    userSocketMap[userId] = socket.id;
    await User.findByIdAndUpdate(userId, { lastSeen: new Date() });
    emitPresence();
    io.emit('user:last-seen', { userId, lastSeen: new Date().toISOString(), isOnline: true });
    await processPendingDeliveries(userId);

    const resumedSession = getActiveSessionByPlayer(userId);
    if (resumedSession) {
      socket.emit('game:resume-required', getPlayerState(resumedSession.id, userId));
    }
    await emitCallResumeIfNeeded(socket, userId);
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
