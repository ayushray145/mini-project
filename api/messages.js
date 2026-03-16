const mongoose = require('mongoose');

const { MONGODB_URI, MONGODB_DB, ALLOWED_ORIGIN } = process.env;

let mongoPromise = null;
async function connectToMongo() {
  if (!MONGODB_URI) return null;
  if (!mongoPromise) {
    mongoPromise = mongoose.connect(MONGODB_URI, { autoIndex: true, ...(MONGODB_DB ? { dbName: MONGODB_DB } : {}) });
  }
  return mongoPromise;
}

function getModels() {
  const { Schema } = mongoose;

  const UserSchema =
    mongoose.models.User?.schema ||
    new Schema(
      {
        clerkUserId: { type: String, index: true, unique: true, sparse: true },
        clientId: { type: String, index: true, unique: true, sparse: true },
        email: { type: String, index: true },
        displayName: { type: String, required: true },
        avatarUrl: { type: String },
        statusMessage: { type: String, default: '' },
        lastSeenAt: { type: Date },
      },
      { timestamps: true },
    );

  const ConversationSchema =
    mongoose.models.Conversation?.schema ||
    new Schema(
      {
        type: { type: String, enum: ['room', 'dm', 'group'], required: true, index: true },
        slug: { type: String, index: true },
        name: { type: String },
        memberIds: [{ type: Schema.Types.ObjectId, ref: 'User', index: true }],
        createdById: { type: Schema.Types.ObjectId, ref: 'User' },
        lastMessageAt: { type: Date, index: true },
        dmKey: { type: String, index: true, unique: true, sparse: true },
      },
      { timestamps: true },
    );

  ConversationSchema.index({ type: 1, slug: 1 }, { unique: true, sparse: true });

  const MessageSchema =
    mongoose.models.Message?.schema ||
    new Schema(
      {
        conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
        senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        body: { type: String, required: true },
        kind: { type: String, enum: ['text', 'code'], default: 'text', index: true },
        metadata: { type: Schema.Types.Mixed, default: {} },
        editedAt: { type: Date },
        deletedAt: { type: Date },
      },
      { timestamps: true },
    );

  MessageSchema.index({ conversationId: 1, createdAt: 1 });

  const User = mongoose.models.User || mongoose.model('User', UserSchema);
  const Conversation = mongoose.models.Conversation || mongoose.model('Conversation', ConversationSchema);
  const Message = mongoose.models.Message || mongoose.model('Message', MessageSchema);

  return { User, Conversation, Message };
}

const handler = async (req, res) => {
  const origin = ALLOWED_ORIGIN || 'http://localhost:5173';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  try {
    const room = String(req.query?.room || 'general').trim() || 'general';
    const limit = Math.min(Number(req.query?.limit || 50) || 50, 200);

    if (!MONGODB_URI) {
      return res.status(503).json({ ok: false, error: 'MongoDB not configured' });
    }

    await connectToMongo();
    const { Conversation, Message } = getModels();

    const conversation = await Conversation.findOne({ type: 'room', slug: room }).select('_id');
    if (!conversation) return res.json({ ok: true, room, messages: [] });

    const docs = await Message.find({ conversationId: conversation._id, deletedAt: { $exists: false } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('senderId', 'displayName clerkUserId clientId avatarUrl');

    const messages = docs
      .reverse()
      .map((doc) => ({
        dbMessageId: String(doc._id),
        id: doc.metadata?.clientMessageId || String(doc._id),
        room,
        message: doc.body,
        username: doc.senderId?.displayName || 'Unknown',
        time: doc.createdAt.toISOString(),
        clientId: doc.metadata?.clientId,
        clerkUserId: doc.metadata?.clerkUserId || doc.senderId?.clerkUserId,
        senderId: doc.metadata?.clerkUserId || doc.metadata?.clientId || doc.senderId?.clerkUserId || doc.senderId?.clientId,
        isBot: false,
      }));

    return res.json({ ok: true, room, messages });
  } catch (error) {
    console.error('Fetch messages failed', error);
    return res.status(500).json({ ok: false, error: 'Fetch messages failed' });
  }
};

module.exports = handler;
