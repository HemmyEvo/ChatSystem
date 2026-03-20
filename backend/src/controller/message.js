import cloudinary from "../lib/cloudinary.js";
import { getReceiverSocketId, io } from "../lib/socket.js";
import Message from "../models/Message.js";
import User from "../models/User.js";

const canInteract = async (senderId, receiverId) => {
  const [sender, receiver] = await Promise.all([
    User.findById(senderId).select('blockedUsers friends'),
    User.findById(receiverId).select('blockedUsers friends'),
  ]);

  if (!sender || !receiver) return { ok: false, message: 'User not found', code: 404 };

  const senderBlockedReceiver = sender.blockedUsers.some((id) => id.toString() === receiverId.toString());
  const receiverBlockedSender = receiver.blockedUsers.some((id) => id.toString() === senderId.toString());

  if (senderBlockedReceiver || receiverBlockedSender) {
    return { ok: false, message: 'Messaging is blocked between these users', code: 403 };
  }

  const areFriends = sender.friends.some((id) => id.toString() === receiverId.toString());
  if (!areFriends) {
    return { ok: false, message: 'You can only chat with friends', code: 403 };
  }

  return { ok: true };
};

const visibleFilter = (myId) => ({ deletedFor: { $ne: myId } });

const STATUS_LIFETIME_MS = 24 * 60 * 60 * 1000;

const getIdString = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value._id) return value._id.toString();
  return value.toString();
};

const getActiveStatusItems = (statusItems = []) =>
  statusItems
    .filter((item) => new Date(item.expiresAt).getTime() > Date.now())
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

const serializeStatusUser = (user, viewerId) => {
  const viewerIdStr = getIdString(viewerId);
  const activeStatuses = getActiveStatusItems(user.statusItems).map((status) => ({
    _id: status._id,
    type: status.type,
    text: status.text,
    mediaUrl: status.mediaUrl,
    backgroundColor: status.backgroundColor,
    textColor: status.textColor,
    createdAt: status.createdAt,
    expiresAt: status.expiresAt,
    viewersCount: status.viewers?.length || 0,
    viewers: (status.viewers || []).map((viewer) => ({
      _id: viewer._id || viewer,
      username: viewer.username || '',
      profilePicture: viewer.profilePicture || '',
    })),
    reactions: (status.reactions || []).map((reaction) => ({
      userId: reaction.userId?._id || reaction.userId,
      username: reaction.userId?.username || '',
      profilePicture: reaction.userId?.profilePicture || '',
      emoji: reaction.emoji,
    })),
    seen: (status.viewers || []).some((viewer) => getIdString(viewer) === viewerIdStr),
  }));

  return {
    _id: user._id,
    username: user.username,
    profilePicture: user.profilePicture,
    bio: user.bio,
    statuses: activeStatuses,
    hasUnseen: activeStatuses.some((status) => !status.seen),
  };
};

const serializeMessageForViewer = (message, viewerId) => {
  const plain = typeof message.toObject === 'function' ? message.toObject() : { ...message };
  const viewerIdStr = getIdString(viewerId);
  const senderId = getIdString(plain.senderId);
  const receiverId = getIdString(plain.receiverId);
  const isSender = viewerIdStr === senderId;
  const hasBeenViewed = (plain.viewedBy || []).some((entry) => getIdString(entry) === receiverId);
  const isLockedForViewer = Boolean(plain.viewOnce && !isSender && hasBeenViewed);

  return {
    ...plain,
    viewOnceOpened: Boolean(plain.viewOnce && !isSender && hasBeenViewed),
    viewOnceOpenedByPeer: Boolean(plain.viewOnce && isSender && hasBeenViewed),
    canOpenViewOnce: Boolean(plain.viewOnce && !isSender && !hasBeenViewed),
    image: isLockedForViewer ? null : plain.image,
    sticker: plain.sticker,
    video: isLockedForViewer ? null : plain.video,
  };
};

