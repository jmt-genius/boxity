# Boxity Backend — Documentation & Architecture Overview

---

## What Is Boxity?

**Boxity** is a supply chain trust & transparency platform that allows you to verify the physical integrity and provenance of any package as it moves through the supply chain.

**Key features:**

- AI-powered package image integrity analysis (Gemini vision model)
- Blockchain-backed event and timeline logging
- End-to-end API for digital and human QA checks
- Designed for both real-time “capture and verify” and upload-from-gallery

Your backend is **Flask-based**, modular, and ready for serverless (Vercel) or traditional hosting (gunicorn, Render, etc).

---

## System Architecture Overview

### 1. **API Endpoints**

- `/analyze` (POST): Accepts two images (baseline and current), returns AI-powered integrity result as structured JSON (see schema below).
  - Handles base64 and URL inputs
  - Optionally extracts EXIF from images
  - Runs Gemini (google-generativeai, multimodal) to get detailed issues, assigns Trust Integrity Score (TIS)
  - Classical CV fallback if Gemini fails (OpenCV, NumPy; only in dev/local)
- `/` (GET): Health check
- `/about` (GET): Simple info

### 2. **Gemini Integration (google-generativeai)**

- Loads images from input (base64 or URL)
- Sends both images as multimodal prompt to Gemini (`gemini-1.5-pro-latest` and `gemini-1.5-flash-latest` ensemble)
- Uses advanced prompt, with few-shot examples and strict JSON schema instructions
- Request enforces response as `application/json` (schema: differences[], bbox, type, severity, explainability, ...)
- Post-validation using `jsonschema` for guaranteed correct structure
- If Gemini response is empty or invalid/confidence low, it runs fallback:
  - CV region proposals via OpenCV: localizes differences, QR/barcode, seal tamper, scratches/dents
- Returns all results as a single JSON object (see below)

### 3. **Classical CV Fallback**

- Uses Pillow, OpenCV, and NumPy for region analysis
- Aligns images (homography), normalizes illumination (CLAHE)
- Blobs, edges, QR codes: offers best-effort issues with bounding boxes
- Disabled on Vercel/Serverless for package size

### 4. **Image Flow**

1. **Frontend** captures (camera or gallery) or provides two images:
   - Baseline: Original/canonical image of the package (from trusted source)
   - Current: Any later image (from warehouse, delivery point, custom check, etc)
2. Sends to `/analyze` API as POST JSON:
   - `{ "baseline_b64": <base64>, "current_b64": <base64> }` **or** `{ "baseline_url": ..., "current_url": ... }`
3. API loads images, extracts info (EXIF, size), passes both to Gemini ensemble
4. Gemini returns issues (e.g., dent, scratch, repackaging, label mismatch, digital_edit!)
5. API merges/falls back to classical if needed, computes TIS, returns strict schema result
6. **Frontend** renders result visually (regions, severity, suggested action, TIS, etc)...

---

## technologies used

- **Flask** (API server)
- **google-generativeai** (Gemini Vision API integration)
- **requests** (for remote image fetching)
- **Pillow (PIL)** (EXIF, probe, preload images)
- **numpy, opencv-python-headless** (only local/dev for classical vision fallback)
- **jsonschema** (strict schema validation of Gemini output)
- **flask-cors** (CORS, dev)
- **gunicorn** (recommended for production, not Vercel)

---

## Making It Better

- **Real-time image capture**: You can swap gallery upload for a camera capture on the frontend (using `getUserMedia` in browser, React Native Camera on mobile, etc). The backend will accept either!
- **Tighter frontend/backend integration**: Add more APIs (batch event log, user sessions, etc), or auto-link captured photos to existing batch/timeline endpoints.
- **Fine tuning/prompt improvements**: Add more few-shot prompt examples, schemas, clarify types, add hard constraints on number of regions, etc.
- **Cloud Vision OCR/barcode/QR**: Hybrid with Google Vision or other barcode APIs can further improve label mismatch detection.
- **Expand/factor modular CV fallback**: Swap OpenCV region proposals for newer foundation models (SAM, CLIPseg, etc).
- **Extend blockchain support**: Integrate API Gateway for contract submission and on-chain event tracking.

---

