import mongoose from 'mongoose';

const { Schema } = mongoose;

const UserSchema = new Schema(
  {
    clerkUserId: { type: String, index: true, unique: true, sparse: true },
    // For non-auth/dev clients (or for distinguishing same display names across browsers)
    clientId: { type: String, index: true, unique: true, sparse: true },
    email: { type: String, index: true },
    displayName: { type: String, required: true },
    avatarUrl: { type: String },
    statusMessage: { type: String, default: '' },
    lastSeenAt: { type: Date },
  },
  { timestamps: true },
);

export const User = mongoose.models.User || mongoose.model('User', UserSchema);