const mapRelationship = (viewer, user) => ({
  _id: user._id,
  username: user.username,
  email: user.email,
  profilePicture: user.profilePicture,
  bio: user.bio,
  lastSeen: user.lastSeen,
  isFriend: viewer.friends.some((id) => id.toString() === user._id.toString()),
  requestSent: viewer.friendRequestsSent.some((id) => id.toString() === user._id.toString()),
  requestReceived: viewer.friendRequestsReceived.some((id) => id.toString() === user._id.toString()),
});

export const messageController = {
  people: async (req, res) => {
    try {
      const loggedInUserId = req.user._id;
      const search = (req.query.search || '').trim();
      const loggedInUser = await User.findById(loggedInUserId).select('friends friendRequestsSent friendRequestsReceived');
      const query = { _id: { $ne: loggedInUserId } };
      if (search) {
        query.username = { $regex: search, $options: 'i' };
      }
      const users = await User.find(query).select('-password').sort({ username: 1 }).limit(search ? 50 : 100);
      return res.status(200).json({ people: users.map((user) => mapRelationship(loggedInUser, user)) });
    } catch (error) {
      console.log('Error fetching people:', error);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  friendList: async (req, res) => {
    try {
      const loggedInUser = await User.findById(req.user._id)
        .populate('friends', 'username email profilePicture bio lastSeen')
        .select('friends');
      return res.status(200).json({ friends: loggedInUser?.friends || [] });
    } catch (error) {
      console.log('Error fetching friends:', error);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  sendFriendRequest: async (req, res) => {
    try {
      const myId = req.user._id;
      const { id: targetUserId } = req.params;
      if (myId.toString() === targetUserId) return res.status(400).json({ message: 'You cannot send a request to yourself' });

      const [me, target] = await Promise.all([
        User.findById(myId).select('friends friendRequestsSent friendRequestsReceived username profilePicture'),
        User.findById(targetUserId).select('friends friendRequestsSent friendRequestsReceived username profilePicture'),
      ]);
      if (!target) return res.status(404).json({ message: 'User not found' });
      if (me.friends.some((id) => id.toString() === targetUserId)) {
        return res.status(400).json({ message: 'You are already friends' });
      }
      if (me.friendRequestsSent.some((id) => id.toString() === targetUserId)) {
        return res.status(400).json({ message: 'Friend request already sent' });
      }

      await Promise.all([
        User.findByIdAndUpdate(myId, { $addToSet: { friendRequestsSent: targetUserId } }),
        User.findByIdAndUpdate(targetUserId, { $addToSet: { friendRequestsReceived: myId } }),
      ]);

      const targetSocketId = getReceiverSocketId(targetUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('friend:request:received', {
          fromUser: { _id: me._id, username: me.username, profilePicture: me.profilePicture },
        });
      }

      return res.status(200).json({ message: 'Friend request sent' });
    } catch (error) {
      console.log('Error sending friend request:', error);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  respondToFriendRequest: async (req, res) => {
    try {
      const myId = req.user._id;
      const { id: requesterId } = req.params;
      const { accept } = req.body;
      const [me, requester] = await Promise.all([
        User.findById(myId).select('friendRequestsReceived friends username profilePicture'),
        User.findById(requesterId).select('friendRequestsSent friends username profilePicture'),
      ]);
      if (!requester) return res.status(404).json({ message: 'User not found' });
      if (!me.friendRequestsReceived.some((id) => id.toString() === requesterId)) {
        return res.status(400).json({ message: 'No pending request from this user' });
      }

      const updates = [
        User.findByIdAndUpdate(myId, { $pull: { friendRequestsReceived: requesterId }, ...(accept ? { $addToSet: { friends: requesterId } } : {}) }),
        User.findByIdAndUpdate(requesterId, { $pull: { friendRequestsSent: myId }, ...(accept ? { $addToSet: { friends: myId } } : {}) }),
      ];
      await Promise.all(updates);

      if (accept) {
        const acceptanceMessage = await Message.create({
          senderId: myId,
          receiverId: requesterId,
          text: `🤝 @${me.username} accepted your friend request. You can start chatting and call now.`,
        });

        const populatedAcceptanceMessage = await Message.findById(acceptanceMessage._id)
          .populate('replyTo', 'text image video audio document location senderId createdAt')
          .populate('sharedContactId', 'username profilePicture email');

        const mySocketId = getReceiverSocketId(myId);
        const requesterSocketId = getReceiverSocketId(requesterId);

        if (mySocketId) {
          io.to(mySocketId).emit('newMessage', populatedAcceptanceMessage);
          io.to(mySocketId).emit('chat:last-message', populatedAcceptanceMessage);
        }

        if (requesterSocketId) {
          io.to(requesterSocketId).emit('newMessage', populatedAcceptanceMessage);
          io.to(requesterSocketId).emit('chat:last-message', populatedAcceptanceMessage);
        }
      }

      const requesterSocketId = getReceiverSocketId(requesterId);
      if (requesterSocketId) {
        io.to(requesterSocketId).emit('friend:request:responded', {
          userId: myId.toString(),
          accepted: Boolean(accept),
          user: { _id: me._id, username: me.username, profilePicture: me.profilePicture },
        });
      }

      return res.status(200).json({ message: accept ? 'Friend request accepted' : 'Friend request declined' });
    } catch (error) {
      console.log('Error responding to friend request:', error);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  chats: async (req, res) => {
    try {
      const loggedInUserId = req.user._id;
      const messages = await Message.find({
        $and: [
          { $or: [{ senderId: loggedInUserId }, { receiverId: loggedInUserId }] },
          visibleFilter(loggedInUserId),
        ],
      }).sort({ createdAt: -1 });

      const chatPartnerIds = [
        ...new Set(
          messages.map((msg) =>
            msg.senderId.toString() === loggedInUserId.toString()
              ? msg.receiverId.toString()
              : msg.senderId.toString(),
          ),
        ),
      ];

      const lastMessageByPartner = {};
      messages.forEach((msg) => {
        const partnerId =
          msg.senderId.toString() === loggedInUserId.toString()
            ? msg.receiverId.toString()
            : msg.senderId.toString();

        if (!lastMessageByPartner[partnerId]) {
          lastMessageByPartner[partnerId] = msg;
        }
      });

      const chatPartners = await User.find({ _id: { $in: chatPartnerIds } }).select('-password');

      const unreadByPartner = await Message.aggregate([
        {
          $match: {
            receiverId: loggedInUserId,
            readBy: { $ne: loggedInUserId },
            deletedFor: { $ne: loggedInUserId },
          },
        },
        {
          $group: {
            _id: '$senderId',
            count: { $sum: 1 },
          },
        },
      ]);

      const unreadMap = unreadByPartner.reduce((acc, item) => {
        acc[item._id.toString()] = item.count;
        return acc;
      }, {});

      return res.status(200).json({
        chatPartners: chatPartners.map((partner) => ({
          _id: partner._id,
          username: partner.username,
          email: partner.email,
          profilePicture: partner.profilePicture,
          bio: partner.bio,
          lastSeen: partner.lastSeen,
          lastMessage: lastMessageByPartner[partner._id.toString()]
            ? serializeMessageForViewer(lastMessageByPartner[partner._id.toString()], loggedInUserId)
            : null,
          unreadCount: unreadMap[partner._id.toString()] || 0,
        })),
      });
    } catch (error) {
      console.log('Error fetching chats:', error);
      return res.status(500).json({ message: "Server error" });
    }
  },

  messageById: async (req, res) => {
    try {
      const myId = req.user._id;
      const { id: userToChatId } = req.params;

      const messages = await Message.find({
        $and: [
          {
            $or: [
              { senderId: myId, receiverId: userToChatId },
              { senderId: userToChatId, receiverId: myId },
            ],
          },
          visibleFilter(myId),
        ],
      })
        .populate('replyTo', 'text image video audio document location senderId createdAt')
        .populate('sharedContactId', 'username profilePicture email')
        .sort({ createdAt: 1 });

      return res.status(200).json({ messages: messages.map((message) => serializeMessageForViewer(message, myId)) });
    } catch (error) {
      console.error('Error fetching messages:', error);
      return res.status(500).json({ message: "Server error" });
    }
  },

  sendMessage: async (req, res) => {
    try {
      const { text, image, sticker, video, audio, document, sharedContactId, replyTo, location, viewOnce } = req.body;
      const senderId = req.user._id;
      const { id: receiverId } = req.params;

      if (!text && !image && !sticker && !video && !audio && !document && !sharedContactId && !location) {
        return res.status(400).json({ message: "Message content is required" });
      }

      if (viewOnce && !(image || video)) {
        return res.status(400).json({ message: 'View once is only available for photos and videos' });
      }

      const interactionCheck = await canInteract(senderId, receiverId);
      if (!interactionCheck.ok) {
        return res.status(interactionCheck.code).json({ message: interactionCheck.message });
      }

      const uploadMedia = async (fileBase64) => {
        if (!fileBase64) return null;
        const uploadResult = await cloudinary.uploader.upload(fileBase64, {
          resource_type: 'auto',
          folder: 'chat_attachments',
        });
        return uploadResult.secure_url;
      };

      const [imageUrl, stickerUrl, videoUrl, audioUrl, documentUrl] = await Promise.all([
        uploadMedia(image),
        uploadMedia(sticker),
        uploadMedia(video),
        uploadMedia(audio),
        uploadMedia(document),
      ]);

      const newMessage = new Message({
        senderId,
        receiverId,
        text,
        image: imageUrl,
        sticker: stickerUrl,
        video: videoUrl,
        audio: audioUrl,
        document: documentUrl,
        viewOnce: Boolean(viewOnce),
        sharedContactId,
        location,
        replyTo,
      });

      await newMessage.save();
      await newMessage.populate('replyTo', 'text image video audio document location senderId createdAt');
      if (sharedContactId) await newMessage.populate('sharedContactId', 'username profilePicture email');

      const receiverSocketId = getReceiverSocketId(receiverId);
      const serializedForReceiver = serializeMessageForViewer(newMessage, receiverId);
      const serializedForSender = serializeMessageForViewer(newMessage, senderId);

      if (receiverSocketId) io.to(receiverSocketId).emit('newMessage', serializedForReceiver);

      const senderSocketId = getReceiverSocketId(senderId.toString());
      if (senderSocketId) io.to(senderSocketId).emit('chat:last-message', serializedForSender);
      if (receiverSocketId) io.to(receiverSocketId).emit('chat:last-message', serializedForReceiver);

      return res.status(201).json({ message: 'Message sent successfully', data: serializedForSender });
    } catch (error) {
      console.error('Error sending message:', error);
      if (error.http_code === 413) {
        return res.status(413).json({ message: 'File is too large' });
      }
      return res.status(500).json({ message: 'Server error' });
    }
  },

  reactToMessage: async (req, res) => {
    try {
      const myId = req.user._id;
      const { id: messageId } = req.params;
      const { emoji } = req.body;
      const message = await Message.findById(messageId);
      if (!message) return res.status(404).json({ message: 'Message not found' });

      message.reactions = (message.reactions || []).filter((r) => r.userId.toString() !== myId.toString());
      if (emoji) message.reactions.push({ userId: myId, emoji });
      await message.save();

      const receiverSocketId = getReceiverSocketId(message.receiverId.toString());
      const senderSocketId = getReceiverSocketId(message.senderId.toString());
      if (receiverSocketId) io.to(receiverSocketId).emit('message:reaction-updated', { messageId, reactions: message.reactions });
      if (senderSocketId) io.to(senderSocketId).emit('message:reaction-updated', { messageId, reactions: message.reactions });

      return res.status(200).json({ message: 'Reaction updated', reactions: message.reactions });
    } catch (error) {
      console.error('Error reacting to message:', error);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  statuses: async (req, res) => {
    try {
      const myId = req.user._id;
      const me = await User.findById(myId)
        .populate({
          path: 'friends',
          select: 'username profilePicture bio statusItems',
          populate: [
            { path: 'statusItems.viewers', select: 'username profilePicture' },
            { path: 'statusItems.reactions.userId', select: 'username profilePicture' },
          ],
        })
        .populate('statusItems.viewers', 'username profilePicture')
        .populate('statusItems.reactions.userId', 'username profilePicture')
        .select('username profilePicture bio statusItems friends');

      const usersWithStatuses = [me, ...(me?.friends || [])]
        .filter(Boolean)
        .map((user) => serializeStatusUser(user, myId))
        .filter((user) => user.statuses.length > 0);

      return res.status(200).json({ statuses: usersWithStatuses });
    } catch (error) {
      console.error('Error fetching statuses:', error);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  postStatus: async (req, res) => {
    try {
      const userId = req.user._id;
      const { text, image, video, backgroundColor, textColor } = req.body;

      if (!text && !image && !video) {
        return res.status(400).json({ message: 'Status content is required' });
      }

      let mediaUrl = '';
      let type = 'text';

      if (image || video) {
        const uploaded = await cloudinary.uploader.upload(image || video, {
          resource_type: 'auto',
          folder: 'chat_statuses',
        });
        mediaUrl = uploaded.secure_url;
        type = image ? 'image' : 'video';
      }

      const statusItem = {
        type,
        text: (text || '').trim(),
        mediaUrl,
        backgroundColor: backgroundColor || '#0b141a',
        textColor: textColor || '#ffffff',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + STATUS_LIFETIME_MS),
        viewers: [],
      };

      const updatedUser = await User.findById(userId).select('username profilePicture bio statusItems');
      updatedUser.statusItems = getActiveStatusItems(updatedUser.statusItems);
      updatedUser.statusItems.push(statusItem);
      updatedUser.statusItems = updatedUser.statusItems.slice(-30);
      await updatedUser.save();
      await updatedUser.populate('statusItems.viewers', 'username profilePicture');
      await updatedUser.populate('statusItems.reactions.userId', 'username profilePicture');

      return res.status(201).json({ statusUser: serializeStatusUser(updatedUser, userId) });
    } catch (error) {
      console.error('Error posting status:', error);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  viewStatus: async (req, res) => {
    try {
      const viewerId = req.user._id;
      const { id: statusId } = req.params;
      const owner = await User.findOne({ 'statusItems._id': statusId })
        .populate('statusItems.viewers', 'username profilePicture')
        .populate('statusItems.reactions.userId', 'username profilePicture')
        .select('username profilePicture bio friends statusItems');
      if (!owner) return res.status(404).json({ message: 'Status not found' });

      const isOwner = owner._id.toString() === viewerId.toString();
      const isFriend = owner.friends?.some((friendId) => friendId.toString() === viewerId.toString());
      if (!isOwner && !isFriend) {
        return res.status(403).json({ message: 'You can only view statuses from your contacts' });
      }

      if (!isOwner) {
        await User.updateOne(
          { _id: owner._id, 'statusItems._id': statusId },
          { $addToSet: { 'statusItems.$.viewers': viewerId } },
        );
      }

      const refreshedOwner = await User.findById(owner._id)
        .populate('statusItems.viewers', 'username profilePicture')
        .populate('statusItems.reactions.userId', 'username profilePicture')
        .select('username profilePicture bio statusItems');
      return res.status(200).json({ statusUser: serializeStatusUser(refreshedOwner, viewerId) });
    } catch (error) {
      console.error('Error viewing status:', error);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  reactToStatus: async (req, res) => {
    try {
      const userId = req.user._id;
      const { id: statusId } = req.params;
      const { emoji } = req.body;
      const owner = await User.findOne({ 'statusItems._id': statusId }).select('statusItems username profilePicture bio friends');
      if (!owner) return res.status(404).json({ message: 'Status not found' });

      const status = owner.statusItems.id(statusId);
      if (!status) return res.status(404).json({ message: 'Status not found' });

      status.reactions = (status.reactions || []).filter((reaction) => reaction.userId.toString() !== userId.toString());
      if (emoji) status.reactions.push({ userId, emoji });
      await owner.save();
      await owner.populate('statusItems.viewers', 'username profilePicture');
      await owner.populate('statusItems.reactions.userId', 'username profilePicture');

      return res.status(200).json({ statusUser: serializeStatusUser(owner, userId) });
    } catch (error) {
      console.error('Error reacting to status:', error);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  openViewOnceMessage: async (req, res) => {
    try {
      const viewerId = req.user._id;
      const { id: messageId } = req.params;
      const message = await Message.findById(messageId)
        .populate('replyTo', 'text image video audio document location senderId createdAt')
        .populate('sharedContactId', 'username profilePicture email');

      if (!message) return res.status(404).json({ message: 'Message not found' });

      const isParticipant =
        message.senderId.toString() === viewerId.toString() ||
        message.receiverId.toString() === viewerId.toString();

      if (!isParticipant) return res.status(403).json({ message: 'Unauthorized' });
      if (!message.viewOnce) return res.status(400).json({ message: 'This message is not view once' });

      const mediaUrl = message.image || message.video || '';
      const mediaType = message.image ? 'image' : message.video ? 'video' : null;
      const isSender = message.senderId.toString() === viewerId.toString();
      const receiverAlreadyViewed = (message.viewedBy || []).some((entry) => entry.toString() === message.receiverId.toString());

      if (!isSender && receiverAlreadyViewed) {
        return res.status(410).json({ message: 'This view once media has already been opened' });
      }

      if (!isSender) {
        message.viewedBy = Array.from(new Set([...(message.viewedBy || []).map((entry) => entry.toString()), viewerId.toString()]));
        await message.save();
      }

      return res.status(200).json({
        mediaUrl,
        mediaType,
        message: serializeMessageForViewer(message, viewerId),
      });
    } catch (error) {
      console.error('Error opening view once message:', error);
      return res.status(500).json({ message: 'Server error' });
    }
  },

 markAsRead: async (req, res) => {
    try {
      const myId = req.user._id;
      const { id: chatUserId } = req.params;
      const unreadMessages = await Message.find({ senderId: chatUserId, receiverId: myId, readBy: { $ne: myId }, deletedFor: { $ne: myId } }).select('_id');

      if (unreadMessages.length) {
        await Message.updateMany(
          { _id: { $in: unreadMessages.map((m) => m._id) } }, 
          { $addToSet: { readBy: myId, deliveredTo: myId }, $set: { readAt: new Date() } }
        );
        const chatUserSocketId = getReceiverSocketId(chatUserId);
        if (chatUserSocketId) {
          io.to(chatUserSocketId).emit('messages:read', { readerId: myId.toString(), chatUserId, messageIds: unreadMessages.map((m) => m._id.toString()), readAt: new Date().toISOString() });
        }
      }

      return res.status(200).json({ message: 'Messages marked as read' });
    } catch (error) {
      console.error('Error marking messages as read:', error);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  blockUser: async (req, res) => {
    try {
      const myId = req.user._id;
      const { id: blockedUserId } = req.params;
      const updatedUser = await User.findByIdAndUpdate(myId, { $addToSet: { blockedUsers: blockedUserId } }, { new: true }).select('blockedUsers');
      const blockedSocketId = getReceiverSocketId(blockedUserId);
      if (blockedSocketId) io.to(blockedSocketId).emit('chat:blocked', { byUserId: myId.toString() });
      return res.status(200).json({ message: 'User blocked', blockedUsers: updatedUser.blockedUsers });
    } catch (error) {
      console.error('Error blocking user:', error);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  deleteAllMessagesWithUser: async (req, res) => {
    try {
      const myId = req.user._id;
      const { id: targetUserId } = req.params;
      await Message.updateMany({
        $or: [
          { senderId: myId, receiverId: targetUserId },
          { senderId: targetUserId, receiverId: myId },
        ],
      }, { $addToSet: { deletedFor: myId } });
      return res.status(200).json({ message: 'Chat deleted for you' });
    } catch (error) {
      console.error('Error deleting all messages:', error);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  deleteMessageForMe: async (req, res) => {
    try {
      const myId = req.user._id;
      const { id: messageId } = req.params;
      const message = await Message.findOneAndUpdate(
        {
          _id: messageId,
          $or: [{ senderId: myId }, { receiverId: myId }],
          deletedFor: { $ne: myId },
        },
        { $addToSet: { deletedFor: myId } },
        { new: true },
      );

      if (!message) return res.status(404).json({ message: 'Message not found' });

      const chatUserId = message.senderId.toString() === myId.toString()
        ? message.receiverId.toString()
        : message.senderId.toString();

      const lastVisibleMessage = await Message.findOne({
        $and: [
          {
            $or: [
              { senderId: myId, receiverId: chatUserId },
              { senderId: chatUserId, receiverId: myId },
            ],
          },
          visibleFilter(myId),
        ],
      })
        .sort({ createdAt: -1 })
        .populate('replyTo', 'text image video audio document location senderId createdAt')
        .populate('sharedContactId', 'username profilePicture email');

      return res.status(200).json({
        message: 'Message deleted for you',
        chatUserId,
        lastMessage: lastVisibleMessage ? serializeMessageForViewer(lastVisibleMessage, myId) : null,
      });
    } catch (error) {
      console.error('Error deleting message for me:', error);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  deleteMessageForEveryone: async (req, res) => {
    try {
      const myId = req.user._id;
      const { id: messageId } = req.params;
      const message = await Message.findOne({ _id: messageId, senderId: myId });
      if (!message) return res.status(404).json({ message: 'Message not found or not your message' });

      const chatUserId = message.receiverId.toString();
      await Message.findByIdAndDelete(messageId);

      const [senderLastMessage, receiverLastMessage] = await Promise.all([
        Message.findOne({
          $and: [
            {
              $or: [
                { senderId: myId, receiverId: chatUserId },
                { senderId: chatUserId, receiverId: myId },
              ],
            },
            visibleFilter(myId),
          ],
        })
          .sort({ createdAt: -1 })
          .populate('replyTo', 'text image video audio document location senderId createdAt')
          .populate('sharedContactId', 'username profilePicture email'),
        Message.findOne({
          $and: [
            {
              $or: [
                { senderId: myId, receiverId: chatUserId },
                { senderId: chatUserId, receiverId: myId },
              ],
            },
            visibleFilter(chatUserId),
          ],
        })
          .sort({ createdAt: -1 })
          .populate('replyTo', 'text image video audio document location senderId createdAt')
          .populate('sharedContactId', 'username profilePicture email'),
      ]);

      const receiverSocketId = getReceiverSocketId(chatUserId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('message:deleted-everyone', {
          messageId,
          chatUserId: myId.toString(),
          lastMessage: receiverLastMessage ? serializeMessageForViewer(receiverLastMessage, chatUserId) : null,
        });
      }

      const senderSocketId = getReceiverSocketId(myId.toString());
      if (senderSocketId) {
        io.to(senderSocketId).emit('message:deleted-everyone', {
          messageId,
          chatUserId,
          lastMessage: senderLastMessage ? serializeMessageForViewer(senderLastMessage, myId) : null,
        });
      }

      return res.status(200).json({
        message: 'Message deleted for everyone',
        chatUserId,
        lastMessage: senderLastMessage ? serializeMessageForViewer(senderLastMessage, myId) : null,
      });
    } catch (error) {
      console.error('Error deleting message for everyone:', error);
      return res.status(500).json({ message: 'Server error' });
    }
  },
};
