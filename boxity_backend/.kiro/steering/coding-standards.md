# Coding Standards & Best Practices

## Python Code Style

### General Principles

- Follow **PEP 8** with these exceptions:
  - Line length: 120 characters (not 79)
  - Use type hints for all function signatures
  - Prefer clarity over brevity

### Type Hints

All functions must include type hints:

```python
from typing import Optional, Dict, List, Tuple, Any

def load_image_bytes(source: str) -> Tuple[Optional[bytes], Optional[str]]:
    """Load image from URL or base64."""
    pass

def compute_tis(differences: List[Dict[str, Any]]) -> int:
    """Calculate Trust Integrity Score."""
    pass
```

### Imports

- Group imports: stdlib, third-party, local
- Use absolute imports for local modules: `from .ai import call_gemini_ensemble`
- Handle optional dependencies gracefully:

```python
try:
    import cv2
except Exception:
    cv2 = None
    print("cv2 import failed", file=sys.stderr)
```

### Error Handling

- Use specific exception types, not bare `except`
- Log errors to stderr with context
- Return sensible defaults on failure:

```python
try:
    result = model.generate_content(parts)
except ValidationError as e:
    print(f"Schema validation failed: {e}", file=sys.stderr)
    return {"differences": []}
```

### Function Documentation

Use docstrings for all public functions:

```python
def _analyze_pair(baseline_src: str, current_src: str, view_label: str) -> Dict[str, Any]:
    """Analyze a pair of images for differences.
    
    Args:
        baseline_src: URL or base64 of baseline image
        current_src: URL or base64 of current image
        view_label: Label for this view (e.g., 'angle_1')
    
    Returns:
        Dict with differences, TIS, assessment, and metadata
    
    Raises:
        ValueError: If images cannot be loaded
    """
    pass
```

## API Response Consistency

### JSON Structure

All responses must follow the schema in `api/schema.py`:

- Always include required fields: `differences`, `aggregate_tis`, `overall_assessment`, `confidence_overall`, `notes`
- Use consistent field names (snake_case)
- Validate responses before returning

### Error Responses

Return errors with consistent structure:

```python
return jsonify({
    "error": "Human-readable error message",
    "differences": [],
    "aggregate_tis": 100,
    "overall_assessment": "UNKNOWN"
}), 400
```

### Status Codes

- `200` — Success
- `400` — Bad request (missing/invalid inputs)
- `500` — Server error (API key missing, model failure)

## Detection Type Consistency

When adding new detection types:

1. Define in detection types list (project-overview.md)
2. Add to Gemini prompt in `api/ai.py`
3. Set appropriate severity (HIGH/MEDIUM/LOW)
4. Define TIS delta (negative value)
5. Update schema if needed

Example:

```python
# Detection type: "new_type"
# Severity: MEDIUM
# TIS Delta: -20
# Description: "Description of what this detects"
```

## Region Naming Convention

Always use specific region names in detection results:

- **Edges**: `left side`, `right side`, `top edge`, `bottom edge`
- **Panels**: `front panel`, `back panel`, `side panel`
- **Corners**: `top-left corner`, `top-right corner`, `bottom-left corner`, `bottom-right corner`
- **Areas**: `center`, `upper-left area`, `lower-right area`
- **Generic**: `unknown` (only if region cannot be determined)

Never use vague terms like "area", "section", or "part" without specificity.

## Bounding Box Format

Bounding boxes use normalized coordinates [0, 1]:

```python
"bbox": [x, y, width, height]
# Example: [0.12, 0.03, 0.76, 0.08]
# Means: starts at 12% from left, 3% from top, 76% wide, 8% tall
```

## Confidence Scoring

- `> 0.8` — High confidence, unequivocal evidence
- `0.6-0.8` — Moderate confidence, likely detection
- `< 0.6` — Low confidence, uncertain (triggers fallback)

## TIS Delta Values

Standard severity-to-delta mapping:

- **seal_tamper**: -40 (critical security breach)
- **repackaging**: -35 (product substitution)
- **digital_edit**: -50 (highest security risk)
- **label_mismatch**: -40 (counterfeit/altered)
- **missing_item**: -35 (contents missing)
- **color_shift**: -20 (significant tampering indicator)
- **dent**: -15 (physical damage)
- **scratch**: -8 (minor surface damage)
- **stain**: -5 (minor contamination)

## Code Organization

### Module Responsibilities

- **index.py**: Flask app, routing, request/response handling, orchestration
- **ai.py**: Gemini integration, prompt engineering, schema validation
- **vision.py**: Image processing, alignment, normalization, CV fallback
- **schema.py**: JSON schema definitions only
- **utils.py**: Shared utilities (image loading, EXIF, helpers)

### Private vs Public

- Prefix internal functions with `_`: `_load_image_bytes()`, `_compute_overall()`
- Public functions: `call_gemini_ensemble()`, `align_and_normalize()`

## Testing & Validation

- Validate all JSON responses against schema before returning
- Test with edge cases: empty images, invalid base64, missing EXIF
- Log all errors to stderr with full context
- Use try-except blocks around external API calls

## Performance Considerations

- Image size: Optimize for Gemini (typically < 20MB)
- Timeout: 20 seconds for remote image fetches
- Model calls: Ensemble uses 2 models (pro + flash) for robustness
- Fallback: Classical CV only runs if AI confidence < 0.6

## Security

- Never log API keys or sensitive data
- Validate all user inputs (image sources, JSON)
- Use CORS carefully (currently allows all origins for `/analyze`)
- Sanitize error messages before returning to client
