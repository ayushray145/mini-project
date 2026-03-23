import { createClerkClient, verifyToken } from '@clerk/backend';

const splitCsv = (value) =>
  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const getAuthorizedParties = () => {
  const configured = splitCsv(process.env.CLERK_AUTHORIZED_PARTIES);
  if (configured.length > 0) return configured;
  if (process.env.ALLOWED_ORIGIN) return [process.env.ALLOWED_ORIGIN];
  return [];
};

const clerkClient = process.env.CLERK_SECRET_KEY
  ? createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })
  : null;

const getBearerToken = (req) => {
  const header = req.headers.authorization || req.headers.Authorization || '';
  if (typeof header !== 'string') return '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || '';
};

export async function authenticateClerkRequest(req, res, next) {
  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({ ok: false, error: 'Missing Authorization bearer token' });
  }

  if (!process.env.CLERK_SECRET_KEY && !process.env.CLERK_JWT_KEY) {
    return res.status(500).json({ ok: false, error: 'Clerk backend auth is not configured' });
  }

  try {
    const verified = await verifyToken(token, {
      ...(process.env.CLERK_SECRET_KEY ? { secretKey: process.env.CLERK_SECRET_KEY } : {}),
      ...(process.env.CLERK_JWT_KEY ? { jwtKey: process.env.CLERK_JWT_KEY } : {}),
      ...(getAuthorizedParties().length > 0 ? { authorizedParties: getAuthorizedParties() } : {}),
    });

    let profile = null;
    if (clerkClient && verified.sub) {
      try {
        const clerkUser = await clerkClient.users.getUser(verified.sub);
        const primaryEmailId = clerkUser.primaryEmailAddressId || '';
        const primaryEmail =
          clerkUser.emailAddresses?.find((item) => item.id === primaryEmailId)?.emailAddress ||
          clerkUser.emailAddresses?.[0]?.emailAddress ||
          '';
        profile = {
          displayName:
            [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ').trim() ||
            clerkUser.username ||
            primaryEmail ||
            'User',
          email: primaryEmail,
          avatarUrl: clerkUser.imageUrl || '',
        };
      } catch {
        profile = null;
      }
    }

    req.auth = {
      userId: verified.sub,
      sessionId: verified.sid,
      token: verified,
      profile,
    };
    return next();
  } catch (error) {
    const message = error?.message || 'Token verification failed';
    return res.status(401).json({ ok: false, error: message });
  }
}
