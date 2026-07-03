# 🏙️ FOROOMS — Participatory Digital Twin for Urban Co-Design

[![Live](https://img.shields.io/badge/Live-forooms.vercel.app-brightgreen?style=flat-square)](https://forooms.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js-16.2-black?logo=next.js&style=flat-square)](https://nextjs.org)
[![Three.js](https://img.shields.io/badge/Three.js-r185-049ef4?logo=three.js&style=flat-square)](https://threejs.org)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%20(Supabase)-blue?logo=postgresql&style=flat-square)](#architecture)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](#)

> A lightweight, web-based **Digital Twin** and **Interactive Spatial Sandbox** that converts any OpenStreetMap neighbourhood into a multiplayer 3D canvas. FOROOMS enables citizens, community groups, architects, and municipal planners to co-design and debate urban interventions in real-time.

---

## 🌐 The Role of FOROOMS in Participatory Planning

FOROOMS fits into contemporary urban planning, community engagement, and digital governance frameworks as a **democratic spatial design instrument**. It is built around three core methodology pillars:

### 1. Zero-Friction Digital Twinning (Real-World Context)
By inputting any coordinate bounding box, FOROOMS procedurally reconstructs real-world urban environments. It queries building footprints, height levels, and road coordinates directly from **OpenStreetMap** (OSM), and projects them into a 3D island. This provides immediate, geographically-accurate context for proposed designs without requiring manual 3D modeling.

### 2. Democratized Voxel Co-Design (Tactical & Gamified Urbanism)
Voxel-based building (inspired by Minecraft) removes the learning curve of CAD software. Citizens, children, and stakeholders can actively place and delete blocks to draft building extensions, design bike lanes, propose pocket parks, or model street furniture. By allowing multiple users to build in the same space simultaneously, design workshops become active, creative, and collaborative games.

### 3. Geo-Anchored Public Forums (Spatial Discourse)
Instead of storing comments in separate documents, participants drop comment pins directly onto the 3D model at specific coordinates (e.g., at a dangerous intersection, a proposed park bench, or a building entrance). As comments accumulate:
* Pins visually grow in size to reflect the intensity of community interest.
* This creates a **visual heatmap** of community concerns directly inside the spatial context.
* It hosts threaded discussions where stakeholders can deliberate on specific site-anchored issues.

---

## 🛠️ How It Relates to Planning Workflows

* **Community Design Workshops (Charrettes)**: Planners can load a neighborhood's digital twin on a tablet, projector, or computer lab. Workshop participants can work together in real-time to prototype local park layouts, community hubs, or traffic calming designs.
* **Neighborhood Consultations & Feedback Loops**: Municipalities can publish a proposed Foroom link on their portal. Local residents can walk through the proposal in first-person (FPS) or fly mode, drop comments on parts they like or dislike, and propose alternative arrangements by placing blocks.
* **Tactical Urbanism Prototyping**: Activists and community designers can quickly model pop-up bike lanes, parklets, and sidewalk expansions in 3D to build consensus and present a compelling vision to city councils.

---

## ✨ Core Capabilities

| Capability | Description |
|---|---|
| 👥 **Multiplayer Co-Design** | Real-time parametric urbanism — multiple participants modify structures, place annotations, and chat in a shared spatial sandbox |
| 💬 **Geo-Anchored Discussion Threads** | Pin location-specific comments directly onto the 3D model, creating site-anchored public forums with growing visual density |
| 🗺️ **Centered Satellite MiniMap** | Live 2D minimap with MapLibre & Esri World Imagery tiles that centers and pans dynamically around the player |
| 🏢 **Procedural Facade Variance** | Deterministic assignment of Concrete Panel, Brick, and Glass Curtain Wall facade types simulates organic architectural diversity |
| 🌳 **Solid Voxel Base Terrain** | The base grass terrain is fully integrated into the 3D voxel grid at `y = 0`, creating a smooth, Minecraft-style surface flush with roads |
| 🎛️ **Multi-Layer Design Modes** | Toggle between **Playground** (free citizen sandbox), **Council** (municipal guidelines), and **Simulation** (agent-based traffic pathfinding) |
| 🔒 **Role-Based Access** | Admin, Builder, and Guest roles with email-based onboarding and a dedicated admin approval panel |
| 🛡️ **Self-Trapping Prevention** | Smart block-body overlap checks prevent builders from placing blocks on themselves and getting stuck |

---

## 🏗️ Architecture

FOROOMS consists of a Next.js frontend and a Node.js WebSocket backend that connects to a managed PostgreSQL database.

```
                               ┌─────────────────────────────────┐
                               │           Web Browser           │
                               │  Next.js Client · Three.js/R3F  │
                               │    MapLibre · WebSocket Client  │
                               └──────────────┬──────────────────┘
                                              │ WSS (WebSockets)
                                              ▼
 ┌────────────────────────┐    ┌─────────────────────────────────┐    ┌────────────────────────┐
 │   Vercel (Frontend)    │    │  Render.com (Realtime Server)   │    │  Supabase (Database)   │
 │                        │◄───┤                                 ├───►│                        │
 │ • Static Next.js pages │    │ • Node.js + WebSockets (ws)     │    │ • PostgreSQL DB        │
 │ • OSM API Proxy        │    │ • Real-time coordinate sync     │    │ • Persistent Room Data │
 │ • Client-side Router   │    │ • Auth & Onboarding logic       │    │ • Block & Marker Store │
 └────────────────────────┘    └─────────────────────────────────┘    └────────────────────────┘
```

| Service | Technology | Role | Hosted On |
|---|---|---|---|
| **Frontend** | React, React Three Fiber (Three.js), Tailwind CSS | Renders the 3D world, camera controls, HUD, and 2D Leaflet selection map | Vercel (Free) |
| **Realtime Server** | Node.js, `ws` (WebSockets), Express | Handles real-time client state sync, user authentication, and admin commands | Render.com (Free) |
| **Database** | PostgreSQL | Persists user accounts, room configurations, placed markers, and voxel edits | Supabase (Free) |

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
│   │   ├── Map.tsx             # Leaflet map for selection & room creation
│   │   └── voxel/              # 3D engine (13 components)
│   │       ├── VoxelScene.tsx  # Main scene orchestrator
│   │       ├── Player.tsx      # FPS controls, physics, & collision
│   │       ├── VoxelMesh.tsx   # Greedy-meshed geometry & cloud generator
│   │       └── ...             # Modals, hotbar, minimap, layers
│   ├── contexts/
│   │   └── AuthContext.tsx     # Client-side auth & session state
│   └── lib/
│       ├── blocks/             # Block types & facade registries
│       ├── osm/                # OSM fetching, parsing, & projection
│       ├── rasterizer/         # Building, sidewalk, & vegetation voxelization
│       └── voxel/              # CityGrid sparse coordinate map, mesher, PRNG
├── scripts/
│   ├── server.js               # Standalone Node.js WebSocket backend
│   └── DEPLOYMENT.md           # Backend server deployment instructions
├── package.json
└── README.md
```

---

## ⚡ Local Development

```bash
# 1. Install dependencies
npm install

# 2. Start the standalone Node.js WebSocket server (Terminal 1)
npm run start:server

# 3. Start the Next.js frontend (Terminal 2)
npm run dev
```

Open **http://localhost:3000**. Log in with your admin PIN (default: `1234` — configurable via `ADMIN_PIN` in your environment).

---

## 🚀 Production Deployment

FOROOMS is designed to run completely on **free-tier cloud services** with automatic deployments from your GitHub repository.

### Step 1 — Set Up your Database on Supabase
1. Go to [Supabase](https://supabase.com) and create a free project.
2. Go to **Project Settings → Database → Connection Pooler**.
3. Under the **Connection String** tab, copy the **Transaction Pooler string** (using port `6543`). It will look like this:
   `postgresql://postgres.[ref]:[PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres`
4. Replace `[PASSWORD]` with your database password.

### Step 2 — Deploy the WebSocket Server on Render
1. Go to [Render](https://render.com) and create a free account.
2. Create a new **Web Service** and connect your FOROOMS GitHub repository.
3. Configure the service settings:
   * **Name**: `forooms-server`
   * **Runtime**: `Node`
   * **Build Command**: `npm install`
   * **Start Command**: `npm run start:server`
   * **Instance Type**: `Free`
4. Add the following **Environment Variables** under the Environment tab:
   * `DATABASE_URL` = [Your copied Supabase Connection Pooler string]
   * `ADMIN_PIN` = [Your desired admin PIN for approval dashboards]
   * `RESEND_API_KEY` = [Optional: Resend API key for email approvals]
5. Click **Deploy**. Copy the completed service URL (e.g., `forooms-server.onrender.com`).

### Step 3 — Deploy the Frontend on Vercel
1. Go to [Vercel](https://vercel.com) and import your FOROOMS repository.
2. Go to **Settings → Environment Variables** and add:
   * **Key**: `NEXT_PUBLIC_PARTYKIT_HOST`
   * **Value**: `forooms-server.onrender.com` (do not include `https://`)
3. Click **Deploy** (or Redeploy if already imported) to compile the environment variable into the production frontend.

---

## 🔧 Environment Variables Reference

| Variable | Scope | Purpose |
|---|---|---|
| `NEXT_PUBLIC_PARTYKIT_HOST` | Vercel (Compile-time) | Directs the frontend socket connection to your Render server |
| `DATABASE_URL` | Render (Run-time) | PostgreSQL connection string pointing to your Supabase instance |
| `ADMIN_PIN` | Render + local `.env` | Access password for the admin dashboard panel |
| `RESEND_API_KEY` | Render + local `.env` | Optional key to send onboarding approval email alerts to administrators |

---

## ⚙️ Technical Highlights

### Greedy Meshing
Rendering hundreds of thousands of individual cubes causes severe browser lag. FOROOMS uses a greedy meshing algorithm (`mesher.ts`) that runs a 2D sweep-line over coordinate slices, grouping adjacent blocks of the same material into large unified rectangular prisms. This reduces rendering draw calls by up to **90%**, keeping the framerate fluid on mobile devices and low-spec laptops.

### Dynamic Facade Gen
To make procedural cities look organic, a deterministic PRNG hashes coordinates to assign distinct facades to OSM building polygons. Buildings generate using either Concrete Panels, Bricks, or Glass Curtain Walls with randomized window placement.

### DNS IPv4 Routing
Since hosting environments like Render often lack outbound IPv6 routing, the server code features a custom DNS lookup wrapper that forces hostname resolutions to IPv4 first, ensuring robust connections to cloud database providers.

---

## 🗺️ Completed & Future Roadmap

- [x] **Supabase Integration**: Persistent PostgreSQL database for accounts and coordinates.
- [x] **Geographical Minimap**: Satellite imagery minimap that centers and tracks the player.
- [x] **Voxel Terrain Integration**: Base grass terrain meshed directly into the 3D voxel grid.
- [ ] **glTF Export**: Export Foroom creations directly to standard 3D formats for BIM/GIS software.
- [ ] **Mobile Touch Support**: Joystick controls for phone and tablet browsers.
- [ ] **AI Planning Co-Pilot**: LLM-assisted building suggestions based on local zoning regulations.

---

## 📄 License

MIT License — free for academic, community, municipal, and commercial use.
