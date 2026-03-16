import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import Pusher from 'pusher';
import { connectToMongo, getMongoStatus } from './db/mongoose.js';
import mongoose from 'mongoose';
import { Contact, Conversation, Message, User } from './models/index.js';

dotenv.config();

const {
  PORT = 3000,
  PUSHER_APP_ID,
  PUSHER_KEY,
  PUSHER_SECRET,
  PUSHER_CLUSTER,
  ALLOWED_ORIGIN,
} = process.env;

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(
  cors({
    origin: ALLOWED_ORIGIN || 'http://localhost:5173',
  }),
);

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

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    time: new Date().toISOString(),
    pusherConfigured,
    mongo: getMongoStatus(),
  });
});

app.get('/api/messages', async (req, res) => {
  try {
    const room = String(req.query?.room || 'general').trim() || 'general';
    const limit = Math.min(Number(req.query?.limit || 50) || 50, 200);

    if (!process.env.MONGODB_URI) {
      return res.status(503).json({ ok: false, error: 'MongoDB not configured' });
    }

    await connectToMongo();

    const isDm = room.startsWith('dm:');
    const conversationId = isDm ? room.slice(3) : null;

    const conversation = isDm
      ? await Conversation.findOne({ _id: conversationId, type: 'dm' }).select('_id')
      : await Conversation.findOne({ type: 'room', slug: room }).select('_id');

    if (!conversation) return res.json({ ok: true, room, messages: [] });

    const docs = await Message.find({ conversationId: conversation._id, deletedAt: { $exists: false } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('senderId', 'displayName clerkUserId clientId avatarUrl');

    // Return chronological order to render naturally in the UI.
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
});

app.get('/api/contacts', async (req, res) => {
  try {
    const clerkUserId = String(req.query?.clerkUserId || '').trim();
    if (!clerkUserId) return res.status(400).json({ ok: false, error: 'Missing clerkUserId' });

    if (!process.env.MONGODB_URI) {
      return res.status(503).json({ ok: false, error: 'MongoDB not configured' });
    }

    await connectToMongo();

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
          $setOnInsert: {
            type: 'dm',
            dmKey,
            memberIds: [owner._id, contactUser._id],
            name: '',
          },
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
});

app.post('/api/contacts', async (req, res) => {
  try {
    const clerkUserId = req.body?.clerkUserId?.trim?.() || '';
    const contactEmail = req.body?.contactEmail?.trim?.() || '';
    const contactClerkUserId = req.body?.contactClerkUserId?.trim?.() || '';
    const displayName = req.body?.displayName?.trim?.() || 'User';
    const email = req.body?.email?.trim?.() || '';

    if (!clerkUserId) return res.status(400).json({ ok: false, error: 'Missing clerkUserId' });
    if (!contactEmail && !contactClerkUserId) {
      return res.status(400).json({ ok: false, error: 'Missing contactEmail or contactClerkUserId' });
    }

    if (!process.env.MONGODB_URI) {
      return res.status(503).json({ ok: false, error: 'MongoDB not configured' });
    }

    await connectToMongo();

    const owner = await User.findOneAndUpdate(
      { clerkUserId },
      {
        $set: { clerkUserId, displayName, ...(email ? { email } : {}) },
        $setOnInsert: { statusMessage: '' },
      },
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
        $setOnInsert: {
          type: 'dm',
          dmKey,
          memberIds: [owner._id, contactUser._id],
          name: '',
        },
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
    const msg = error?.message || String(error);
    if (msg.includes('Cast to ObjectId failed')) {
      return res.status(400).json({ ok: false, error: 'Invalid conversation/contact id' });
    }
    console.error('Add contact failed', error);
    return res.status(500).json({ ok: false, error: 'Add contact failed' });
  }
});

app.post('/api/message', async (req, res) => {
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

    // Persist to MongoDB (best-effort: failure should not break realtime chat).
    let dbMessageId;
    let dbStored = false;
    let dbError;
    if (process.env.MONGODB_URI) {
      try {
        await connectToMongo();

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

        if (!conversation) {
          throw new Error('Conversation not found');
        }

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
        dbStored = true;
      } catch (error) {
        dbError = error?.message || String(error);
        console.warn('MongoDB write failed (message not persisted):', dbError);
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

    return res.status(200).json({ ok: true, dbMessageId, dbStored, dbError });
  } catch (error) {
    console.error('Pusher trigger failed', error);
    return res.status(500).json({ ok: false, error: 'Pusher trigger failed' });
  }
});

app.listen(PORT, () => {
  if (!pusherConfigured) {
    console.warn('Pusher env vars missing. Check backend/.env.example for required values.');
  }
  if (!process.env.MONGODB_URI) {
    console.warn('MongoDB not configured. Set MONGODB_URI to enable persistence.');
  } else {
    connectToMongo()
      .then(() => console.log('MongoDB connected'))
      .catch((err) => console.error('MongoDB connection failed', err));
  }
  console.log(`Backend listening on http://localhost:${PORT}`);
});
