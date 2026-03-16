import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import Pusher from 'pusher';

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
  });
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

    if (!message) {
      return res.status(400).json({ ok: false, error: 'Missing message' });
    }

    await pusher.trigger('chat', 'message', {
      id,
      room,
      message,
      username,
      time,
      clientId,
    });

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Pusher trigger failed', error);
    return res.status(500).json({ ok: false, error: 'Pusher trigger failed' });
  }
});

app.listen(PORT, () => {
  if (!pusherConfigured) {
    console.warn('Pusher env vars missing. Check backend/.env.example for required values.');
  }
  console.log(`Backend listening on http://localhost:${PORT}`);
});
