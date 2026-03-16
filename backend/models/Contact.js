import mongoose from 'mongoose';

const { Schema } = mongoose;

// A per-user contact entry: "owner" has saved "contact" in their list.
const ContactSchema = new Schema(
  {
    ownerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    contactUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    nickname: { type: String, default: '' },
    pinned: { type: Boolean, default: false },
    notes: { type: String, default: '' },
  },
  { timestamps: true },
);

ContactSchema.index({ ownerUserId: 1, contactUserId: 1 }, { unique: true });

export const Contact = mongoose.models.Contact || mongoose.model('Contact', ContactSchema);

