import dotenv from 'dotenv';
import { connectToMongo } from '../db/mongoose.js';
import { Conversation, Message, User } from '../models/index.js';

dotenv.config();

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const sampleUsers = [
  { displayName: 'Ava', email: 'ava@example.com' },
  { displayName: 'Noah', email: 'noah@example.com' },
  { displayName: 'Sofia', email: 'sofia@example.com' },
  { displayName: 'Liam', email: 'liam@example.com' },
  { displayName: 'Ethan', email: 'ethan@example.com' },
];

const sampleMessages = [
  'Anyone reviewing the PR?',
  'I can take this one.',
  'Heads up: deploy is running.',
  'We should add tests for this edge case.',
  'LGTM. Ship it.',
  'Can we bump the timeout from 5s to 10s?',
  'I think this breaks on Safari, will verify.',
  'Here is a quick repro: open chat, refresh, send message.',
  'Nice, that fixed it.',
  'We should document this in the README.',
];

const sampleCode = [
  '```js\nconsole.log("hello");\n```',
  '```ts\nexport type Id = string;\n```',
  '```sql\nselect * from messages order by created_at desc;\n```',
];

async function upsertRooms(roomSlugs) {
  const rooms = [];
  for (const slug of roomSlugs) {
    const room = await Conversation.findOneAndUpdate(
      { type: 'room', slug },
      { $setOnInsert: { type: 'room', slug, name: slug } },
      { upsert: true, new: true },
    );
    rooms.push(room);
  }
  return rooms;
}

async function upsertUsers() {
  const users = [];
  for (const u of sampleUsers) {
    const doc = await User.findOneAndUpdate(
      { email: u.email },
      {
        $set: { displayName: u.displayName, email: u.email },
        $setOnInsert: { statusMessage: '' },
      },
      { upsert: true, new: true },
    );
    users.push(doc);
  }
  return users;
}

async function seedMessages({ roomSlugs = ['general', 'backend', 'frontend', 'devops'], perRoom = 40 }) {
  if (!process.env.MONGODB_URI) {
    throw new Error('Missing MONGODB_URI. Set it in backend/.env before seeding.');
  }

  await connectToMongo();

  const [users, rooms] = await Promise.all([upsertUsers(), upsertRooms(roomSlugs)]);

  // Spread messages across the last ~48 hours.
  const now = Date.now();
  const start = now - 48 * 60 * 60 * 1000;

  let inserted = 0;

  for (const room of rooms) {
    const docs = [];
    for (let i = 0; i < perRoom; i += 1) {
      const sender = pick(users);
      const createdAt = new Date(randInt(start, now));
      const isCode = Math.random() < 0.2;
      const body = isCode ? pick(sampleCode) : pick(sampleMessages);

      docs.push({
        conversationId: room._id,
        senderId: sender._id,
        body,
        kind: isCode ? 'code' : 'text',
        metadata: {
          room: room.slug,
          seeded: true,
        },
        createdAt,
        updatedAt: createdAt,
      });
    }

    // Keep room membership and last message timestamp in sync.
    await Conversation.updateOne(
      { _id: room._id },
      {
        $set: { lastMessageAt: new Date(now) },
        $addToSet: { memberIds: { $each: users.map((u) => u._id) } },
      },
    );

    const result = await Message.insertMany(docs, { ordered: false });
    inserted += result.length;
  }

  return { inserted, rooms: rooms.length, users: users.length };
}

async function main() {
  const perRoom = Number(process.argv[2] || 40);
  const result = await seedMessages({ perRoom });
  console.log(`Seeded fake chat data: ${result.users} users, ${result.rooms} rooms, ${result.inserted} messages.`);
}

main().catch((err) => {
  console.error('Seeding failed:', err?.message || err);
  process.exitCode = 1;
});

