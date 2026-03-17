import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    fullname: { type: String, required: true },
    password: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    profilePicture: { type: String, default: '' },
    lastSeen: { type: Date, default: Date.now },
    blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
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
