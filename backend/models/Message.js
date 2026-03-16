import mongoose from 'mongoose';

const { Schema } = mongoose;

const MessageSchema = new Schema(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    body: { type: String, required: true },
    kind: { type: String, enum: ['text', 'code'], default: 'text', index: true },

    // Optional extras (attachments, client ids, etc.)
    metadata: { type: Schema.Types.Mixed, default: {} },

    editedAt: { type: Date },
    deletedAt: { type: Date },
  },
  { timestamps: true },
);

MessageSchema.index({ conversationId: 1, createdAt: 1 });

export const Message = mongoose.models.Message || mongoose.model('Message', MessageSchema);

