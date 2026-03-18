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

const mapRelationship = (viewer, user) => ({
  _id: user._id,
  username: user.username,
  email: user.email,
  profilePicture: user.profilePicture,
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
        .populate('friends', 'username email profilePicture lastSeen')
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
          lastSeen: partner.lastSeen,
          lastMessage: lastMessageByPartner[partner._id.toString()] || null,
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
        .populate('replyTo', 'text image video audio document senderId createdAt')
        .populate('sharedContactId', 'username profilePicture email')
        .sort({ createdAt: 1 });

      return res.status(200).json({ messages });
    } catch (error) {
      console.error('Error fetching messages:', error);
      return res.status(500).json({ message: "Server error" });
    }
  },

  sendMessage: async (req, res) => {
    try {
      const { text, image, video, audio, document, sharedContactId, replyTo } = req.body;
      const senderId = req.user._id;
      const { id: receiverId } = req.params;

      if (!text && !image && !video && !audio && !document && !sharedContactId) {
        return res.status(400).json({ message: "Message content is required" });
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

      const [imageUrl, videoUrl, audioUrl, documentUrl] = await Promise.all([
        uploadMedia(image),
        uploadMedia(video),
        uploadMedia(audio),
        uploadMedia(document),
      ]);

      const newMessage = new Message({
        senderId,
        receiverId,
        text,
        image: imageUrl,
        video: videoUrl,
        audio: audioUrl,
        document: documentUrl,
        sharedContactId,
        replyTo,
      });

      await newMessage.save();
      await newMessage.populate('replyTo', 'text image video audio document senderId createdAt');
      if (sharedContactId) await newMessage.populate('sharedContactId', 'username profilePicture email');

      const receiverSocketId = getReceiverSocketId(receiverId);
      if (receiverSocketId) io.to(receiverSocketId).emit('newMessage', newMessage);

      const senderSocketId = getReceiverSocketId(senderId.toString());
      if (senderSocketId) io.to(senderSocketId).emit('chat:last-message', newMessage);
      if (receiverSocketId) io.to(receiverSocketId).emit('chat:last-message', newMessage);

      return res.status(201).json({ message: 'Message sent successfully', data: newMessage });
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
      await Message.findByIdAndUpdate(messageId, { $addToSet: { deletedFor: myId } });
      return res.status(200).json({ message: 'Message deleted for you' });
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
      await Message.findByIdAndDelete(messageId);
      return res.status(200).json({ message: 'Message deleted for everyone' });
    } catch (error) {
      console.error('Error deleting message for everyone:', error);
      return res.status(500).json({ message: 'Server error' });
    }
  },
};
