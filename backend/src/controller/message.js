import cloudinary from "../lib/cloudinary.js";
import { getReceiverSocketId, io } from "../lib/socket.js";
import Message from "../models/Message.js";
import User from "../models/User.js";

const canInteract = async (senderId, receiverId) => {
  const [sender, receiver] = await Promise.all([
    User.findById(senderId).select('blockedUsers'),
    User.findById(receiverId).select('blockedUsers'),
  ]);

  if (!sender || !receiver) return { ok: false, message: 'User not found', code: 404 };

  const senderBlockedReceiver = sender.blockedUsers.some((id) => id.toString() === receiverId.toString());
  const receiverBlockedSender = receiver.blockedUsers.some((id) => id.toString() === senderId.toString());

  if (senderBlockedReceiver || receiverBlockedSender) {
    return { ok: false, message: 'Messaging is blocked between these users', code: 403 };
  }

  return { ok: true };
};

const visibleFilter = (myId) => ({ deletedFor: { $ne: myId } });

export const messageController = {
  contact: async (req, res) => {
    try {
      const loggedInUserId = req.user._id;
      const filteredUsers = await User.find({ _id: { $ne: loggedInUserId } }).select('-password');
      return res.status(200).json({ filteredUsers });
    } catch (error) {
      console.log('Error fetching contacts:', error);
      return res.status(500).json({ message: "Server error" });
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
          fullname: partner.fullname,
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
        .populate('sharedContactId', 'fullname profilePicture email')
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
      if (sharedContactId) await newMessage.populate('sharedContactId', 'fullname profilePicture email');

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
          // NEW: Ensure deliveredTo is also updated
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
