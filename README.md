<img width="1875" height="955" alt="Image" src="https://github.com/user-attachments/assets/597f6a85-a6cc-4d70-b420-e847180fae45" />
<img width="1875" height="955" alt="Image" src="https://github.com/user-attachments/assets/5fb174c8-715b-467e-8059-05bf0d2aa91a" />
<img width="1875" height="955" alt="Image" src="https://github.com/user-attachments/assets/fedf5866-3e22-4c71-aa3c-60949c2012e5" />
<img width="1847" height="938" alt="Image" src="https://github.com/user-attachments/assets/d48f1a26-c628-4c18-98c9-5521ea6b9cda" />
<img width="1847" height="938" alt="Image" src="https://github.com/user-attachments/assets/bb6849b4-07aa-43cd-82e8-3297726ebeac" />

## Backend
The backend lives in `backend/` and exposes:
- `GET /api/health` for basic status.
- `POST /api/message` to broadcast chat messages via Pusher.

Setup:
1. Install dependencies in `backend/`.
2. Create a `.env` in `backend/` using `backend/.env.example` as the template.
3. Start the server with `npm run dev` (or `npm start`).

Notes:
- Pusher is required for chat delivery in this minimal backend.

Frontend dev server already proxies `/api` to `http://localhost:3000` via `frontend/vite.config.js`.
