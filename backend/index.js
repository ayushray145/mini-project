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
  GEMINI_API_KEY,
  GEMINI_MODEL = '',
  MIA_CONTEXT_MESSAGES = '4',
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

const miaMentionPattern = /(^|\s)@mia\b/i;
const miaContextLimit = Math.max(0, Math.min(Number(MIA_CONTEXT_MESSAGES) || 0, 8));
const roomContextBuffer = new Map();

const shouldTriggerMia = ({ message, username }) => {
  if (!message) return false;
  if (String(username || '').toLowerCase().includes('mia')) return false;
  return miaMentionPattern.test(message);
};

const pushRoomContext = (room, entry) => {
  const key = String(room || 'general');
  const list = roomContextBuffer.get(key) || [];
  list.push(entry);
  const max = 20;
  if (list.length > max) list.splice(0, list.length - max);
  roomContextBuffer.set(key, list);
};

const getRoomContext = (room) => {
  const key = String(room || 'general');
  return roomContextBuffer.get(key) || [];
};

const buildMiaPrompt = ({ room, raw, context = [] }) => {
  const cleaned = String(raw || '').replace(miaMentionPattern, '$1').trim();
  const contextLines = (Array.isArray(context) ? context : [])
    .filter((m) => m && m.message && m.username && !String(m.username).toLowerCase().includes('mia'))
    .slice(-miaContextLimit)
    .map((m) => `${m.username}: ${String(m.message).slice(0, 240)}`);
  return [
    'You are Mia (AI), a helpful developer assistant in a team chatroom called DevRooms.',
    'Reply concisely and practically. Use Markdown. Use bullet lists when helpful.',
    'When you include code, use fenced code blocks with a language tag (```js, ```ts, ```bash, etc.).',
    room ? `Room: ${room}` : null,
    contextLines.length ? `Recent chat context:\n${contextLines.join('\n')}` : null,
    `User message: ${cleaned || raw}`,
  ].filter(Boolean).join('\n');
};

const makeBotMessageId = (prefix = 'mia') =>
  `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`}`;

let resolvedGeminiTarget = null;

async function generateMiaReply({ prompt, timeoutMs = 12000 }) {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const fetchJson = async (url, options) => {
    const resp = await fetch(url, options);
    const data = await resp.json().catch(() => null);
    return { resp, data };
  };

  const normalizeRequestedModel = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    return raw.startsWith('models/') ? raw : `models/${raw}`;
  };

  const resolveGeminiTarget = async ({ timeoutMs: listTimeoutMs = 12000 } = {}) => {
    const requested = normalizeRequestedModel(GEMINI_MODEL);
    if (requested) return { apiVersion: 'v1beta', modelName: requested };
    if (resolvedGeminiTarget) return resolvedGeminiTarget;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), listTimeoutMs);
    try {
      const listUrls = [
        { apiVersion: 'v1beta', url: `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(GEMINI_API_KEY)}` },
        { apiVersion: 'v1', url: `https://generativelanguage.googleapis.com/v1/models?key=${encodeURIComponent(GEMINI_API_KEY)}` },
      ];

      let lastError = null;
      for (const candidate of listUrls) {
        const { resp, data } = await fetchJson(candidate.url, { method: 'GET', signal: controller.signal });
        if (!resp.ok) {
          lastError = data?.error?.message || `ListModels failed (${resp.status})`;
          continue;
        }

        const models = Array.isArray(data?.models) ? data.models : [];
        const supported = models.filter((m) =>
          Array.isArray(m?.supportedGenerationMethods) &&
          m.supportedGenerationMethods.includes('generateContent') &&
          typeof m?.name === 'string',
        );

        const preferred =
          supported.find((m) => m.name.includes('flash')) ||
          supported.find((m) => m.name.includes('gemini')) ||
          supported[0];

        if (!preferred?.name) break;
        resolvedGeminiTarget = { apiVersion: candidate.apiVersion, modelName: preferred.name };
        return resolvedGeminiTarget;
      }

      throw new Error(lastError || 'No generateContent-capable model found');
    } finally {
      clearTimeout(timeout);
    }
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const target = await resolveGeminiTarget({ timeoutMs });
    const url = `https://generativelanguage.googleapis.com/${target.apiVersion}/${target.modelName}:generateContent?key=${encodeURIComponent(
      GEMINI_API_KEY,
    )}`;

    const { resp, data } = await fetchJson(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 300 },
      }),
    });
    if (!resp.ok) {
      const detail = data?.error?.message || `Gemini request failed (${resp.status})`;
      throw new Error(detail);
    }

    const text =
      data?.candidates?.[0]?.content?.parts?.map((p) => p?.text).filter(Boolean).join('') ||
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      '';
    return String(text || '').trim();
  } finally {
    clearTimeout(timeout);
  }
}

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    time: new Date().toISOString(),
    pusherConfigured,
    mongo: getMongoStatus(),
    geminiConfigured: Boolean(GEMINI_API_KEY),
    geminiModelRequested: GEMINI_MODEL || null,
    geminiModelResolved: resolvedGeminiTarget?.modelName || null,
    miaContextMessages: miaContextLimit,
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

    const miaContext = getRoomContext(room);
    pushRoomContext(room, { username, message, time, room, isBot: false });

    await pusher.trigger('chat', 'message', {
      id,
      room,
      message,
      username,
      time,
      clientId,
      dbMessageId,
    });

    if (shouldTriggerMia({ message, username })) {
      (async () => {
        try {
          const prompt = buildMiaPrompt({ room, raw: message, context: miaContext });
          const reply = await generateMiaReply({ prompt });
          if (!reply) return;
          const miaMessage = {
            id: makeBotMessageId('mia'),
            room,
            message: reply,
            username: 'Mia (AI)',
            time: new Date().toISOString(),
            clientId: 'mia-gemini',
            isBot: true,
            senderId: 'mia-gemini',
          };
          pushRoomContext(room, miaMessage);
          await pusher.trigger('chat', 'message', miaMessage);
        } catch (error) {
          const msg = error?.message || String(error);
          console.warn('Mia (Gemini) reply failed:', msg);
          const miaErrorMessage = {
            id: makeBotMessageId('mia-error'),
            room,
            message: `Mia is offline right now (${msg}).`,
            username: 'Mia (AI)',
            time: new Date().toISOString(),
            clientId: 'mia-gemini',
            isBot: true,
            senderId: 'mia-gemini',
          };
          pushRoomContext(room, miaErrorMessage);
          await pusher.trigger('chat', 'message', miaErrorMessage);
        }
      })();
    }

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
