# Quick Reference Guide

## File Structure

```
boxity-backend/
├── api/
│   ├── __init__.py
│   ├── index.py           # Flask app, routing, orchestration
│   ├── ai.py              # Gemini integration, prompt engineering
│   ├── vision.py          # Image processing, alignment, CV fallback
│   ├── schema.py          # JSON schema definitions
│   └── utils.py           # Shared utilities
├── .env                   # Environment variables (not in git)
├── .gitignore
├── requirements.txt       # Production dependencies
├── dev-requirements.txt   # Development dependencies
├── README.md
└── .kiro/
    └── steering/
        ├── project-overview.md              # Architecture & design
        ├── coding-standards.md              # Code style & conventions
        ├── development-workflow.md          # Setup & deployment
        ├── gemini-prompt-engineering.md     # AI integration
        ├── api-integration-guide.md         # API patterns
        └── quick-reference.md               # This file
```

## Key Concepts

### Trust Integrity Score (TIS)

- **Range**: 0-100
- **Baseline**: 100 (perfect integrity)
- **Calculation**: Sum of `tis_delta` values from all differences
- **Assessment**:
  - TIS ≥ 80: **SAFE**
  - TIS 40-79: **MODERATE_RISK**
  - TIS < 40: **HIGH_RISK**

### Detection Types & TIS Deltas

| Type | Severity | TIS Delta | Description |
|------|----------|-----------|-------------|
| seal_tamper | HIGH | -40 | Broken/lifted seals |
| repackaging | HIGH | -35 | Structural changes |
| digital_edit | HIGH | -50 | Photo manipulation |
| label_mismatch | HIGH | -40 | Altered labels |
| missing_item | HIGH | -35 | Absent components |
| color_shift | MEDIUM | -20 | Color changes |
| dent | MEDIUM | -15 | Impact damage |
| scratch | LOW | -8 | Surface abrasions |
| stain | LOW | -5 | Discoloration |

### Region Names

**Edges**: left side, right side, top edge, bottom edge
**Panels**: front panel, back panel, side panel
**Corners**: top-left corner, top-right corner, bottom-left corner, bottom-right corner
**Areas**: center, upper-left area, lower-right area
**Generic**: unknown (only if region cannot be determined)

### Confidence Scoring

- `> 0.8` — High confidence, unequivocal evidence
- `0.6-0.8` — Moderate confidence, likely detection
- `< 0.6` — Low confidence, uncertain (triggers fallback)

## API Endpoints

### POST /analyze

**Single-angle request:**
```json
{
  "baseline_b64": "base64_string",
  "current_b64": "base64_string"
}
```

**Dual-angle request:**
```json
{
  "baseline_angle1": "base64_or_url",
  "baseline_angle2": "base64_or_url",
  "current_angle1": "base64_or_url",
  "current_angle2": "base64_or_url"
}
```

**Response (200 OK):**
```json
{
  "differences": [...],
  "aggregate_tis": 75,
  "overall_assessment": "MODERATE_RISK",
  "confidence_overall": 0.78,
  "notes": "...",
  "baseline_image_info": {...},
  "current_image_info": {...},
  "analysis_metadata": {...}
}
```

**Error (400/500):**
```json
{
  "error": "Error message",
  "differences": [],
  "aggregate_tis": 100,
  "overall_assessment": "UNKNOWN"
}
```

### GET /

Health check. Returns: `"Hello, World!"`

### GET /about

Service info. Returns: `"About"`

## Common Tasks

### Add a New Detection Type

1. Update `project-overview.md` — Add to detection types list
2. Update `api/ai.py` — Add to Gemini prompt system message
3. Update `api/schema.py` — If new fields needed
4. Test with sample images
5. Document in `development-workflow.md`

### Modify TIS Calculation

1. Edit `api/index.py` — Modify `_compute_overall()` function
2. Update `project-overview.md` — Document new logic
3. Test with known test cases
4. Verify assessments are correct

### Improve Gemini Prompt

1. Edit `api/ai.py` — Modify `FEW_SHOT` or system message
2. Test with sample images
3. Iterate based on results
4. Document changes in `gemini-prompt-engineering.md`

### Deploy to Production

1. Set environment variables (GOOGLE_API_KEY, FLASK_APP, FLASK_ENV)
2. Install dependencies: `pip install -r requirements.txt`
3. Run with gunicorn: `gunicorn -w 4 -b 0.0.0.0:5000 api.index:app`
4. Or deploy to Vercel/Render with environment variables

### Test Locally

```bash
# Start dev server
flask run

# Test health check
curl http://localhost:5000/

# Test analysis
curl -X POST http://localhost:5000/analyze \
  -H "Content-Type: application/json" \
  -d '{"baseline_b64": "...", "current_b64": "..."}'
```

