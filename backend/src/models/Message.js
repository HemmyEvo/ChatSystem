import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, maxlength: 2000 },
    image: { type: String },
    sticker: { type: String },
    video: { type: String },
    audio: { type: String },
    document: { type: String },
    viewOnce: { type: Boolean, default: false },
    viewedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    sharedContactId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    location: {
      lat: { type: Number },
      lng: { type: Number },
      label: { type: String },
    },
    replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
    reactions: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        emoji: { type: String, required: true },
      },
    ],
    deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    
    // NEW: Track delivery separately from read status
    deliveredTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    readAt: { type: Date },
  },
  { timestamps: true }
);

messageSchema.pre('save', function markSenderAsReader(next) {
  if (!this.readBy || this.readBy.length === 0) {
    this.readBy = [this.senderId];
  }
  // NEW: Also mark the sender as having the message delivered
  if (!this.deliveredTo || this.deliveredTo.length === 0) {
    this.deliveredTo = [this.senderId];
  }
  next();
});

const Message = mongoose.model('Message', messageSchema);

export default Message;
