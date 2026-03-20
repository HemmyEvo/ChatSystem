import mongoose from "mongoose";

const statusItemSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['text', 'image', 'video'], default: 'text' },
    text: { type: String, maxlength: 700, default: '' },
    mediaUrl: { type: String, default: '' },
    backgroundColor: { type: String, default: '#0b141a' },
    textColor: { type: String, default: '#ffffff' },
    viewers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    reactions: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        emoji: { type: String, required: true },
      },
    ],
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
  },
  { _id: true },
);

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    profilePicture: { type: String, default: '' },
    bio: { type: String, maxlength: 139, default: 'Hey there! I am using Existo app.' },
    statusItems: [statusItemSchema],
    lastSeen: { type: Date, default: Date.now },
    blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    friendRequestsSent: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    friendRequestsReceived: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    gameStats: {
      whot: {
        played: { type: Number, default: 0 },
        won: { type: Number, default: 0 },
      },
      ludo: {
        played: { type: Number, default: 0 },
        won: { type: Number, default: 0 },
      },
      totalPlayed: { type: Number, default: 0 },
      totalWon: { type: Number, default: 0 },
      recentMatches: [
        {
          gameType: { type: String, enum: ['whot', 'ludo'] },
          opponentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
          winnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
          playedAt: { type: Date, default: Date.now },
        },
      ],
    },
    },
    { timestamps: true }
);

const User = mongoose.model('User', userSchema);

export default User;