## Code Organization

### Module Responsibilities

| Module | Responsibility |
|--------|-----------------|
| index.py | Flask app, routing, request/response handling, orchestration |
| ai.py | Gemini integration, prompt engineering, schema validation |
| vision.py | Image processing, alignment, normalization, CV fallback |
| schema.py | JSON schema definitions only |
| utils.py | Shared utilities (image loading, EXIF, helpers) |

### Function Naming

- **Private** (internal): `_load_image_bytes()`, `_compute_overall()`
- **Public** (exported): `call_gemini_ensemble()`, `align_and_normalize()`

## Type Hints

All functions must have type hints:

```python
from typing import Optional, Dict, List, Tuple, Any

def analyze(baseline: bytes, current: bytes) -> Dict[str, Any]:
    """Analyze two images."""
    pass
```

## Error Handling

- Use specific exception types, not bare `except`
- Log errors to stderr with context
- Return sensible defaults on failure

```python
try:
    result = model.generate_content(parts)
except ValidationError as e:
    print(f"Schema validation failed: {e}", file=sys.stderr)
    return {"differences": []}
```

## Performance Tips

- Image size: Optimize for Gemini (typically < 20MB)
- Timeout: 20 seconds for remote image fetches
- Model calls: Ensemble uses 2 models for robustness
- Fallback: Classical CV only runs if AI confidence < 0.6
- Caching: Consider LRU cache for repeated analyses

## Security Checklist

- ✓ Never log API keys or sensitive data
- ✓ Validate all user inputs (image sources, JSON)
- ✓ Use CORS carefully (currently allows all origins for `/analyze`)
- ✓ Sanitize error messages before returning to client
- ✓ Keep `.env` in `.gitignore`

## Debugging

### Check Gemini API

```python
import os
import google.generativeai as genai

api_key = os.getenv("GOOGLE_API_KEY")
print(f"API Key set: {bool(api_key)}")

genai.configure(api_key=api_key)
model = genai.GenerativeModel("gemini-3-flash-preview")
print("Gemini API configured successfully")
```

### Test Image Loading

```python
from api.utils import load_image_bytes, get_image_info

img_bytes, mime = load_image_bytes("https://example.com/image.jpg")
print(f"Loaded: {len(img_bytes)} bytes, MIME: {mime}")

info = get_image_info(img_bytes)
print(f"Resolution: {info['resolution']}, EXIF: {info['exif_present']}")
```

### Test Vision Pipeline

```python
from api.vision import align_and_normalize

b_norm, c_norm = align_and_normalize(baseline_bytes, current_bytes)
if b_norm is not None:
    print("Alignment successful")
else:
    print("Alignment failed (expected on Vercel)")
```

## Common Issues

| Issue | Solution |
|-------|----------|
| "GOOGLE_API_KEY not configured" | Set in `.env` file |
| "cv2 import failed" (on Vercel) | Expected on serverless; Gemini must succeed |
| "Image too large" from Gemini | Resize images before sending |
| "Invalid JSON response from Gemini" | Check/adjust prompt in `api/ai.py` |
| Model returns non-JSON | Add explicit instruction to prompt |
| Confidence scores too high | Lower temperature to 0.1 |
| Missing detections | Add more few-shot examples |
| Hallucinated differences | Lower temperature, limit output |

## Dependencies

### Production (requirements.txt)

- Flask 3.0.3
- google-generativeai 0.8.2
- requests 2.32.3
- Pillow 10.4.0
- flask-cors 5.0.0
- jsonschema 4.23.0
- opencv-python-headless 4.10.0.84
- numpy 2.1.2
- python-dotenv 1.0.1

### Development (dev-requirements.txt)

- opencv-python-headless 4.10.0.84
- numpy 2.1.2

## Environment Variables

```env
GOOGLE_API_KEY=your_gemini_api_key_here
FLASK_APP=api.index:app
FLASK_ENV=development
FLASK_RUN_PORT=5000
```

## Response Status Codes

- `200` — Success
- `400` — Bad request (missing/invalid inputs)
- `500` — Server error (API key missing, model failure)

## Useful Links

- [Gemini API Documentation](https://ai.google.dev/docs)
- [Flask Documentation](https://flask.palletsprojects.com/)
- [OpenCV Documentation](https://docs.opencv.org/)
- [JSON Schema Specification](https://json-schema.org/)

## Next Steps

1. Review `project-overview.md` for architecture
2. Check `coding-standards.md` for code style
3. Follow `development-workflow.md` for setup
4. Study `gemini-prompt-engineering.md` for AI integration
5. Use `api-integration-guide.md` for API patterns
6. Reference this file for quick lookups
