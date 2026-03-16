import mongoose from 'mongoose';

const { Schema } = mongoose;

const ConversationSchema = new Schema(
  {
    // room: named channel, dm: 1:1, group: small group chat
    type: { type: String, enum: ['room', 'dm', 'group'], required: true, index: true },
    slug: { type: String, index: true }, // for rooms (ex: "general")
    name: { type: String }, // display name for group/room

    memberIds: [{ type: Schema.Types.ObjectId, ref: 'User', index: true }],
    createdById: { type: Schema.Types.ObjectId, ref: 'User' },

    lastMessageAt: { type: Date, index: true },

    // For DMs: stable key like "<userIdA>:<userIdB>" (sorted) to enforce uniqueness.
    dmKey: { type: String, index: true, unique: true, sparse: true },
  },
  { timestamps: true },
);

ConversationSchema.index({ type: 1, slug: 1 }, { unique: true, sparse: true });

export const Conversation =
  mongoose.models.Conversation || mongoose.model('Conversation', ConversationSchema);

