# Boxity Backend — Project Overview & Architecture

## Project Context

**Boxity** is a supply chain trust & transparency platform for verifying package integrity and provenance. The backend is a Flask-based API that uses AI-powered image analysis (Gemini Vision) combined with classical computer vision fallbacks to detect tampering, damage, and anomalies in packages.

### Core Capabilities

- **AI-Powered Analysis**: Gemini Vision ensemble (gemini-3-flash-preview) for multimodal image comparison
- **Classical CV Fallback**: OpenCV-based region detection when AI confidence is low
- **Trust Integrity Score (TIS)**: Computed from detected differences with severity weighting
- **Multi-angle Support**: Analyze packages from multiple angles simultaneously
- **Image Flexibility**: Accepts base64, data URIs, and remote URLs

## System Architecture

### API Endpoints

- `POST /analyze` — Main endpoint for package integrity analysis
  - Accepts baseline and current images (single or dual-angle)
  - Returns structured JSON with differences, TIS score, and assessment
  - Supports base64, data URIs, and URL inputs
  
- `GET /` — Health check
- `GET /about` — Service info

### Key Components

1. **api/index.py** — Flask app, request handling, orchestration
2. **api/ai.py** — Gemini ensemble integration, prompt engineering, schema validation
3. **api/vision.py** — Image alignment, normalization, classical CV fallback
4. **api/schema.py** — JSON schema definitions for validation
5. **api/utils.py** — Shared utilities (image loading, EXIF extraction)

### Analysis Pipeline

1. Load baseline and current images (from URL, base64, or data URI)
2. Extract image metadata (resolution, EXIF, camera info)
3. Call Gemini ensemble with both images and advanced prompt
4. Validate response against strict JSON schema
5. If confidence < 0.6 or response invalid, run classical CV fallback
6. Compute Trust Integrity Score (TIS) from detected differences
7. Return structured result with differences, assessment, and metadata

### Detection Types

- **seal_tamper** (HIGH severity, -40 TIS) — Broken/lifted seals
- **repackaging** (HIGH severity, -35 TIS) — Structural changes
- **label_mismatch** (HIGH severity, -40 TIS) — Altered labels
- **digital_edit** (HIGH severity, -50 TIS) — Photo manipulation
- **dent** (MEDIUM severity, -15 TIS) — Impact damage
- **scratch** (LOW severity, -8 TIS) — Surface abrasions
- **stain** (LOW severity, -5 TIS) — Discoloration
- **color_shift** (MEDIUM severity, -20 TIS) — Color changes
- **missing_item** (HIGH severity, -35 TIS) — Absent components

## Technology Stack

- **Framework**: Flask 3.0.3
- **AI/ML**: google-generativeai 0.8.2, Gemini Vision API
- **Image Processing**: Pillow, OpenCV (headless), NumPy, scikit-image
- **Validation**: jsonschema 4.23.0
- **HTTP**: requests 2.32.3
- **CORS**: flask-cors 5.0.0
- **Server**: gunicorn (production), Flask dev server (local)
- **Environment**: python-dotenv 1.0.1

## Response Schema

All `/analyze` responses follow this structure:

```json
{
  "differences": [
    {
      "id": "string",
      "region": "string (e.g., 'left side', 'top edge')",
      "bbox": [x, y, width, height] or null,
      "type": "string (detection type)",
      "description": "string",
      "severity": "HIGH|MEDIUM|LOW",
      "confidence": 0.0-1.0,
      "explainability": ["string"],
      "suggested_action": "string",
      "tis_delta": integer (negative)
    }
  ],
  "aggregate_tis": 0-100,
  "overall_assessment": "SAFE|MODERATE_RISK|HIGH_RISK",
  "confidence_overall": 0.0-1.0,
  "notes": "string",
  "baseline_image_info": { "resolution": [w, h], "exif_present": bool, ... },
  "current_image_info": { "resolution": [w, h], "exif_present": bool, ... },
  "analysis_metadata": {
    "total_differences": integer,
    "high_severity_count": integer,
    "medium_severity_count": integer,
    "low_severity_count": integer,
    "analysis_timestamp": "ISO 8601"
  }
}
```

## Trust Integrity Score (TIS) Logic

- **Baseline**: 100 (perfect integrity)
- **Calculation**: Sum of `tis_delta` values from all detected differences
- **Clamping**: Bounded to [0, 100]
- **Assessment Mapping**:
  - TIS ≥ 80: **SAFE** — Proceed
  - TIS 40-79: **MODERATE_RISK** — Supervisor review recommended
  - TIS < 40: **HIGH_RISK** — Immediate quarantine required
- **Critical Overrides**: Security issues (seal_tamper, repackaging, digital_edit) force HIGH_RISK regardless of TIS

## Key Design Decisions

1. **Ensemble Approach**: Two Gemini models (pro + flash) for consensus and robustness
2. **Schema Validation**: Strict JSON schema ensures consistent output structure
3. **Fallback Strategy**: Classical CV activates when AI confidence is low
4. **Conservative Scoring**: Confidence scores reflect certainty; >0.8 only for unequivocal evidence
5. **Security-First**: Critical issues (tampering, digital edits) trigger immediate quarantine
6. **Region Specificity**: Always use precise region names (left side, top edge, etc.)
7. **Dual-Angle Support**: Analyze packages from multiple angles with merged results
