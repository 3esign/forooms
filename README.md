# 🏙️ FOROOMS — Participatory Digital Twin for Urban Co-Design

[![Live](https://img.shields.io/badge/Live-forooms.vercel.app-brightgreen?style=flat-square)](https://forooms.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js-16.2-black?logo=next.js&style=flat-square)](https://nextjs.org)
[![Three.js](https://img.shields.io/badge/Three.js-r185-049ef4?logo=three.js&style=flat-square)](https://threejs.org)
[![WebSockets](https://img.shields.io/badge/Realtime-WebSockets-orange?style=flat-square)](#architecture)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](#)

> A lightweight, browser-based **Digital Twin** that turns any OpenStreetMap neighbourhood into a multiplayer 3D sandbox where citizens, architects, and municipal planners co-design urban space in real-time.

<!-- Screenshots will be added here -->

---

## Why FOROOMS?

Traditional urban planning tools are expensive, siloed, and inaccessible to the public. FOROOMS democratises the design process by combining **geo-spatial digital twinning**, **real-time collaboration**, and **gamified voxel building** into a single web application that runs in any modern browser — no downloads, no plugins, no CAD licenses.

It fits into contemporary urban planning and design frameworks as a **participatory design instrument**: a tool for stakeholder workshops, community charrettes, neighbourhood consultations, and rapid spatial prototyping.

---

## ✨ Core Capabilities

| Capability | Description |
|---|---|
| 🌐 **Geo-Spatial Digital Twin** | Procedurally reconstructs real urban geometry from OSM building footprints, heights, and road vectors into a stylised 3D voxel island |
| 👥 **Multiplayer Co-Design** | Real-time parametric urbanism — multiple participants modify structures, place annotations, and chat in a shared spatial sandbox |
| 💬 **Geo-Anchored Discussion Threads** | Pin location-specific comments directly onto the 3D model, creating site-anchored public forums with growing visual density |
| 🗺️ **Satellite Context Map** | Live 2D minimap with Esri World Imagery tiles keeps the digital twin oriented to its real-world geographical context |
| 🏢 **Procedural Facade Variance** | Deterministic assignment of Concrete Panel, Brick, and Glass Curtain Wall materials simulates organic architectural diversity |
| 🌊 **Immersive Environment** | Volumetric clouds, atmospheric fog, matte ocean, and island isolation create an engaging spatial simulation |
| 🔐 **Role-Based Access** | Admin, Builder, and Guest roles with email-based onboarding and an admin approval workflow |

---

## 🏗️ Architecture

FOROOMS is two services that deploy independently:

```
┌─────────────────────────────────────────────────────────────────┐
│                        Web Browser                              │
│  Next.js Client · Three.js/R3F · MapLibre · PartySocket         │
└────────────┬──────────────────────────────┬─────────────────────┘
             │ HTTPS                        │ WSS
             ▼                              ▼
┌────────────────────────┐    ┌──────────────────────────────────┐
│   Vercel (Frontend)    │    │   Render.com (Realtime Server)   │
│                        │    │                                  │
│  • Next.js pages       │    │  • Node.js + ws                  │
│  • /api/osm proxy      │    │  • Auth, rooms, multiplayer      │
│  • Static assets       │    │  • Voxel edit persistence        │
│                        │    │  • JSON file storage (db.json)   │
└────────────────────────┘    └──────────────────────────────────┘
```

| Service | What it does | Hosted on | Cost |
|---|---|---|---|
| **Frontend** | Map UI, 3D voxel client, OSM proxy | Vercel | Free |
| **Realtime Server** | Auth, foroom registry, multiplayer sync, voxel edit persistence | Render.com | Free |

---

## 📂 Project Structure

```
forooms/
├── src/
│   ├── app/                    # Next.js pages & API routes
│   │   ├── page.tsx            # Homepage — map, login, foroom list
│   │   ├── admin/page.tsx      # Admin dashboard
│   │   └── api/osm/route.ts    # Server-side OSM proxy
│   ├── components/
│   │   ├── Map.tsx             # Leaflet map for foroom creation
│   │   └── voxel/              # 3D engine (13 components)
│   │       ├── VoxelScene.tsx   # Main scene orchestrator
│   │       ├── Player.tsx       # FPS controls & collision
│   │       ├── VoxelMesh.tsx    # Greedy-meshed geometry & clouds
│   │       └── ...             # Modals, hotbar, minimap, layers
│   ├── contexts/
│   │   └── AuthContext.tsx     # Client-side auth state
│   └── lib/
│       ├── blocks/             # Block types & facade registry
│       ├── osm/                # OSM fetch, parse, project
│       ├── rasterizer/         # Building & tree voxelisation
│       └── voxel/              # CityGrid, greedy mesher, PRNG
├── scripts/
│   └── server.js              # Standalone WebSocket server
├── party/                     # PartyKit server (legacy, optional)
├── package.json
└── README.md
```

---

## ⚡ Local Development

```bash
# 1. Install dependencies
npm install

# 2. Start the realtime server (Terminal 1)
npm run start:server

# 3. Start the Next.js frontend (Terminal 2)
npm run dev
```

Open **http://localhost:3000**. Log in with your admin PIN (default: `123456` — set via `ADMIN_PIN` in `.env`).

---

## 🚀 Production Deployment

FOROOMS uses **two free hosting services** that auto-deploy from GitHub:

### Step 1 — Deploy the Realtime Server on Render

1. Go to [render.com](https://render.com) and sign up (free)
2. Click **New → Web Service** and connect the `3esign/forooms` GitHub repo
3. Configure:
   - **Name**: `forooms-server`
   - **Build Command**: `npm install`
   - **Start Command**: `npm run start:server`
   - **Instance Type**: Free
4. Add **Environment Variables**:
   - `ADMIN_PIN` = your admin password
   - `RESEND_API_KEY` = your Resend key (optional, for email notifications)
5. Click **Deploy** and copy the URL (e.g. `forooms-server.onrender.com`)

### Step 2 — Connect the Frontend on Vercel

1. Go to your Vercel project dashboard for `forooms`
2. Go to **Settings → Environment Variables**
3. Set `NEXT_PUBLIC_PARTYKIT_HOST` = `forooms-server.onrender.com` (no `https://`)
4. **Redeploy** the project (Settings → Deployments → Redeploy)

### Step 3 — Verify

Open [forooms.vercel.app](https://forooms.vercel.app) and check the browser DevTools **Network** tab — you should see WebSocket connections to your Render server.

### After Setup — Updating

Every future change follows this simple flow:

```
Edit code locally → Test on localhost → Push to GitHub → Both services auto-redeploy
```

---

## 🔧 Environment Variables

| Variable | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_PARTYKIT_HOST` | Vercel (build-time) | Points the frontend to the realtime server |
| `ADMIN_PIN` | Render + local `.env` | Admin authentication password |
| `RESEND_API_KEY` | Render + local `.env` | Email notifications for access requests (optional) |

---

## ⚙️ Technical Highlights

### Greedy Meshing
The voxel renderer groups adjacent blocks of the same material into large cuboids instead of rendering individual cubes. This reduces draw calls by up to **90%**, keeping performance smooth even on mobile.

### Island Isolation
The grid calculates `islandBounds` from OSM coordinates to render a solid grass foundation inside the boundary (`y = -0.49`) and an infinite water plane outside (`y = -0.5`), creating a natural island effect.

### Procedural Clouds
Metaball-based volumetric cloud clusters render at multiple sky heights with three-tier shading (white top, off-white middle, blue-gray base).

---

## 🗺️ Roadmap

- [ ] Supabase integration for persistent auth and data
- [ ] Layer-based design comparison (before/after overlays)
- [ ] Export to glTF for integration with BIM/GIS tools
- [ ] AI-assisted spatial analysis and design suggestions
- [ ] Mobile-responsive touch controls

---

## 📄 License

MIT — free for academic, municipal, and commercial use.
