# Boxity Frontend Architecture

This document outlines the high-level architecture of the Boxity frontend workflow, defining the primary routes and what each respective page does in the context of the supply chain integrity application.

## Tech Stack Overview
The frontend is built using **React** with **TypeScript** and **Vite**. Routing is handled via `react-router-dom`. State management incorporates standard React hooks alongside `@tanstack/react-query` for API fetching. UI components leverage `framer-motion` for animations, `lucide-react` for icons, and a custom TailwindCSS setup often patterned around `shadcn/ui` aesthetics. Web3 interactions are utilized mapped via `web3Service`.

---

## Application Flow

The central router configuration (found in `src/App.tsx`) determines the user flow across several key pages.

### 1. Landing / Home (`/` - `Index.tsx`)
**Purpose:** Provides the primary entry point and marketing overview of Boxity.
**Key Features:**
- **Hero & CTA:** Compelling explanation of the product proposition ("Trust what you track").
- **Interactive Visuals:** Employs a lively 3D representation (`<Cubes />`) with mouse-tilt framer-motion interactions.
- **Simulator (`<QRScanAnimator />`):** Shows users how the flow works in a timeline simulation without requiring hardware.
- **Feature Breakdown:** Details the three-step flow: *Create*, *Scan & Log*, and *Verify*.

### 2. Admin Dashboard (`/admin` - `Admin.tsx`)
**Purpose:** Serving as the genesis point for tracking. This page allows administrators or manufacturers to register a new product batch into the system.
**Key Features:**
- **Batch Creation:** Forms to ingest Product Name, SKU, and Two Baseline Images (uploaded to Pinata IPFS).
- **Blockchain Integration:** Can connect a Web3 wallet (`<WalletConnect />`) and persist the created batch directly to Ethereum/Solana via the `web3Service.createBatch`.
- **QR Generation:** Auto-generates a unique Batch ID and associated QR code payload (that users handle physically) upon successful creation.
- **Data Tables:** Displays historical summary tables of both Local (Demo) Batches and active Blockchain Batches.

### 3. Log Event (`/log-event` - `LogEvent.tsx`)
**Purpose:** The utility page for handlers (3PLs, distributors, retailers) to scan an active Boxity batch QR (or manually type the ID) to log a new touchpoint (handoff event) in the digital ledger.
**Key Features:**
- **QR Scanner:** Can open the camera (`<QRScanner />`) and decode the incoming batch id.
- **Integrity Validation:** Enforces the user to upload *two new current angles* of the box before submission. It then proxies these to the Boxity backend (`/api/analyze`) to compare them against the IPFS-stored Baseline Images.
- **Automated AI Gatekeeping:** Uses the computed Trust Identity Score (TIS). If it drops below `<40%`, the system outright denies the blockchain log attempt, blocking compromised packages from proceeding.
- **Web3 Logging:** If approved, logs an immutable event mapping combining actor, datetime, and cryptographic hashes to the blockchain.

### 4. Verify & Provenance (`/verify` - `Verify.tsx`)
**Purpose:** The primary read-only page meant for regulators or end consumers to audit the integrity history of a given package.
**Key Features:**
- **Identity Lookup:** Accepts a manual Boxity ID or launches a scanner to process the QR.
- **Timeline Projection (`<AnimatedTimeline />`):** Iterates chronologically through every event that occurred in the supply chain lifecycle mapping.
- **Cryptographic Transparency:** Visualizes timestamps, hashes, and associated baseline/current images per step, proving chain of custody.

### 5. Manual Diagnostic Tool (`/integrity-check` - `IntegrityCheck.tsx`)
**Purpose:** A standalone testing utility detached from the formal pipeline to quickly test the underlying GEMINI-powered visual analysis AI tool manually.
**Key Features:**
- **Side-by-side Uploads:** Allows users to blindly upload 2 custom baseline images alongside 2 custom current images.
- **Results Render:** Connects to the `/api/analyze` methodology. It parses back specific bounding boxes, severity ratings (Low, Medium, High), descriptions, and produces a mocked circular Trust Score visual indicating Risk Levels (Safe, Moderate Risk, High Risk).
- **Demo Mode:** Contains simulated SVG box geometries representing pristine and damaged conditions to evaluate UI responses instantly.

### 6. Fallback (`*` - `NotFound.tsx`)
**Purpose:** Standard 404 Error page indicating the requested route path does not exist. 
