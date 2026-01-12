# Boxity – QR Provenance Demo

An end-to-end demo for **QR-based supply chain provenance** and **package integrity verification**, built as a multi-app repo:

- **Web dashboard** (`boxity_frontend`) — React + Vite + TypeScript + Tailwind + shadcn/ui
- **Backend API** (`boxity_backend`) — Flask (`/analyze`) for AI + CV integrity scoring
- **Mobile capture app** (`app/boxity_mobile`) — Expo app for 2-angle capture with optional voice guidance

---

## Live Deployment

- **Frontend App:** [https://boxity.vercel.app/](https://boxity.vercel.app/)

---

## Table of Contents

1. [Project Overview](#project-overview)  
2. [Features](#features)  
3. [Demo Batches](#demo-batches)  
4. [Usage Guide](#usage-guide)  
5. [Design System](#design-system)  
6. [Architecture & Project Structure](#architecture--project-structure)  
7. [Technology Stack](#technology-stack)  
8. [Local Quickstart](#local-quickstart)  
9. [Production Build](#production-build)  
10. [Notes](#notes)

---

## Project Overview

Boxity provides a simple **blockchain-style provenance system** where each product batch is assigned a **unique QR identity**.  
Each custody transfer is logged with cryptographic hashes and simulated blockchain ledger references.

The demo showcases:

- **QR generation & scanning**  
- **Camera-based auto-fill for event logging**  
- **Immutable event logging per batch**  
- **Batch verification with transparent timelines**

---

## Features

| Feature                   | Description                                                                 |
| :------------------------ | :-------------------------------------------------------------------------- |
| **Home Page**             | Hero section with tagline and call-to-action                                |
| **Admin Dashboard**       | Create product batches, generate and download QR codes                      |
| **QR Scanning**           | Camera-based scanning with auto-submit and fallback to file upload           |
| **2-Angle Image Logging** | Log events with **two required images** (Angle 1 + Angle 2)                 |
| **Integrity Analysis**    | Compare images vs baselines and compute **Trust Integrity Score (TIS)** via backend `/analyze` |
| **InsForge Review Queue** | Mobile submits two views to InsForge (`approved=false`), web reviews + approves/rejects |
| **IPFS Uploads**          | Upload images to IPFS via Pinata (web + mobile)                             |
| **Verify Timeline**       | View custody events with timestamps, hashes, and ledger refs                |
| **Light/Dark Theme**      | Pure black dark mode with persistent preference                             |
| **Responsive Design**     | Fully responsive for desktop, tablet, and mobile                            |
| **Animations**            | Smooth interactions using Framer Motion                                     |
| **Voice Guidance (Mobile)** | Optional voice prompts during capture via ElevenLabs TTS                   |

---

## Demo Batches

Preloaded data is included for demo purposes:

| Batch ID      | Product           | Events |
| :------------ | :---------------- | :----- |
| `CHT-001-ABC` | VitaTabs 10mg     | 2      |
| `CHT-002-XYZ` | ColdVax           | 1      |
| `CHT-DEMO`    | Generic Demo Item | 2      |

---

## Usage Guide

### Home (`/`)
- View the hero section.  
- Click **“Try it out”** to navigate to Admin.

### Admin (`/admin`)
- Create or manage demo batches.  
- Generate QR codes (PNG) for each batch.

### Log Event (`/log-event`)
- Select a batch or scan a QR.  
- Add actor details, roles, and notes.  
- Add **Angle 1 + Angle 2 images** (required).
- Optional: run integrity analysis (TIS) before approving / logging.
- Events are logged with hash + ledger reference.

### Verify (`/verify`)
- Enter a Batch ID (e.g., `CHT-001-ABC`).  
- Retrieve the entire event timeline with cryptographic proofs.

### Theme Toggle
- Switch between **light** and **dark** themes.  
- Preference is saved in localStorage.

### Reset Demo Data
Run this in the browser console:
```js
localStorage.removeItem("boxity-batches");
```
Then refresh the page.

---

## Design System

- **Primary Color:** `#4A9EFF` (blue)  
- **Dark Mode:** Pure black (`#000000`) backgrounds  
- **UI Components:** shadcn/ui + TailwindCSS  
- **Animations:** Framer Motion for smooth transitions

---

## Architecture & Project Structure

### Data Model
Each event generates:
- **Hash:** Pseudo SHA-256 hash (64 chars)  
- **Ledger Reference:** Simulated blockchain transaction ID (`0x...`)

Demo-mode data is persisted in browser **localStorage** (`boxity-batches`). Some flows additionally integrate:

- **IPFS** (Pinata) for image storage
- **InsForge** for a pending-review batches table (`approved=false`)
- **Backend `/analyze`** for AI/CV-based integrity scoring (TIS)

### Project Structure
```

├── README.md
├── boxity_frontend/                # Web dashboard (Vite)
├── boxity_backend/                 # Flask API (/analyze)
└── app/boxity_mobile/              # Expo mobile capture app
```

---

## Technology Stack

| Layer          | Technology                                  |
| :------------- | :------------------------------------------ |
| **Web**        | React + Vite                                |
| **Language**   | TypeScript                                  |
| **Styling**    | TailwindCSS + shadcn/ui                     |
| **Animations** | Framer Motion                               |
| **QR**         | `qrcode` + `html5-qrcode`                   |
| **Backend**    | Flask (`/analyze`) + Google Gemini + OpenCV fallback |
| **Mobile**     | Expo + expo-camera + expo-av                |
| **Storage**    | Pinata → IPFS                               |
| **DB**         | InsForge (batches review queue)             |
| **Auth**       | Auth0 (web + backend optional JWT validation) |
| **Chain**      | Solana (baseline + event logging integration) |

---

## Local Quickstart

### Prerequisites
- Node.js v18+  
- npm v9+
- Python 3.10+ (for backend)

### 1) Backend API (Flask)
```bash
# from boxity_backend/
pip install -r requirements.txt

# create boxity_backend/.env (do not commit secrets)
# GOOGLE_API_KEY=...

# run
python -m flask --app api.index:app run --port 5000
```

Health check:

- `GET http://127.0.0.1:5000/`
- `POST http://127.0.0.1:5000/analyze`

`/analyze` accepts either:

- Single-pair mode:
  - `{ "baseline_b64": "data:...", "current_b64": "data:..." }`
  - `{ "baseline_url": "https://...", "current_url": "https://..." }`
- Two-angle mode:
  - `{ "baseline_angle1": "data|url", "baseline_angle2": "data|url", "current_angle1": "data|url", "current_angle2": "data|url" }`

### 2) Web Dashboard (Vite)
```bash
# from boxity_frontend/
npm install

# Start dev server
npm run dev
```

Visit [http://localhost:8080](http://localhost:8080)

Frontend env (create `boxity_frontend/.env`):

```env
VITE_BACKEND_URL=http://127.0.0.1:5000

# Pinata (either JWT or key/secret; prefer JWT)
VITE_PINATA_JWT=...

# InsForge
VITE_INSFORGE_BASE_URL=...
VITE_INSFORGE_ANON_KEY=...

# Auth0 (web)
VITE_AUTH0_DOMAIN=...
VITE_AUTH0_CLIENT_ID=...
VITE_AUTH0_AUDIENCE=...
VITE_AUTH0_NAMESPACE=...
VITE_API_URL=...
```

---

### 3) Mobile App (Expo)

The Expo app lives in `app/boxity_mobile/`.

```bash
# from app/boxity_mobile/
npm install
npm run start
```

Note: the current mobile scripts use `bunx` under the hood (`bunx rork start ...`), so you may need **Bun** installed for `npm run start` to work.

Mobile env (create `app/boxity_mobile/.env`):

```env
EXPO_PUBLIC_INSFORGE_BASE_URL=...

# Pinata (either JWT or key/secret)
EXPO_PUBLIC_PINATA_JWT=...
EXPO_PUBLIC_PINATA_API_KEY=...
EXPO_PUBLIC_PINATA_SECRET_KEY=...

# ElevenLabs (voice guidance)
EXPO_PUBLIC_ELEVENLABS_API_KEY=...
```

---

## Production Build

```bash
# from boxity_frontend/
npm run build
```

The optimized output is generated in `boxity_frontend/dist`.

---

## Notes

- Demo app for now.
- Demo-mode persistence uses browser `localStorage`.
- QR codes encode batch metadata in JSON.

---
**Integrations & How We Use Them**
- **Google Gemini**: Integrity analysis via backend `/analyze` (see [boxity_backend/api/ai.py](boxity_backend/api/ai.py), [boxity_backend/api/index.py](boxity_backend/api/index.py)).
<!-- - **Open Router**: LLM routing/proxy that lets us switch providers (Gemini, etc.) without code changes; used by the backend AI layer ([boxity_backend/config.py](boxity_backend/config.py), [boxity_backend/routes/ai.py](boxity_backend/routes/ai.py)). -->
- **Eleven Labs**: Text-to-speech for **mobile voice guidance** during capture; implemented in [app/boxity_mobile/services/tts.ts](app/boxity_mobile/services/tts.ts).
- **Kiro**: Attestation/identity integration used for signer/actor verification and optional credential checks; integration points are client API flows and backend routes (see [app/boxity_mobile/services/api.ts](app/boxity_mobile/services/api.ts) and backend AI routes).
- **Insforge**: Used as the **review queue database** (`batches` table with `approved=false`) between mobile capture and web review (see [boxity_frontend/src/pages/LogEvent.tsx](boxity_frontend/src/pages/LogEvent.tsx) and [app/boxity_mobile/services/database.ts](app/boxity_mobile/services/database.ts)).
- **Solana**: Target blockchain for on-chain proof anchoring; demo currently uses simulated ledger refs, with on-chain integration code in [boxity_frontend/src/lib/web3.ts](boxity_frontend/src/lib/web3.ts).
- **Requestly**: Developer tool for request mocking/rewriting during local testing—useful for testing API and AI request flows during development.

How they work together
- Mobile captures 2 views → uploads to IPFS (Pinata) → writes pending row to InsForge (`approved=false`) → Web loads pending rows, fetches baseline images, runs `/analyze` (TIS) → approve/reject → event logging + optional on-chain anchoring (Solana). ElevenLabs provides optional mobile voice guidance; Requestly helps devs mock/test flows locally.
