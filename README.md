# DevRooms

DevRooms is a split-deployment app:

- `frontend/` is the Vite + React client.
- `backend/` is the Express API for communities, DMs, chat history, Pusher broadcasting, and MongoDB persistence.

## Local development

### Frontend

1. Install dependencies in `frontend/`.
2. Create `frontend/.env` from `frontend/.env.example`.
3. Set:
   - `VITE_CLERK_PUBLISHABLE_KEY`
   - `VITE_PUSHER_KEY`
   - `VITE_PUSHER_CLUSTER`
   - `VITE_API_BASE_URL=http://localhost:3000`
4. Run `npm run dev`.

### Backend

1. Install dependencies in `backend/`.
2. Create `backend/.env` from `backend/.env.example`.
3. Set:
   - `PORT`
   - `ALLOWED_ORIGIN=http://localhost:5173`
   - `CLERK_SECRET_KEY`
   - `MONGODB_URI`
   - `MONGODB_DB`
   - `PUSHER_APP_ID`
   - `PUSHER_KEY`
   - `PUSHER_SECRET`
   - `PUSHER_CLUSTER`
4. Run `npm run dev`.

## Production deployment

Deploy the frontend and backend separately.

### Recommended setup

- Frontend host: Vercel
- Backend host: Render

This repo already includes:

- root `vercel.json` for the frontend build
- root `render.yaml` for the backend service

### Frontend on Vercel

Deploy the repo to Vercel and keep the root-level `vercel.json`.

Set these environment variables in the Vercel project:

- `VITE_CLERK_PUBLISHABLE_KEY`
- `VITE_PUSHER_KEY`
- `VITE_PUSHER_CLUSTER`
- `VITE_API_BASE_URL=https://your-render-backend-domain.onrender.com`

Important:

- `VITE_CLERK_PUBLISHABLE_KEY` must be a real Clerk publishable key, not the example value.
- If this value is missing or fake, the app will intentionally show the Clerk configuration error screen on load.

### Backend on Render

Create a new Render Web Service from this repo, or use the included `render.yaml`.

Service settings:

- Root directory: `backend`
- Build command: `npm install`
- Start command: `npm start`
- Health check path: `/api/health`

Set these environment variables in Render:

- `ALLOWED_ORIGIN=https://your-frontend-domain.vercel.app`
- `CLERK_SECRET_KEY`
- `CLERK_AUTHORIZED_PARTIES=https://your-frontend-domain.vercel.app`
- `MONGODB_URI`
- `MONGODB_DB`
- `PUSHER_APP_ID`
- `PUSHER_KEY`
- `PUSHER_SECRET`
- `PUSHER_CLUSTER`

Optional backend env vars:

- `CLERK_JWT_KEY`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `MIA_CONTEXT_MESSAGES`

### Deployment order

1. Deploy the backend on Render.
2. Copy the Render service URL.
3. Add that URL as `VITE_API_BASE_URL` in Vercel.
4. Deploy the frontend on Vercel.
5. Update Render `ALLOWED_ORIGIN` and `CLERK_AUTHORIZED_PARTIES` to the final Vercel domain if it changed.

### Final verification checklist

After deployment, confirm all of these:

1. Open the frontend and make sure the Clerk publishable-key error does not appear.
2. Visit `https://your-render-backend-domain.onrender.com/api/health` and confirm it responds.
3. Sign in successfully in the frontend.
4. Create or join a community.
5. Open a chat room and send a message.
6. Refresh the page and confirm history still loads.

If the frontend shows the Clerk error screen, check only these first:

1. `VITE_CLERK_PUBLISHABLE_KEY` exists in Vercel.
2. The value is a real Clerk publishable key for your production Clerk app.
3. You redeployed after saving the env var.

## API notes

- `GET /api/health` is public.
- Community, contact, message history, and message send routes now require a valid Clerk bearer token.
- Channel and DM access is enforced server-side.
- MongoDB is required for community channels, direct messages, and stored history.

## Current architecture

- Frontend realtime subscriptions use Pusher.
- Backend message posting triggers Pusher and stores messages in MongoDB when available.
- Clerk auth is verified on the backend before protected requests are processed.
