import cloudinary from "../lib/cloudinary.js";
import Message from "../models/Message.js";
import User from "../models/User.js";

export const messageController = {
    contact: async (req, res) => {
        try {
            const loggedInUserId = req.user._id;
            const filteredUsers = await User.find({ _id: { $ne: loggedInUserId } }).select('-password');
            return res.status(200).json({ filteredUsers });
        } catch (error) {
            console.log('Error fetching contacts:', error);
            return res.status(500).json({ message: "Server error"});
        }
    },
    chats: async (req, res) => {
        try {
            const loggedInUserId = req.user._id;

    // find all the messages where the logged-in user is either sender or receiver
    const messages = await Message.find({
      $or: [{ senderId: loggedInUserId }, { receiverId: loggedInUserId }],
    });

    const chatPartnerIds = [
      ...new Set(
        messages.map((msg) =>
          msg.senderId.toString() === loggedInUserId.toString()
            ? msg.receiverId.toString()
            : msg.senderId.toString()
        )
      ),
    ];
    const lastmessage = {};
    messages.forEach((msg) => {
      const partnerId =
        msg.senderId.toString() === loggedInUserId.toString()
          ? msg.receiverId.toString()
          : msg.senderId.toString();
      if (
        !lastmessage[partnerId] ||
        new Date(msg.createdAt) > new Date(lastmessage[partnerId].createdAt)
      ) {
        lastmessage[partnerId] = msg;
      }
    });

    const chatPartners = await User.find({ _id: { $in: chatPartnerIds } }).select("-password");

    res.status(200).json({chatPartners: chatPartners.map((partner) => ({
      _id: partner._id,
      fullname: partner.fullname,
      email: partner.email,
      profilePicture: partner.profilePicture,
      lastMessage: lastmessage[partner._id.toString()] || null,
    })) 
});
        } catch (error) {
            console.log('Error fetching chats:', error);
            return res.status(500).json({ message: "Server error"});
        }
    },
    messageById: async (req, res) => {
        try{
            const myId = req.user._id;
            const { id:userToChatId } = req.params; 
            if(myId === userToChatId){
                return res.status(400).json({ message: "Cannot fetch messages with yourself" });
            }  
            const messages = await Message.find({
                $or: [
                    { senderId: myId, receiverId: userToChatId },
                    { senderId: userToChatId, receiverId: myId }
                ]
            })
           return res.status(200).json({ messages });

        }
        catch(error){
            console.error('Error fetching messages:', error);
            return res.status(500).json({ message: "Server error"});
        }
    },
    sendMessage: async (req, res) => {
    try {
        const { text, image, video, audio, document, sharedContactId } = req.body;
        const senderId = req.user._id;
        const { id: receiverId } = req.params;

        // 1. Basic Validations
        if (senderId.toString() === receiverId) {
            return res.status(400).json({ message: "Cannot send a message to yourself" });
        }

        // Must have at least one type of content
        if (!text && !image && !video && !audio && !document && !sharedContactId) {
            return res.status(400).json({ message: "Message content is required" });
        }

        const receiver = await User.findById(receiverId);
        if (!receiver) {
            return res.status(404).json({ message: "Receiver not found" });
        }

        // 2. Cloudinary Upload Helper
        // Using resource_type: "auto" allows Cloudinary to figure out if it's an image, video, or raw file (PDF)
        const uploadMedia = async (fileBase64) => {
            if (!fileBase64) return null;
            const uploadResult = await cloudinary.uploader.upload(fileBase64, {
                resource_type: "auto", 
                folder: "chat_attachments" // Optional: keeps your cloudinary dashboard organized
            });
            return uploadResult.secure_url;
        };

        // 3. Process all potential media uploads concurrently (faster than doing them one by one)
        const [imageUrl, videoUrl, audioUrl, documentUrl] = await Promise.all([
            uploadMedia(image),
            uploadMedia(video),
            uploadMedia(audio),
            uploadMedia(document)
        ]);

        // 4. Save to Database
        const newMessage = new Message({
            senderId,
            receiverId,
            text,
            image: imageUrl,
            video: videoUrl,
            audio: audioUrl,
            document: documentUrl,
            sharedContactId
        });

        await newMessage.save();

        // Optional: If you want the response to include the full contact details instead of just the ID
        if (sharedContactId) {
            await newMessage.populate('sharedContactId', 'fullname profilePicture email');
        }

        return res.status(201).json({ 
            message: "Message sent successfully", 
            data: newMessage 
        });

    } catch (error) {
        console.error('Error sending message:', error);
        
        // Handle Cloudinary file size limits gracefully
        if (error.http_code === 413) {
            return res.status(413).json({ message: "File is too large" });
        }
        
        return res.status(500).json({ message: "Server error" });
        }   
    },
    deleteMessage: async (req, res) => {
        try {
             const myId = req.user._id;
            const { id: messageId } = req.params;   
            const messages = await Message.findOne({ _id: messageId, senderId: myId });
            if(!messages) return res.status(404).json({ message: "Message not found or you are not the sender" });
            await Message.findByIdAndDelete(messageId);
            return res.status(200).json({ message: "Message deleted successfully" });
            
        } catch (error) {
            console.error('Error deleting message:', error);
           return res.status(500).json({ message: "Server error"});
        }
    }
}