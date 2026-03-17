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
        $or: [{ senderId: loggedInUserId }, { receiverId: loggedInUserId }],
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

      return res.status(200).json({
        chatPartners: chatPartners.map((partner) => ({
          _id: partner._id,
          fullname: partner.fullname,
          email: partner.email,
          profilePicture: partner.profilePicture,
          lastSeen: partner.lastSeen,
          lastMessage: lastMessageByPartner[partner._id.toString()] || null,
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
      if (myId.toString() === userToChatId) {
        return res.status(400).json({ message: "Cannot fetch messages with yourself" });
      }

      const messages = await Message.find({
        $or: [
          { senderId: myId, receiverId: userToChatId },
          { senderId: userToChatId, receiverId: myId },
        ],
      })
        .populate('replyTo', 'text image video audio document senderId createdAt')
        .populate('sharedContactId', 'fullname profilePicture email');

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

      if (senderId.toString() === receiverId) {
        return res.status(400).json({ message: "Cannot send a message to yourself" });
      }

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
      if (sharedContactId) {
        await newMessage.populate('sharedContactId', 'fullname profilePicture email');
      }

      const receiverSocketId = getReceiverSocketId(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('newMessage', newMessage);
      }

      const senderSocketId = getReceiverSocketId(senderId.toString());
      if (senderSocketId) {
        io.to(senderSocketId).emit('chat:last-message', newMessage);
      }
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('chat:last-message', newMessage);
      }

      return res.status(201).json({ message: 'Message sent successfully', data: newMessage });
    } catch (error) {
      console.error('Error sending message:', error);
      if (error.http_code === 413) {
        return res.status(413).json({ message: 'File is too large' });
      }
      return res.status(500).json({ message: 'Server error' });
    }
  },

  markAsRead: async (req, res) => {
    try {
      const myId = req.user._id;
      const { id: chatUserId } = req.params;

      const unreadMessages = await Message.find({
        senderId: chatUserId,
        receiverId: myId,
        readBy: { $ne: myId },
      }).select('_id');

      if (unreadMessages.length) {
        await Message.updateMany(
          { _id: { $in: unreadMessages.map((m) => m._id) } },
          { $addToSet: { readBy: myId }, $set: { readAt: new Date() } },
        );

        const chatUserSocketId = getReceiverSocketId(chatUserId);
        if (chatUserSocketId) {
          io.to(chatUserSocketId).emit('messages:read', {
            readerId: myId.toString(),
            chatUserId,
            messageIds: unreadMessages.map((m) => m._id.toString()),
            readAt: new Date().toISOString(),
          });
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
      if (myId.toString() === blockedUserId) {
        return res.status(400).json({ message: 'Cannot block yourself' });
      }

      const updatedUser = await User.findByIdAndUpdate(
        myId,
        { $addToSet: { blockedUsers: blockedUserId } },
        { new: true },
      ).select('blockedUsers');

      const blockedSocketId = getReceiverSocketId(blockedUserId);
      if (blockedSocketId) {
        io.to(blockedSocketId).emit('chat:blocked', { byUserId: myId.toString() });
      }
      return res.status(200).json({ message: 'User blocked', blockedUsers: updatedUser.blockedUsers });
    } catch (error) {
      console.error('Error blocking user:', error);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  unblockUser: async (req, res) => {
    try {
      const myId = req.user._id;
      const { id: blockedUserId } = req.params;
      const updatedUser = await User.findByIdAndUpdate(
        myId,
        { $pull: { blockedUsers: blockedUserId } },
        { new: true },
      ).select('blockedUsers');

      return res.status(200).json({ message: 'User unblocked', blockedUsers: updatedUser.blockedUsers });
    } catch (error) {
      console.error('Error unblocking user:', error);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  deleteAllMessagesWithUser: async (req, res) => {
    try {
      const myId = req.user._id;
      const { id: targetUserId } = req.params;

      await Message.deleteMany({
        $or: [
          { senderId: myId, receiverId: targetUserId },
          { senderId: targetUserId, receiverId: myId },
        ],
      });

      const targetSocketId = getReceiverSocketId(targetUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('chat:messages-cleared', { byUserId: myId.toString() });
      }

      return res.status(200).json({ message: 'All messages deleted for this chat' });
    } catch (error) {
      console.error('Error deleting all messages:', error);
      return res.status(500).json({ message: 'Server error' });
    }
  },

  deleteMessage: async (req, res) => {
    try {
      const myId = req.user._id;
      const { id: messageId } = req.params;
      const messages = await Message.findOne({ _id: messageId, senderId: myId });
      if (!messages) return res.status(404).json({ message: 'Message not found or you are not the sender' });
      await Message.findByIdAndDelete(messageId);
      return res.status(200).json({ message: 'Message deleted successfully' });
    } catch (error) {
      console.error('Error deleting message:', error);
      return res.status(500).json({ message: 'Server error' });
    }
  },
};
