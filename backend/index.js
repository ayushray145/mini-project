import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import Pusher from 'pusher';
import { connectToMongo, getMongoStatus } from './db/mongoose.js';
import mongoose from 'mongoose';
import { Community, Contact, Conversation, Message, User } from './models/index.js';

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

const miaMentionPattern = /(^|\s)@codex\b/i;
const miaContextLimit = Math.max(0, Math.min(Number(MIA_CONTEXT_MESSAGES) || 0, 8));
const roomContextBuffer = new Map();

const shouldTriggerMia = ({ message, username }) => {
  if (!message) return false;
  if (String(username || '').toLowerCase().includes('codex')) return false;
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
    .filter((m) => m && m.message && m.username && !String(m.username).toLowerCase().includes('codex'))
    .slice(-miaContextLimit)
      .map((m) => `${m.username}: ${String(m.message).slice(0, 240)}`);
  return [
    'You are Codex AI, a helpful developer assistant in a team chatroom called DevRooms.',
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

const slugify = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

const generateInviteCode = () =>
  `DEVR-${Math.random().toString(36).slice(2, 6).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

const normalizeId = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    if (value._id) return String(value._id);
    if (value.id) return String(value.id);
  }
  return String(value);
};

const idsEqual = (a, b) => normalizeId(a) === normalizeId(b);

const findCommunityMember = (community, userId) =>
  Array.isArray(community?.members) ? community.members.find((member) => idsEqual(member.userId, userId)) : null;

const isCommunityAdmin = (community, userId) => findCommunityMember(community, userId)?.role === 'owner';
const isAnnouncementChannel = (channel) => {
  const name = String(channel?.name || '').trim().toLowerCase();
  const slug = String(channel?.slug || '').trim().toLowerCase();
  return Boolean(channel?.adminOnlyPosting) || name === 'announcement' || name === 'announcements' || slug.endsWith('-announcement') || slug.endsWith('-announcements');
};

const mergeUserReferences = async (primaryUser, duplicateUsers) => {
  for (const duplicateUser of duplicateUsers) {
    if (!duplicateUser || idsEqual(primaryUser?._id, duplicateUser?._id)) continue;

    await Community.updateMany(
      { ownerUserId: duplicateUser._id },
      { $set: { ownerUserId: primaryUser._id } },
    );

    const communities = await Community.find({ 'members.userId': duplicateUser._id });
    for (const community of communities) {
      let changed = false;
      const nextMembers = [];
      for (const member of community.members || []) {
        if (!idsEqual(member.userId, duplicateUser._id)) {
          if (!nextMembers.some((item) => idsEqual(item.userId, member.userId))) nextMembers.push(member);
          continue;
        }

        changed = true;
        const existingIndex = nextMembers.findIndex((item) => idsEqual(item.userId, primaryUser._id));
        if (existingIndex >= 0) {
          if (member.role === 'owner') nextMembers[existingIndex].role = 'owner';
        } else {
          nextMembers.push({ ...member.toObject(), userId: primaryUser._id });
        }
      }
      if (changed) {
        community.members = nextMembers;
        await community.save();
      }
    }

    const conversations = await Conversation.find({
      $or: [{ memberIds: duplicateUser._id }, { createdById: duplicateUser._id }],
    });
    for (const conversation of conversations) {
      let changed = false;
      if (idsEqual(conversation.createdById, duplicateUser._id)) {
        conversation.createdById = primaryUser._id;
        changed = true;
      }
      if ((conversation.memberIds || []).some((memberId) => idsEqual(memberId, duplicateUser._id))) {
        conversation.memberIds = [
          ...new Map(
            conversation.memberIds
              .map((memberId) => (idsEqual(memberId, duplicateUser._id) ? primaryUser._id : memberId))
              .map((memberId) => [String(memberId), memberId]),
          ).values(),
        ];
        changed = true;
      }
      if (changed) await conversation.save();
    }

    await Message.updateMany(
      { senderId: duplicateUser._id },
      { $set: { senderId: primaryUser._id } },
    );

    await Contact.updateMany(
      { ownerUserId: duplicateUser._id },
      { $set: { ownerUserId: primaryUser._id } },
    );
    await Contact.updateMany(
      { contactUserId: duplicateUser._id },
      { $set: { contactUserId: primaryUser._id } },
    );

    const contacts = await Contact.find({}).sort({ createdAt: 1 });
    const seenContactPairs = new Set();
    for (const contact of contacts) {
      const key = `${contact.ownerUserId}:${contact.contactUserId}`;
      if (seenContactPairs.has(key)) {
        await Contact.deleteOne({ _id: contact._id });
        continue;
      }
      seenContactPairs.add(key);
    }

    await User.deleteOne({ _id: duplicateUser._id });
  }
};

const upsertUserProfile = async ({
  clerkUserId,
  displayName = 'User',
  email = '',
  clientId,
}) => {
  const normalizedEmail = email ? email.toLowerCase() : '';
  const orQueries = [
    ...(clerkUserId ? [{ clerkUserId }] : []),
    ...(clientId ? [{ clientId }] : []),
    ...(normalizedEmail ? [{ email: normalizedEmail }] : []),
  ];

  const matchingUsers = orQueries.length > 0 ? await User.find({ $or: orQueries }).sort({ createdAt: 1 }) : [];
  const clientMatchedUser = clientId ? matchingUsers.find((user) => user.clientId === clientId) : null;
  const clerkMatchedUser = clerkUserId ? matchingUsers.find((user) => user.clerkUserId === clerkUserId) : null;
  const emailMatchedUser = normalizedEmail ? matchingUsers.find((user) => user.email === normalizedEmail) : null;
  const existingUser = clientMatchedUser || clerkMatchedUser || emailMatchedUser || matchingUsers[0] || null;

  if (existingUser) {
    const duplicates = matchingUsers.filter((user) => !idsEqual(user._id, existingUser._id));
    if (duplicates.length > 0) {
      await mergeUserReferences(existingUser, duplicates);
    }
    existingUser.displayName = displayName;
    if (clerkUserId) existingUser.clerkUserId = clerkUserId;
    if (clientId) existingUser.clientId = clientId;
    if (normalizedEmail) existingUser.email = normalizedEmail;
    await existingUser.save();
    return existingUser;
  }

  return User.create({
    displayName,
    ...(clerkUserId ? { clerkUserId } : {}),
    ...(clientId ? { clientId } : {}),
    ...(normalizedEmail ? { email: normalizedEmail } : {}),
    statusMessage: '',
  });
};

const resolveConversationFromRoom = async (room) => {
  const normalized = String(room || '').trim();
  if (!normalized) return null;
  if (normalized.startsWith('dm:')) {
    return Conversation.findOne({ _id: normalized.slice(3), type: 'dm' });
  }
  if (normalized.startsWith('channel:')) {
    return Conversation.findOne({ _id: normalized.slice(8), type: 'community-channel' });
  }
  return Conversation.findOne({ type: 'room', slug: normalized });
};

const serializeCommunity = async (communityDoc, viewerUserId) => {
  const community = await Community.findById(communityDoc._id)
    .populate('ownerUserId', 'displayName clerkUserId email avatarUrl')
    .populate('members.userId', 'displayName clerkUserId email avatarUrl');
  if (!community) return null;

  const channels = await Conversation.find({ type: 'community-channel', communityId: community._id })
    .sort({ createdAt: 1 })
    .populate('memberIds', 'displayName clerkUserId email avatarUrl');

  const membership = findCommunityMember(community, viewerUserId);
  const isAdmin = membership?.role === 'owner';

  return {
    id: String(community._id),
    name: community.name,
    slug: community.slug,
    inviteCode: isAdmin ? community.inviteCode : null,
    role: membership?.role || null,
    isAdmin,
    owner: community.ownerUserId
      ? {
          id: String(community.ownerUserId._id),
          displayName: community.ownerUserId.displayName,
          clerkUserId: community.ownerUserId.clerkUserId,
          email: community.ownerUserId.email,
          avatarUrl: community.ownerUserId.avatarUrl,
        }
      : null,
    members: (community.members || [])
      .filter((item) => item?.userId)
      .map((item) => ({
        id: String(item.userId._id),
        displayName: item.userId.displayName,
        clerkUserId: item.userId.clerkUserId,
        email: item.userId.email,
        avatarUrl: item.userId.avatarUrl,
        role: item.role,
      })),
    channels: channels.map((channel) => ({
      id: String(channel._id),
      roomId: `channel:${channel._id}`,
      name: channel.name || channel.slug,
      slug: channel.slug,
      adminOnlyPosting: isAnnouncementChannel(channel),
      memberIds: (channel.memberIds || []).map((member) => String(member._id)),
      memberClerkUserIds: (channel.memberIds || []).map((member) => member.clerkUserId).filter(Boolean),
      memberCount: Array.isArray(channel.memberIds) ? channel.memberIds.length : 0,
      isAccessible: (channel.memberIds || []).some((member) => idsEqual(member._id, viewerUserId)),
    })),
  };
};

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

app.get('/api/communities', async (req, res) => {
  try {
    const clerkUserId = String(req.query?.clerkUserId || '').trim();
    if (!clerkUserId) return res.status(400).json({ ok: false, error: 'Missing clerkUserId' });
    if (!process.env.MONGODB_URI) {
      return res.status(503).json({ ok: false, error: 'MongoDB not configured' });
    }

    await connectToMongo();
    const user = await User.findOne({ clerkUserId });
    if (!user) return res.json({ ok: true, communities: [] });

    const communities = await Community.find({ 'members.userId': user._id }).sort({ updatedAt: -1, createdAt: -1 });
    const results = [];
    for (const community of communities) {
      const serialized = await serializeCommunity(community, user._id);
      if (serialized) results.push(serialized);
    }
    return res.json({ ok: true, communities: results });
  } catch (error) {
    console.error('Fetch communities failed', error);
    return res.status(500).json({ ok: false, error: 'Fetch communities failed' });
  }
});

app.post('/api/communities', async (req, res) => {
  try {
    const clerkUserId = req.body?.clerkUserId?.trim?.() || '';
    const displayName = req.body?.displayName?.trim?.() || 'User';
    const email = req.body?.email?.trim?.() || '';
    const name = req.body?.name?.trim?.() || '';
    const memberEmails = Array.isArray(req.body?.memberEmails) ? req.body.memberEmails : [];

    if (!clerkUserId) return res.status(400).json({ ok: false, error: 'Missing clerkUserId' });
    if (!name) return res.status(400).json({ ok: false, error: 'Missing community name' });
    if (!process.env.MONGODB_URI) {
      return res.status(503).json({ ok: false, error: 'MongoDB not configured' });
    }

    await connectToMongo();
    const owner = await upsertUserProfile({ clerkUserId, displayName, email });

    const baseSlug = slugify(name) || `community-${Date.now()}`;
    let slug = baseSlug;
    let suffix = 2;
    while (await Community.findOne({ slug })) {
      slug = `${baseSlug}-${suffix++}`;
    }

    let inviteCode = generateInviteCode();
    while (await Community.findOne({ inviteCode })) {
      inviteCode = generateInviteCode();
    }

    const community = await Community.create({
      name,
      slug,
      inviteCode,
      ownerUserId: owner._id,
      members: [{ userId: owner._id, role: 'owner' }],
    });

    const invitedUsers = [];
    for (const item of memberEmails.map((value) => String(value || '').trim().toLowerCase()).filter(Boolean)) {
      const user = await User.findOne({ email: item });
      if (user && !invitedUsers.some((existing) => idsEqual(existing._id, user._id)) && !idsEqual(user._id, owner._id)) {
        invitedUsers.push(user);
      }
    }

    if (invitedUsers.length > 0) {
      community.members.push(...invitedUsers.map((user) => ({ userId: user._id, role: 'member' })));
      await community.save();
    }

    const defaultChannelMembers = [owner._id, ...invitedUsers.map((user) => user._id)];
    for (const channelName of ['general', 'announcement']) {
      await Conversation.create({
        type: 'community-channel',
        communityId: community._id,
        slug: `${community.slug}-${channelName}`,
        name: channelName,
        memberIds: defaultChannelMembers,
        createdById: owner._id,
        adminOnlyPosting: channelName === 'announcement',
      });
    }

    const serialized = await serializeCommunity(community, owner._id);
    return res.status(201).json({ ok: true, community: serialized });
  } catch (error) {
    console.error('Create community failed', error);
    return res.status(500).json({ ok: false, error: 'Create community failed' });
  }
});

app.post('/api/communities/join', async (req, res) => {
  try {
    const clerkUserId = req.body?.clerkUserId?.trim?.() || '';
    const displayName = req.body?.displayName?.trim?.() || 'User';
    const email = req.body?.email?.trim?.() || '';
    const inviteCode = req.body?.inviteCode?.trim?.()?.toUpperCase?.() || '';

    if (!clerkUserId) return res.status(400).json({ ok: false, error: 'Missing clerkUserId' });
    if (!inviteCode) return res.status(400).json({ ok: false, error: 'Missing inviteCode' });
    if (!process.env.MONGODB_URI) {
      return res.status(503).json({ ok: false, error: 'MongoDB not configured' });
    }

    await connectToMongo();
    const user = await upsertUserProfile({ clerkUserId, displayName, email });
    const community = await Community.findOne({ inviteCode });
    if (!community) return res.status(404).json({ ok: false, error: 'Invalid invite code' });

    if (!findCommunityMember(community, user._id)) {
      community.members.push({ userId: user._id, role: 'member' });
      await community.save();

      await Conversation.updateMany(
        { type: 'community-channel', communityId: community._id },
        { $addToSet: { memberIds: user._id } },
      );
    }

    const serialized = await serializeCommunity(community, user._id);
    return res.json({ ok: true, community: serialized });
  } catch (error) {
    console.error('Join community failed', error);
    return res.status(500).json({ ok: false, error: 'Join community failed' });
  }
});

app.post('/api/communities/:communityId/members', async (req, res) => {
  try {
    const communityId = String(req.params?.communityId || '').trim();
    const adminClerkUserId = req.body?.clerkUserId?.trim?.() || '';
    const contactEmail = req.body?.contactEmail?.trim?.()?.toLowerCase?.() || '';

    if (!communityId || !adminClerkUserId || !contactEmail) {
      return res.status(400).json({ ok: false, error: 'Missing communityId, clerkUserId, or contactEmail' });
    }

    await connectToMongo();
    const admin = await User.findOne({ clerkUserId: adminClerkUserId });
    const community = await Community.findById(communityId);
    if (!admin || !community || !isCommunityAdmin(community, admin._id)) {
      return res.status(403).json({ ok: false, error: 'Admin access required' });
    }

    const user = await User.findOne({ email: contactEmail });
    if (!user) return res.status(404).json({ ok: false, error: 'User not found for that email' });
    if (!findCommunityMember(community, user._id)) {
      community.members.push({ userId: user._id, role: 'member' });
      await community.save();
      await Conversation.updateMany(
        { type: 'community-channel', communityId: community._id },
        { $addToSet: { memberIds: user._id } },
      );
    }

    const serialized = await serializeCommunity(community, admin._id);
    return res.json({ ok: true, community: serialized });
  } catch (error) {
    console.error('Add community member failed', error);
    return res.status(500).json({ ok: false, error: 'Add community member failed' });
  }
});

app.delete('/api/communities/:communityId/members/:memberId', async (req, res) => {
  try {
    const communityId = String(req.params?.communityId || '').trim();
    const memberId = String(req.params?.memberId || '').trim();
    const adminClerkUserId = String(req.query?.clerkUserId || '').trim();
    if (!communityId || !memberId || !adminClerkUserId) {
      return res.status(400).json({ ok: false, error: 'Missing communityId, memberId, or clerkUserId' });
    }

    await connectToMongo();
    const admin = await User.findOne({ clerkUserId: adminClerkUserId });
    const community = await Community.findById(communityId);
    if (!admin || !community || !isCommunityAdmin(community, admin._id)) {
      return res.status(403).json({ ok: false, error: 'Admin access required' });
    }
    if (idsEqual(community.ownerUserId, memberId)) {
      return res.status(400).json({ ok: false, error: 'Owner cannot be removed' });
    }

    community.members = (community.members || []).filter((item) => !idsEqual(item.userId, memberId));
    await community.save();
    await Conversation.updateMany(
      { type: 'community-channel', communityId: community._id },
      { $pull: { memberIds: new mongoose.Types.ObjectId(memberId) } },
    );

    const serialized = await serializeCommunity(community, admin._id);
    return res.json({ ok: true, community: serialized });
  } catch (error) {
    console.error('Remove community member failed', error);
    return res.status(500).json({ ok: false, error: 'Remove community member failed' });
  }
});

app.post('/api/communities/:communityId/channels', async (req, res) => {
  try {
    const communityId = String(req.params?.communityId || '').trim();
    const clerkUserId = req.body?.clerkUserId?.trim?.() || '';
    const name = req.body?.name?.trim?.() || '';
    const memberIds = Array.isArray(req.body?.memberIds) ? req.body.memberIds : [];

    if (!communityId || !clerkUserId || !name) {
      return res.status(400).json({ ok: false, error: 'Missing communityId, clerkUserId, or channel name' });
    }

    await connectToMongo();
    const admin = await User.findOne({ clerkUserId });
    const community = await Community.findById(communityId);
    if (!admin || !community || !isCommunityAdmin(community, admin._id)) {
      return res.status(403).json({ ok: false, error: 'Admin access required' });
    }

    const allowedMemberIds = (community.members || [])
      .map((item) => String(item.userId))
      .filter((id) => memberIds.length === 0 || memberIds.includes(id));
    if (!allowedMemberIds.includes(String(admin._id))) allowedMemberIds.push(String(admin._id));

    const baseSlug = slugify(name) || `channel-${Date.now()}`;
    let slug = `${community.slug}-${baseSlug}`;
    let suffix = 2;
    while (await Conversation.findOne({ type: 'community-channel', communityId, slug })) {
      slug = `${community.slug}-${baseSlug}-${suffix++}`;
    }

    await Conversation.create({
      type: 'community-channel',
      communityId,
      slug,
      name,
      memberIds: allowedMemberIds.map((id) => new mongoose.Types.ObjectId(id)),
      createdById: admin._id,
      adminOnlyPosting: false,
    });

    const serialized = await serializeCommunity(community, admin._id);
    return res.status(201).json({ ok: true, community: serialized });
  } catch (error) {
    console.error('Create community channel failed', error);
    return res.status(500).json({ ok: false, error: 'Create community channel failed' });
  }
});

app.patch('/api/communities/:communityId/channels/:channelId/access', async (req, res) => {
  try {
    const communityId = String(req.params?.communityId || '').trim();
    const channelId = String(req.params?.channelId || '').trim();
    const clerkUserId = req.body?.clerkUserId?.trim?.() || '';
    const memberIds = Array.isArray(req.body?.memberIds) ? req.body.memberIds : [];

    if (!communityId || !channelId || !clerkUserId) {
      return res.status(400).json({ ok: false, error: 'Missing communityId, channelId, or clerkUserId' });
    }

    await connectToMongo();
    const admin = await User.findOne({ clerkUserId });
    const community = await Community.findById(communityId);
    if (!admin || !community || !isCommunityAdmin(community, admin._id)) {
      return res.status(403).json({ ok: false, error: 'Admin access required' });
    }

    const allowedCommunityMemberIds = new Set((community.members || []).map((item) => String(item.userId)));
    const nextMemberIds = memberIds.filter((id) => allowedCommunityMemberIds.has(String(id)));
    if (!nextMemberIds.includes(String(admin._id))) nextMemberIds.push(String(admin._id));

    await Conversation.findOneAndUpdate(
      { _id: channelId, communityId, type: 'community-channel' },
      { $set: { memberIds: nextMemberIds.map((id) => new mongoose.Types.ObjectId(id)) } },
      { new: true },
    );

    const serialized = await serializeCommunity(community, admin._id);
    return res.json({ ok: true, community: serialized });
  } catch (error) {
    console.error('Update channel access failed', error);
    return res.status(500).json({ ok: false, error: 'Update channel access failed' });
  }
});

app.delete('/api/communities/:communityId/channels/:channelId', async (req, res) => {
  try {
    const communityId = String(req.params?.communityId || '').trim();
    const channelId = String(req.params?.channelId || '').trim();
    const clerkUserId = String(req.query?.clerkUserId || '').trim();

    if (!communityId || !channelId || !clerkUserId) {
      return res.status(400).json({ ok: false, error: 'Missing communityId, channelId, or clerkUserId' });
    }

    await connectToMongo();
    const admin = await User.findOne({ clerkUserId });
    const community = await Community.findById(communityId);
    if (!admin || !community || !isCommunityAdmin(community, admin._id)) {
      return res.status(403).json({ ok: false, error: 'Admin access required' });
    }

    const channel = await Conversation.findOne({ _id: channelId, communityId, type: 'community-channel' });
    if (!channel) {
      return res.status(404).json({ ok: false, error: 'Channel not found' });
    }

    if (isAnnouncementChannel(channel)) {
      return res.status(400).json({ ok: false, error: 'Announcement channel cannot be deleted' });
    }

    await Message.deleteMany({ conversationId: channel._id });
    await Conversation.deleteOne({ _id: channel._id });

    const serialized = await serializeCommunity(community, admin._id);
    return res.json({ ok: true, community: serialized, deletedChannelId: channelId });
  } catch (error) {
    console.error('Delete community channel failed', error);
    return res.status(500).json({ ok: false, error: 'Delete community channel failed' });
  }
});

app.delete('/api/communities/:communityId', async (req, res) => {
  try {
    const communityId = String(req.params?.communityId || '').trim();
    const clerkUserId = String(req.query?.clerkUserId || '').trim();

    if (!communityId || !clerkUserId) {
      return res.status(400).json({ ok: false, error: 'Missing communityId or clerkUserId' });
    }

    await connectToMongo();
    const owner = await User.findOne({ clerkUserId });
    const community = await Community.findById(communityId);

    if (!owner || !community || !isCommunityAdmin(community, owner._id)) {
      return res.status(403).json({ ok: false, error: 'Admin access required' });
    }

    const channels = await Conversation.find({ type: 'community-channel', communityId: community._id }).select('_id');
    const channelIds = channels.map((channel) => channel._id);

    if (channelIds.length > 0) {
      await Message.deleteMany({ conversationId: { $in: channelIds } });
      await Conversation.deleteMany({ _id: { $in: channelIds } });
    }

    await Community.deleteOne({ _id: community._id });

    return res.json({ ok: true, deletedCommunityId: communityId });
  } catch (error) {
    console.error('Delete community failed', error);
    return res.status(500).json({ ok: false, error: 'Delete community failed' });
  }
});

app.get('/api/messages', async (req, res) => {
  try {
    const room = String(req.query?.room || 'general').trim() || 'general';
    const limit = Math.min(Number(req.query?.limit || 50) || 50, 200);
    const clerkUserId = String(req.query?.clerkUserId || '').trim();

    if (!process.env.MONGODB_URI) {
      return res.status(503).json({ ok: false, error: 'MongoDB not configured' });
    }

    await connectToMongo();
    const viewer = clerkUserId ? await User.findOne({ clerkUserId }) : null;
    const conversation = await resolveConversationFromRoom(room);

    if (!conversation) return res.json({ ok: true, room, messages: [] });
    if (conversation.type === 'community-channel') {
      if (!viewer || !(conversation.memberIds || []).some((memberId) => idsEqual(memberId, viewer._id))) {
        return res.status(403).json({ ok: false, error: 'Access denied to this channel' });
      }
    }

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

app.patch('/api/account', async (req, res) => {
  try {
    const clerkUserId = String(req.body?.clerkUserId || '').trim();
    const displayName = String(req.body?.displayName || '').trim();
    const email = String(req.body?.email || '').trim();
    const statusMessage = String(req.body?.statusMessage || '').trim();

    if (!clerkUserId) {
      return res.status(400).json({ ok: false, error: 'Missing clerkUserId' });
    }
    if (!displayName) {
      return res.status(400).json({ ok: false, error: 'Display name is required' });
    }
    if (!process.env.MONGODB_URI) {
      return res.status(503).json({ ok: false, error: 'MongoDB not configured' });
    }

    await connectToMongo();
    const user = await upsertUserProfile({ clerkUserId, displayName, email });
    user.statusMessage = statusMessage;
    await user.save();

    return res.json({
      ok: true,
      account: {
        clerkUserId: user.clerkUserId,
        displayName: user.displayName,
        email: user.email || '',
        avatarUrl: user.avatarUrl || '',
        statusMessage: user.statusMessage || '',
      },
    });
  } catch (error) {
    console.error('Save account failed', error);
    return res.status(500).json({ ok: false, error: 'Save account failed' });
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

        const sender = await upsertUserProfile({
          clerkUserId,
          clientId,
          displayName: username,
          email: '',
        });
        let conversation = await resolveConversationFromRoom(room);

        if (conversation?.type === 'community-channel') {
          if (!(conversation.memberIds || []).some((memberId) => idsEqual(memberId, sender._id))) {
            throw new Error('You do not have access to this channel');
          }
          if (isAnnouncementChannel(conversation)) {
            const parentCommunity = await Community.findById(conversation.communityId);
            if (!parentCommunity || !isCommunityAdmin(parentCommunity, sender._id)) {
              throw new Error('Only the community admin can post in announcement');
            }
          }
          conversation = await Conversation.findOneAndUpdate(
            { _id: conversation._id, type: 'community-channel' },
            { $set: { lastMessageAt: new Date(time) } },
            { new: true },
          );
        } else if (conversation?.type === 'dm') {
          conversation = await Conversation.findOneAndUpdate(
            { _id: conversation._id, type: 'dm' },
            { $set: { lastMessageAt: new Date(time) }, $addToSet: { memberIds: sender._id } },
            { new: true },
          );
        } else {
          conversation = await Conversation.findOneAndUpdate(
            { type: 'room', slug: room },
            {
              $setOnInsert: { type: 'room', slug: room, name: room },
              $set: { lastMessageAt: new Date(time) },
              $addToSet: { memberIds: sender._id },
            },
            { upsert: true, new: true },
          );
        }

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
            username: 'Codex AI',
            time: new Date().toISOString(),
            clientId: 'mia-gemini',
            isBot: true,
            senderId: 'mia-gemini',
          };
          pushRoomContext(room, miaMessage);
          await pusher.trigger('chat', 'message', miaMessage);
        } catch (error) {
          const msg = error?.message || String(error);
          console.warn('Codex AI (Gemini) reply failed:', msg);
          const miaErrorMessage = {
            id: makeBotMessageId('mia-error'),
            room,
            message: `Codex AI is offline right now (${msg}).`,
            username: 'Codex AI',
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
