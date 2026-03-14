import Pusher from 'pusher-js';

export const createPusherClient = () => {
  const key = import.meta.env.VITE_PUSHER_KEY;
  const cluster = import.meta.env.VITE_PUSHER_CLUSTER;
  if (!key || !cluster) {
    throw new Error('Pusher keys missing');
  }
  return new Pusher(key, {
    cluster,
    forceTLS: true,
  });
};
