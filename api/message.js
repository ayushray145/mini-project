const Pusher = require('pusher');
const mongoose = require('mongoose');

const {
  MONGODB_URI,
  MONGODB_DB,
  PUSHER_APP_ID,
  PUSHER_KEY,
  PUSHER_SECRET,
  PUSHER_CLUSTER,
  ALLOWED_ORIGIN,
} = process.env;

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

const pusherConfigured =
  Boolean(PUSHER_APP_ID) &&
  Boolean(PUSHER_KEY) &&
  Boolean(PUSHER_SECRET) &&
  Boolean(PUSHER_CLUSTER);

const pusher = pusherConfigured
  ? new Pusher({
      appId: PUSHER_APP_ID,
      key: PUSHER_KEY,
      secret: PUSHER_SECRET,
      cluster: PUSHER_CLUSTER,
      useTLS: true,
    })
  : null;

const handler = async (req, res) => {
  const origin = ALLOWED_ORIGIN || 'http://localhost:5173';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  if (!pusher) {
    return res.status(500).json({ ok: false, error: 'Pusher not configured' });
  }

  try {
    const message = req.body?.message?.trim?.() || '';
    const username = req.body?.username?.trim?.() || 'Guest';
    const time = req.body?.time || new Date().toISOString();
    const id = req.body?.id;
    const room = req.body?.room?.trim?.() || 'general';
    const clientId = req.body?.clientId?.trim?.() || undefined;
    const clerkUserId = req.body?.clerkUserId?.trim?.() || undefined;

    if (!message) {
      return res.status(400).json({ ok: false, error: 'Missing message' });
    }

    let dbMessageId;
    if (MONGODB_URI) {
      try {
        await connectToMongo();
        const { User, Conversation, Message } = getModels();

        const userQuery = clerkUserId ? { clerkUserId } : clientId ? { clientId } : { displayName: username };
        const sender = await User.findOneAndUpdate(
          userQuery,
          {
            $set: {
              displayName: username,
              ...(clerkUserId ? { clerkUserId } : {}),
              ...(clientId ? { clientId } : {}),
            },
            $setOnInsert: { statusMessage: '' },
          },
          { upsert: true, new: true },
        );

        const isDm = room.startsWith('dm:');
        const dmConversationId = isDm ? room.slice(3) : null;
        const conversation = isDm
          ? await Conversation.findOneAndUpdate(
              { _id: dmConversationId, type: 'dm' },
              { $set: { lastMessageAt: new Date(time) }, $addToSet: { memberIds: sender._id } },
              { new: true },
            )
          : await Conversation.findOneAndUpdate(
              { type: 'room', slug: room },
              {
                $setOnInsert: { type: 'room', slug: room, name: room },
                $set: { lastMessageAt: new Date(time) },
                $addToSet: { memberIds: sender._id },
              },
              { upsert: true, new: true },
            );

        if (!conversation) throw new Error('Conversation not found');

        const doc = await Message.create({
          conversationId: conversation._id,
          senderId: sender._id,
          body: message,
          kind: /^```[\w-]*\n[\s\S]*\n```$/.test(message.trim()) ? 'code' : 'text',
          metadata: {
            clientMessageId: id,
            clientId,
            room,
            clientSentAt: time,
            clerkUserId,
          },
        });

        dbMessageId = String(doc._id);
      } catch (error) {
        console.warn('MongoDB write failed (message not persisted):', error?.message || String(error));
      }
    }

    await pusher.trigger('chat', 'message', {
      id,
      room,
      message,
      username,
      time,
      clientId,
      dbMessageId,
    });

    return res.status(200).json({ ok: true, dbMessageId });
  } catch (error) {
    console.error('Pusher trigger failed', error);
    return res.status(500).json({ ok: false, error: 'Pusher trigger failed' });
  }
};

module.exports = handler;
