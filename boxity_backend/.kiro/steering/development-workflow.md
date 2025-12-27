# Development Workflow & Setup

## Local Development Setup

### Prerequisites

- Python 3.9+
- pip or uv package manager
- Virtual environment (venv)

### Initial Setup

```bash
# Create virtual environment
python -m venv venv

# Activate (Windows)
venv\Scripts\activate

# Activate (macOS/Linux)
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
pip install -r dev-requirements.txt
```

### Environment Configuration

Create `.env` file in project root:

```env
GOOGLE_API_KEY=your_gemini_api_key_here
FLASK_APP=api.index:app
FLASK_ENV=development
FLASK_RUN_PORT=5000
```

**Important**: Never commit `.env` to version control. It's in `.gitignore`.

## Running the Application

### Development Server

```bash
# Using Flask development server
flask run

# Server runs on http://localhost:5000
```

### Production Server

```bash
# Using gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 api.index:app
```

## Testing the API

### Health Check

```bash
curl http://localhost:5000/
# Response: "Hello, World!"
```

### Single-Angle Analysis

```bash
curl -X POST http://localhost:5000/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "baseline_b64": "base64_encoded_image",
    "current_b64": "base64_encoded_image"
  }'
```

### Dual-Angle Analysis

```bash
curl -X POST http://localhost:5000/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "baseline_angle1": "base64_or_url_1",
    "baseline_angle2": "base64_or_url_2",
    "current_angle1": "base64_or_url_1",
    "current_angle2": "base64_or_url_2"
  }'
```

### Using URLs

```bash
curl -X POST http://localhost:5000/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "baseline_url": "https://example.com/baseline.jpg",
    "current_url": "https://example.com/current.jpg"
  }'
```

## Debugging

### Enable Verbose Logging

Set `FLASK_ENV=development` in `.env` for detailed error messages.

### Check Gemini API

Verify API key is set and valid:

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

# Test with URL
img_bytes, mime = load_image_bytes("https://example.com/image.jpg")
print(f"Loaded: {len(img_bytes)} bytes, MIME: {mime}")

# Test with base64
img_bytes, mime = load_image_bytes("data:image/jpeg;base64,...")
print(f"Loaded: {len(img_bytes)} bytes, MIME: {mime}")

# Get image info
info = get_image_info(img_bytes)
print(f"Resolution: {info['resolution']}, EXIF: {info['exif_present']}")
```

### Test Vision Pipeline

```python
from api.vision import align_and_normalize

# Test alignment and normalization
baseline_bytes = ...  # Load image
current_bytes = ...   # Load image

b_norm, c_norm = align_and_normalize(baseline_bytes, current_bytes)
if b_norm is not None:
    print("Alignment successful")
else:
    print("Alignment failed (expected on Vercel)")
```

## Common Issues & Solutions

### Issue: "GOOGLE_API_KEY not configured"

**Solution**: Ensure `.env` file exists with valid API key:

```bash
echo "GOOGLE_API_KEY=your_key_here" > .env
```

### Issue: "cv2 import failed" (on Vercel)

**Solution**: This is expected on serverless. Classical CV fallback is disabled. Gemini must succeed.

**Local fix**: Install opencv-python:

```bash
pip install opencv-python
```

### Issue: "Image too large" from Gemini

**Solution**: Resize images before sending. Gemini has size limits (~20MB).

### Issue: "Invalid JSON response from Gemini"

**Solution**: Check prompt in `api/ai.py`. Gemini may need prompt adjustment for specific image types.

## Code Changes Workflow

### Adding a New Detection Type

1. **Update project-overview.md**: Add to detection types list
2. **Update api/ai.py**: Add to Gemini prompt system message
3. **Update api/schema.py**: If new fields needed
4. **Test**: Send test images, verify detection works
5. **Document**: Add to this file if workflow changes

### Modifying TIS Calculation

1. **Update api/index.py**: Modify `_compute_overall()` function
2. **Update project-overview.md**: Document new logic
3. **Test**: Verify TIS scores with known test cases
4. **Validate**: Ensure assessments (SAFE/MODERATE_RISK/HIGH_RISK) are correct

### Improving Gemini Prompt

1. **Edit api/ai.py**: Modify `FEW_SHOT` or system message
2. **Test**: Run with test images
3. **Iterate**: Refine based on results
4. **Document**: Add notes to this file

## Deployment

### Vercel Deployment

1. Push code to GitHub
2. Connect repository to Vercel
3. Set environment variables in Vercel dashboard:
   - `GOOGLE_API_KEY`
   - `FLASK_APP=api.index:app`
   - `FLASK_ENV=production`
4. Deploy

**Note**: OpenCV is disabled on Vercel (package size). Gemini must succeed.

### Traditional Hosting (Render, Heroku, etc.)

1. Set environment variables
2. Install dependencies: `pip install -r requirements.txt`
3. Run with gunicorn: `gunicorn -w 4 -b 0.0.0.0:5000 api.index:app`

## Performance Optimization

### Image Preprocessing

- Resize large images before sending to Gemini
- Use JPEG compression for faster transmission
- Extract only necessary EXIF data

### Model Selection

- Use `gemini-3-flash-preview` for speed (default)
- Use `gemini-3-pro-preview` for accuracy (if needed)
- Ensemble uses both for robustness

### Caching

Consider caching for repeated analyses:

```python
from functools import lru_cache

@lru_cache(maxsize=128)
def cached_analysis(baseline_hash, current_hash):
    # Analysis logic
    pass
```

## Monitoring & Logging

### Log Errors

All errors are logged to stderr:

```python
import sys
print("Error message", file=sys.stderr)
```

### Track API Usage

Monitor Gemini API calls:

```python
# In api/ai.py
print(f"Gemini call for {view_label}: {len(baseline_bytes)} bytes", file=sys.stderr)
```

### Response Metrics

Track response times and TIS distribution:

```python
import time
start = time.time()
# Analysis
elapsed = time.time() - start
print(f"Analysis took {elapsed:.2f}s, TIS={tis}", file=sys.stderr)
```
