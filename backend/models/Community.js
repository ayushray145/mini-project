import mongoose from 'mongoose';

const { Schema } = mongoose;

const CommunityMemberSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['owner', 'member'], default: 'member' },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const CommunitySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, index: true },
    inviteCode: { type: String, required: true, unique: true, index: true },
    ownerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    members: { type: [CommunityMemberSchema], default: [] },
  },
  { timestamps: true },
);

CommunitySchema.index({ ownerUserId: 1, createdAt: -1 });

export const Community =
  mongoose.models.Community || mongoose.model('Community', CommunitySchema);
