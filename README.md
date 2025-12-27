# Boxity – QR Provenance Demo

A production-ready demo for **QR-based supply chain provenance tracking**, built with **Next.js, TypeScript, TailwindCSS, and shadcn**.  
The project simulates end-to-end blockchain-backed logging and verification of product batches without requiring IoT hardware.

---

## Live Deployment

- **Frontend App:** [https://chain-box-trust.vercel.app/](https://chain-box-trust.vercel.app/)

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
| **Event Logging**         | Record custody events with actor, role, notes, and images                   |
| **Verify Timeline**       | View all custody events with timestamps, hashes, and ledger refs             |
| **Light/Dark Theme**      | Pure black dark mode with persistent preference                             |
| **Responsive Design**     | Fully responsive for desktop, tablet, and mobile                            |
| **Animations**            | Smooth interactions using Framer Motion                                     |

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

Data is persisted in browser **localStorage** (`boxity-batches`).

### Project Structure
```
├── .gitignore
├── README.md
├── bun.lockb
├── components.json
├── eslint.config.js
├── index.html
├── package-lock.json
├── package.json
├── postcss.config.js
├── public
│   ├── favicon.ico
│   ├── placeholder.svg
│   └── robots.txt
├── src
│   ├── App.css
│   ├── App.tsx
│   ├── components
│   │   ├── AnimatedTimeline.tsx
│   │   ├── Box3D.tsx
│   │   ├── GlassCard.tsx
│   │   ├── Navbar.tsx
│   │   ├── QRScanAnimator.tsx
│   │   ├── QRScanner.tsx
│   │   └── ui/ [...shadcn components]
│   ├── contexts/ThemeContext.tsx
│   ├── hooks/ [...custom hooks]
│   ├── lib/ [demoData.ts, utils.ts]
│   ├── pages/ [Index, Admin, LogEvent, Verify, NotFound]
│   └── main.tsx
├── tailwind.config.ts
├── tsconfig.json
├── vite.config.ts
```

---

## Technology Stack

| Layer          | Technology                                  |
| :------------- | :------------------------------------------ |
| **Framework**  | React 18 + Vite                             |
| **Language**   | TypeScript                                  |
| **Styling**    | TailwindCSS + shadcn/ui                     |
| **Animations** | Framer Motion                               |
| **QR**         | `qrcode` + `html5-qrcode`                   |
| **State**      | LocalStorage-based persistence              |
| **Routing**    | React Router                                |

---

## Local Quickstart

### Prerequisites
- Node.js v18+  
- npm v9+

### Run Locally
```bash
# Install dependencies
npm install

# Start dev server
npm run dev
```

Visit [http://localhost:8080](http://localhost:8080)

---

## Production Build

```bash
npm run build
```

The optimized output is generated in `/dist`.

---

## Notes

- Demo app for now;  
- Data persistence is simulated via browser `localStorage`.  
- Images reference `/demo/` folder (placeholders).  
- QR codes encode batch metadata in JSON.

---
