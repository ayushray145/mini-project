const Pusher = require('pusher');

const {
  PUSHER_APP_ID,
  PUSHER_KEY,
  PUSHER_SECRET,
  PUSHER_CLUSTER,
  ALLOWED_ORIGIN,
} = process.env;

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
};

module.exports = handler;
