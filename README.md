# 🏙️ FOROOMS: Participatory Urban Planning in Multiplayer 3D

[![Next.js](https://img.shields.io/badge/Next.js-16.2-black?logo=next.js&style=flat-square)](https://nextjs.org)
[![Three.js](https://img.shields.io/badge/Three.js-r185-blue?logo=three.js&style=flat-square)](https://threejs.org)
[![Realtime](https://img.shields.io/badge/Realtime-WebSockets-orange?style=flat-square)](#)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](#)

**FOROOMS** is an innovative, collaborative 3D voxel-based urban planning platform. It allows citizens, architects, and planners to download real-world city structures from OpenStreetMap, view them in a responsive 3D WebGL environment, place annotations, initiate discussion threads, and build/modify structures in real-time together.

---

## 🎨 Key Features

* 🚀 **Procedural Voxel Generation**: Translates standard OpenStreetMap (OSM) building footprints and road vectors into stylized 3D voxel islands.
* 👥 **Multiplayer Sync**: Real-time position tracking, live building modifications, and chat synchronized across all connected players.
* 💬 **Location-Based Discussion Thread**: Place markers (pins) directly onto base coordinates to start comment threads (with growing marker scales based on reply density).
* 🗺️ **High-Visibility Satellite MiniMap**: A real-time 2D tracking system styled with Esri World Imagery tiles and high opacity.
* 🏢 **Dynamic Facades**: Procedurally assigns Concrete Panel, Brick, or Glass Curtain Wall facades deterministically to simulate organic city variance.
* 🌥️ **Volumetric Shaded Clouds**: Metabal-based procedural cloud clusters hovering at multiple heights.
* 🌊 **Matte Sea & Horizon Fog**: Matte water texture rendering outside the island boundary with customizable atmospheric fog.

---

## 🏗️ System Architecture

```mermaid
graph TD
  User([Web Client]) -->|HTTP / API| NextJS[Next.js Frontend on Vercel]
  NextJS -->|Proxy| OSM[OpenStreetMap API]
  User -->|WebSocket| StandaloneWS[Standalone WS Server on Render]
  StandaloneWS -->|State Persist| SQLite[(db.json file)]
```

---

## 📂 Codebase Tour

```
├── party/                  # Original PartyKit backend code (optional)
├── scripts/                # Utility and deployment scripts
│   ├── server.js           # Production standalone WebSocket server
│   └── DEPLOYMENT.md       # Step-by-step free hosting guide
├── src/
│   ├── app/                # Next.js pages & API routes (/api/osm)
│   ├── components/
│   │   └── voxel/          # Core WebGL client, Player, and Modals
│   ├── contexts/           # Authentication & role states
│   └── lib/
│       ├── blocks/         # Facades & Voxel type registries
│       ├── osm/            # OpenStreetMap parser & parser helper
│       └── voxel/          # Greedy meshing optimization & algorithms
├── party.toml              # PartyKit configuration
└── package.json            # Project entry & build configuration
```

---

## ⚡ Quick Start

### 1. Local Development

Start both the frontend and backend locally to test:

#### Terminal 1: Realtime WebSocket Backend
```bash
npm run start:server
```
Runs the standalone WebSocket server on `localhost:1999` with local file persistence.

#### Terminal 2: Next.js Frontend
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the client.

---

## 🚀 Elegant Git & Deployment Pipelines

FOROOMS is designed to leverage **Git-integrated CD (Continuous Deployment)**, which automates deploys without the complexity of manual CI workflows:

* 🌐 **Frontend (Next.js)**: Host on **Vercel**. By linking your GitHub repository, Vercel automatically deploys preview builds for your branches, and deploys to production whenever you merge to `main`/`master`.
* 🔌 **Backend (WebSockets)**: Host on **Render.com** (Free tier). Linking your GitHub repository to Render triggers an automatic deployment of the standalone server (`scripts/server.js`) on every push.

For complete, click-by-click instructions on setting up your free production server, see the [Render Deployment Guide](file:///c:/Users/treed/OneDrive/Desktop/FOROOMS/scripts/DEPLOYMENT.md).

---

## ⚙️ Technical Highlights

### 1. Greedy Meshing Optimization
Rather than rendering thousands of individual cubes (which degrades WebGL performance), the meshing algorithm in `mesher.ts` groups adjacent blocks of the same material into large unified cuboids. This reduces the draw-call count by up to **90%**, keeping rendering speeds smooth even on low-end mobile devices.

### 2. Sea & Island Isolation bounds
The grid calculates `islandBounds` based on OSM coordinates to render a solid grass foundation inside the boundary at `y = -0.49`, while rendering an infinite repeating matte water plane at `y = -0.5` outside the boundary, preventing the sea from clipping into underground structures.
