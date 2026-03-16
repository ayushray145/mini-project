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

  const ContactSchema =
    mongoose.models.Contact?.schema ||
    new Schema(
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

  const User = mongoose.models.User || mongoose.model('User', UserSchema);
  const Contact = mongoose.models.Contact || mongoose.model('Contact', ContactSchema);
  const Conversation = mongoose.models.Conversation || mongoose.model('Conversation', ConversationSchema);

  return { User, Contact, Conversation };
}

const handler = async (req, res) => {
  const origin = ALLOWED_ORIGIN || 'http://localhost:5173';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (!MONGODB_URI) {
    return res.status(503).json({ ok: false, error: 'MongoDB not configured' });
  }

  await connectToMongo();
  const { User, Contact, Conversation } = getModels();

  if (req.method === 'GET') {
    try {
      const clerkUserId = String(req.query?.clerkUserId || '').trim();
      if (!clerkUserId) return res.status(400).json({ ok: false, error: 'Missing clerkUserId' });

      const owner = await User.findOne({ clerkUserId });
      if (!owner) return res.json({ ok: true, contacts: [] });

      const contacts = await Contact.find({ ownerUserId: owner._id })
        .sort({ pinned: -1, updatedAt: -1 })
        .populate('contactUserId', 'displayName email clerkUserId avatarUrl');

      const results = [];
      for (const item of contacts) {
        const contactUser = item.contactUserId;
        if (!contactUser) continue;
        const dmKey = [String(owner._id), String(contactUser._id)].sort().join(':');
        const conversation = await Conversation.findOneAndUpdate(
          { type: 'dm', dmKey },
          {
            $setOnInsert: { type: 'dm', dmKey, memberIds: [owner._id, contactUser._id], name: '' },
            $addToSet: { memberIds: { $each: [owner._id, contactUser._id] } },
          },
          { upsert: true, new: true },
        );

        results.push({
          contact: {
            displayName: contactUser.displayName,
            email: contactUser.email,
            clerkUserId: contactUser.clerkUserId,
            avatarUrl: contactUser.avatarUrl,
          },
          dmRoom: `dm:${conversation._id}`,
        });
      }

      return res.json({ ok: true, contacts: results });
    } catch (error) {
      console.error('Fetch contacts failed', error);
      return res.status(500).json({ ok: false, error: 'Fetch contacts failed' });
    }
  }

  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const clerkUserId = body?.clerkUserId?.trim?.() || '';
      const contactEmail = body?.contactEmail?.trim?.() || '';
      const contactClerkUserId = body?.contactClerkUserId?.trim?.() || '';
      const displayName = body?.displayName?.trim?.() || 'User';
      const email = body?.email?.trim?.() || '';

      if (!clerkUserId) return res.status(400).json({ ok: false, error: 'Missing clerkUserId' });
      if (!contactEmail && !contactClerkUserId) {
        return res.status(400).json({ ok: false, error: 'Missing contactEmail or contactClerkUserId' });
      }

      const owner = await User.findOneAndUpdate(
        { clerkUserId },
        { $set: { clerkUserId, displayName, ...(email ? { email } : {}) }, $setOnInsert: { statusMessage: '' } },
        { upsert: true, new: true },
      );

      const contactQuery = contactClerkUserId
        ? { clerkUserId: contactClerkUserId }
        : { email: contactEmail.toLowerCase() };

      const contactUser = await User.findOne(contactQuery);
      if (!contactUser) {
        return res.status(404).json({
          ok: false,
          error: 'Contact not found. Ask them to sign up first (so they exist in the database).',
        });
      }

      await Contact.findOneAndUpdate(
        { ownerUserId: owner._id, contactUserId: contactUser._id },
        { $setOnInsert: { ownerUserId: owner._id, contactUserId: contactUser._id } },
        { upsert: true, new: true },
      );

      const dmKey = [String(owner._id), String(contactUser._id)].sort().join(':');
      const conversation = await Conversation.findOneAndUpdate(
        { type: 'dm', dmKey },
        {
          $setOnInsert: { type: 'dm', dmKey, memberIds: [owner._id, contactUser._id], name: '' },
          $addToSet: { memberIds: { $each: [owner._id, contactUser._id] } },
        },
        { upsert: true, new: true },
      );

      return res.json({
        ok: true,
        dmRoom: `dm:${conversation._id}`,
        contact: {
          displayName: contactUser.displayName,
          email: contactUser.email,
          clerkUserId: contactUser.clerkUserId,
          avatarUrl: contactUser.avatarUrl,
        },
      });
    } catch (error) {
      console.error('Add contact failed', error);
      return res.status(500).json({ ok: false, error: 'Add contact failed' });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
};

module.exports = handler;

