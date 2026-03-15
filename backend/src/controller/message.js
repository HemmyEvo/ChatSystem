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
            const messages = await Message.find({
                $or: [
                    { senderId: loggedInUserId },
                    { receiverId: loggedInUserId }
                ]
            }).sort({ createdAt: -1 });

            const chatMap = new Map();

            messages.forEach(msg => {
                const otherUserId = msg.senderId === loggedInUserId ? msg.receiverId : msg.senderId;
                if (!chatMap.has(otherUserId)) {
                    chatMap.set(otherUserId, msg);
                }
            });

            const chats = [];
            for (const [otherUserId, lastMessage] of chatMap.entries()) {
                const user = await User.findById(otherUserId).select('username profilePicture');
                chats.push({
                    user,
                    lastMessage
                });
            }

            return res.status(200).json({ chats });
        } catch (error) {
            console.log('Error fetching chats:', error);
            return res.status(500).json({ message: "Server error"});
        }
    },
    messageById: async (req, res) => {
        try{
            const myId = req.user._id;
            const { id:userToChatId } = req.params; 
            if(myId.toString() === userToChatId){
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
        try{
            const {text, image} = req.body;
            const senderId = req.user._id;
            const { id:receiverId } = req.params;
            if(senderId.toString() === receiverId){
                return res.status(400).json({ message: "Cannot send message to yourself" });
            }
            if(!text && !image){
                return res.status(400).json({ message: "Message content is required" });
            }
            let imageUrl;
            if(image){
                const uploadResult = await cloudinary.uploader.upload(image)
                imageUrl = uploadResult.secure_url;
            }
            const newMessage = new Message({
                senderId,
                receiverId,
                text,
                image: imageUrl
            });

            await newMessage.save();
           return res.status(201).json({ message: "Message sent successfully", data: newMessage });

        }
        catch(error){
            console.error('Error sending message:', error);
            return res.status(500).json({ message: "Server error"});
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