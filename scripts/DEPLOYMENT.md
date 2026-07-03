# Permanent Free Deployment Guide (Render.com)

To bypass the PartyKit subdomain limits and deploy your multiplayer backend online permanently for free with zero maintenance, we have built a **Standalone Node.js Server** (`scripts/server.js`).

This server is a **drop-in replacement** for PartyKit. It handles all authentication, room registry, real-time voxel edits, and chat using standard WebSockets.

---

## 1. Local Development
Instead of running `npm run dev:party`, you can now run:
```bash
npm run start:server
```
This runs the standalone server on `localhost:1999` with local persistence.

---

## 2. Deploy Backend to Render (Free Tier)
1. **Sign Up on Render**: Go to [Render.com](https://render.com) and create a free account.
2. **Create Web Service**: Click **New** -> **Web Service**.
3. **Connect GitHub**: Connect your FOROOMS GitHub repository.
4. **Configure Settings**:
   - **Name**: `forooms-server`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm run start:server`
   - **Instance Type**: `Free`
5. **Add Environment Variables**: Under the "Environment" tab on Render, add:
   - `ADMIN_PIN` = `[Your Admin PIN]`
   - `RESEND_API_KEY` = `[Your Resend API Key]`
6. **Deploy**: Click **Deploy Web Service**. Render will build and deploy the server.
7. **Copy URL**: Copy your deployed Web Service URL (e.g. `forooms-server.onrender.com`). *Note: remove the `https://` prefix for the env variable.*

---

## 3. Link Next.js Frontend on Vercel
1. Go to your [Vercel Dashboard](https://vercel.com) and select the `forooms` project.
2. Go to **Settings** -> **Environment Variables**.
3. Edit/Add `NEXT_PUBLIC_PARTYKIT_HOST` to point to your new Render URL:
   - **Key**: `NEXT_PUBLIC_PARTYKIT_HOST`
   - **Value**: `forooms-server.onrender.com` (no `https://`)
4. Redeploy the project on Vercel so the environment variable is compiled into the production build.

---

## 4. Verification
Open your Vercel URL (e.g. `https://forooms.vercel.app`) in a browser and check the **Network** tab in DevTools for WebSocket connections (`wss://forooms-server.onrender.com/parties/...`). Everything will now connect and synchronize permanently!
