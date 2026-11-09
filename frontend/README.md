# ChatSystem deployment

## Local development

1. Copy `frontend/.env.example` to `frontend/.env` and `backend/.env.example` to `backend/.env`.
2. Fill in the MongoDB, JWT, Cloudinary, and Arcjet settings in `backend/.env`.
3. Start the backend with `npm run dev` from `backend/`, then start the frontend with `npm run dev` from `frontend/`.

## Deploy to Vercel

Create two Vercel projects from this repository:

- **Frontend:** set the Root Directory to `frontend`, with `npm run build` as the build command and `dist` as the output directory. Set `VITE_API_URL` to the backend's full API URL (for example, `https://your-api.vercel.app/api`). Set `VITE_SOCKET_URL` to the URL of the persistent Socket.IO server.
- **Backend:** set the Root Directory to `backend`. The `api/index.js` function serves the REST API under `/api/*`. Add the backend variables from `backend/.env.example` in Vercel's project settings. Use the frontend's exact deployed origin for `CLIENT_URL`, set `NODE_ENV=production`, and use `COOKIE_SAME_SITE=none` when the frontend and API are on different sites. `JWT_SECRET` must be a long, unique secret.

Vercel's serverless function serves the REST API; it does not start the Socket.IO listener. Presence, messaging events, calls, and game events therefore require a separate persistent Node.js host for the existing Socket.IO server. Set `VITE_SOCKET_URL` to that server's public URL and configure its `CLIENT_URL`, `MONGODB_URI`, and `JWT_SECRET` consistently with the REST backend.

For production authentication cookies, use HTTPS. A custom frontend and API domain under the same site is preferable; browsers may block cross-site cookies between unrelated hosting domains even when `SameSite=None` is set. Never put backend secrets in `VITE_*` variables.
