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
  GEMINI_API_KEY,
  GEMINI_MODEL = '',
  MIA_CONTEXT_MESSAGES = '4',
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

    return res.status(200).json({ ok: true, dbMessageId });
  } catch (error) {
    console.error('Pusher trigger failed', error);
    return res.status(500).json({ ok: false, error: 'Pusher trigger failed' });
  }
};

module.exports = handler;
