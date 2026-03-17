import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, maxlength: 2000 },
    image: { type: String },
    video: { type: String },
    audio: { type: String },
    document: { type: String },
    sharedContactId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
    reactions: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        emoji: { type: String, required: true },
      },
    ],
    deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    readAt: { type: Date },
  },
  { timestamps: true }
);

messageSchema.pre('save', function markSenderAsReader(next) {
  if (!this.readBy || this.readBy.length === 0) {
    this.readBy = [this.senderId];
  }
  next();
});

const Message = mongoose.model('Message', messageSchema);

export default Message;