## How the Gemini Image Analysis Pipeline Works

1. **Image Pre-processing**
   - Accepts URLs or base64 (including mobile ‘camera’ blob)
   - Loads with Pillow, verifies, optionally normalizes format
   - EXIF/metadata extraction (dimensions, datetime, GPS if present)
2. **Gemini Model Call**
   - Both images are attached as vision prompt parts
   - Prompt enforces JSON response, lists schema, types, and provides 2–3 detection examples
   - Both `gemini-1.5-pro-latest` and `gemini-1.5-flash-latest` are called (ensemble)
   - Output is parsed, schema validated
3. **Postprocessing & Schema Validation**
   - If response is invalid/empty/confidence < threshold, fallback to OpenCV region proposals
   - Classical vision pipeline generates blobs, bboxes, QR status, color shifts
   - ALL detections normalized to JSON response schema
4. **Trust Integrity Score (TIS) Computation**
   - Each difference has a weight by type (e.g., dent: -12, seal_tamper: -32, digital_edit: -40)
   - Sum, bounded [0, 100], maps to OK/REVIEW/QUARANTINE
5. **Frontend Display**
   - JSON rendered as UI cards/region highlights with severity, confidence, suggested actions

---

## PROJECT_OVERVIEW.md :: Detailed Suggestions for Future

**For Real-time Camera Integration:**

- Upfront, most users on modern browsers/phones can take a photo using `<input type="file" accept="image/*" capture="environment">` — this launches the camera, so you _don't_ have to change the API.
- In React/Next.js, you can use a library like react-dropzone, react-images-upload, or directly control with refs/events to take picture and immediately POST.
- If you want **streaming/live video** analysis: consider a socket-based solution (WebRTC or capturing video frames at interval and sending to API).

**For AI:**

- Train or further tune a model on your specific package types, defect scenarios, or supply chain real images if you have data.
- Add prompt repair, more few-shot with real anomalies, or even explicit user feedback (upvote/mark missed)
- Use high-resolution tile-by-tile analysis, or segment suspected tamper regions to further boost accuracy.

**For API:**

- Expose endpoints for batch provenance, QR code lookup, or event log retreival alongside `/analyze`.
- Add logging, metrics, and even model version consensus voting for highly regulated uses (pharma, food, luxury, etc).

---

# How Gemini Powers Boxity's Backend

## Where We Use Gemini

**Main Image Analysis Pipeline** (`/analyze` endpoint)
- Takes two images: baseline (original package) and current (package being verified)
- Gemini Vision models compare them to detect tampering, damage, or changes
- Uses `gemini-3-flash-preview` models in ensemble for accuracy

## GenAI Integration Details

**Multimodal Analysis**
- Sends both images simultaneously to Gemini with structured prompts
- AI identifies specific issues: dents, scratches, seal tampering, label changes, repackaging
- Returns structured JSON with bounding boxes, confidence scores, and severity levels

**Smart Prompting System**
- Custom prompts with few-shot examples teach Gemini what to look for
- Enforces strict JSON schema responses for consistent API output
- Includes explainability - AI explains why it flagged each issue

## Computer Vision Part

**Dual Pipeline Approach**
- **Primary**: Gemini Vision handles complex analysis (lighting changes, subtle damage, counterfeit detection)
- **Fallback**: OpenCV classical vision for basic differences when Gemini fails or has low confidence
- Gemini catches things traditional CV misses (like sophisticated counterfeits or packaging swaps)

## How It Fits Boxity

**Trust Integrity Score (TIS) Calculation**
- Gemini assigns severity levels (HIGH/MEDIUM/LOW) to each detected issue
- Each issue has a TIS delta (negative points)
- Final score determines package safety: SAFE (80-100), MODERATE_RISK (40-79), HIGH_RISK (0-39)

**Real-World Impact**
- Detects package tampering humans would miss
- Identifies counterfeit products by comparing packaging details
- Catches shipping damage for insurance claims
- Provides explainable AI results for legal/business use

**Why Gemini Over Traditional CV**
- Understands context (knows a dent is worse than a shadow)
- Handles varying lighting and angles automatically
- Can detect sophisticated tampering attempts
- Provides human-readable explanations for decisions