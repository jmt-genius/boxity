# API Integration Guide & Common Patterns

## Request/Response Patterns

### Request Format

All requests to `/analyze` use POST with JSON body:

```json
{
  "baseline_b64": "base64_string",
  "current_b64": "base64_string"
}
```

Or with URLs:

```json
{
  "baseline_url": "https://example.com/baseline.jpg",
  "current_url": "https://example.com/current.jpg"
}
```

Or mixed:

```json
{
  "baseline_b64": "base64_string",
  "current_url": "https://example.com/current.jpg"
}
```

### Dual-Angle Request

For multi-angle analysis:

```json
{
  "baseline_angle1": "base64_or_url",
  "baseline_angle2": "base64_or_url",
  "current_angle1": "base64_or_url",
  "current_angle2": "base64_or_url"
}
```

Or using alternative field names:

```json
{
  "baseline_1": "base64_or_url",
  "baseline_2": "base64_or_url",
  "current_1": "base64_or_url",
  "current_2": "base64_or_url"
}
```

### Response Format (Single-Angle)

```json
{
  "differences": [
    {
      "id": "d1",
      "region": "top edge",
      "bbox": [0.12, 0.03, 0.76, 0.08],
      "type": "seal_tamper",
      "description": "Seal gap visible with lifted flap",
      "severity": "HIGH",
      "confidence": 0.84,
      "explainability": ["gap at seam", "edge discontinuity"],
      "suggested_action": "Immediate quarantine",
      "tis_delta": -40
    }
  ],
  "aggregate_tis": 60,
  "overall_assessment": "HIGH_RISK",
  "confidence_overall": 0.84,
  "notes": "High risk detected - immediate quarantine required",
  "baseline_image_info": {
    "resolution": [1920, 1080],
    "exif_present": true,
    "camera_make": "Apple",
    "camera_model": "iPhone 14",
    "datetime": "2024-01-15T10:30:00"
  },
  "current_image_info": {
    "resolution": [1920, 1080],
    "exif_present": true,
    "camera_make": "Apple",
    "camera_model": "iPhone 14",
    "datetime": "2024-01-15T10:35:00"
  },
  "analysis_metadata": {
    "total_differences": 1,
    "high_severity_count": 1,
    "medium_severity_count": 0,
    "low_severity_count": 0,
    "analysis_timestamp": "2024-01-15T10:35:42.123456"
  }
}
```

### Response Format (Dual-Angle)

```json
{
  "differences": [
    {
      "id": "a1-d1",
      "region": "left side",
      "bbox": [0.06, 0.42, 0.18, 0.12],
      "type": "dent",
      "description": "Concave deformation on left side",
      "severity": "MEDIUM",
      "confidence": 0.78,
      "explainability": ["shading collapse", "curvature change"],
      "suggested_action": "Supervisor review",
      "tis_delta": -15,
      "view": "angle_1"
    },
    {
      "id": "a2-d1",
      "region": "right side",
      "bbox": [0.75, 0.35, 0.15, 0.25],
      "type": "scratch",
      "description": "Linear scratch mark on right side",
      "severity": "LOW",
      "confidence": 0.72,
      "explainability": ["linear mark", "surface abrasion"],
      "suggested_action": "Proceed",
      "tis_delta": -8,
      "view": "angle_2"
    }
  ],
  "aggregate_tis": 77,
  "overall_assessment": "MODERATE_RISK",
  "confidence_overall": 0.75,
  "notes": "Moderate risk detected - supervisor review recommended",
  "baseline_image_info": {
    "angles": [
      { "resolution": [1920, 1080], "exif_present": true, ... },
      { "resolution": [1920, 1080], "exif_present": true, ... }
    ]
  },
  "current_image_info": {
    "angles": [
      { "resolution": [1920, 1080], "exif_present": true, ... },
      { "resolution": [1920, 1080], "exif_present": true, ... }
    ]
  },
  "angle_results": [
    {
      "view": "angle_1",
      "aggregate_tis": 85,
      "overall_assessment": "SAFE",
      "confidence_overall": 0.80,
      "notes": "Product integrity maintained - safe to proceed",
      "differences": [...],
      "analysis_metadata": {...}
    },
    {
      "view": "angle_2",
      "aggregate_tis": 69,
      "overall_assessment": "MODERATE_RISK",
      "confidence_overall": 0.70,
      "notes": "Moderate risk detected - supervisor review recommended",
      "differences": [...],
      "analysis_metadata": {...}
    }
  ],
  "analysis_metadata": {
    "total_differences": 2,
    "high_severity_count": 0,
    "medium_severity_count": 1,
    "low_severity_count": 1,
    "analysis_timestamp": "2024-01-15T10:35:42.123456",
    "angle_1_tis": 85,
    "angle_2_tis": 69,
    "angle_tis_min": 69,
    "angle_tis_max": 85
  }
}
```

### Error Response

```json
{
  "error": "Missing baseline/current image inputs",
  "differences": [],
  "aggregate_tis": 100,
  "overall_assessment": "UNKNOWN"
}
```

## HTTP Status Codes

- `200 OK` — Analysis successful
- `400 Bad Request` — Missing/invalid inputs (no images, invalid JSON)
- `500 Internal Server Error` — API key missing, Gemini failure, unexpected error

## Image Input Handling

### Base64 Encoding

```python
import base64

# Encode image to base64
with open("image.jpg", "rb") as f:
    b64 = base64.b64encode(f.read()).decode()

# Send in request
payload = {
    "baseline_b64": b64,
    "current_b64": b64
}
```

### Data URI Format

```python
# Data URI with MIME type
data_uri = f"data:image/jpeg;base64,{b64}"

payload = {
    "baseline_b64": data_uri,
    "current_b64": data_uri
}
```

### URL Format

```python
payload = {
    "baseline_url": "https://example.com/images/baseline.jpg",
    "current_url": "https://example.com/images/current.jpg"
}
```

### Image Packing (Multiple Images)

Use `||` delimiter to pack multiple images:

```python
# Pack two baseline images
baseline_packed = f"{baseline_1_b64}||{baseline_2_b64}"

payload = {
    "baseline_b64": baseline_packed,
    "current_b64": current_packed
}
```

## Common Integration Patterns

### Pattern 1: Simple Comparison

```python
import requests
import base64

def analyze_package(baseline_path, current_path):
    # Load images
    with open(baseline_path, "rb") as f:
        baseline_b64 = base64.b64encode(f.read()).decode()
    with open(current_path, "rb") as f:
        current_b64 = base64.b64encode(f.read()).decode()
    
    # Send request
    response = requests.post(
        "http://localhost:5000/analyze",
        json={
            "baseline_b64": baseline_b64,
            "current_b64": current_b64
        }
    )
    
    return response.json()

# Usage
result = analyze_package("baseline.jpg", "current.jpg")
print(f"TIS: {result['aggregate_tis']}")
print(f"Assessment: {result['overall_assessment']}")
```

### Pattern 2: Multi-Angle Analysis

```python
def analyze_package_multi_angle(baseline_paths, current_paths):
    """Analyze package from multiple angles."""
    
    images = {}
    for i, (b_path, c_path) in enumerate(zip(baseline_paths, current_paths), 1):
        with open(b_path, "rb") as f:
            images[f"baseline_angle{i}"] = base64.b64encode(f.read()).decode()
        with open(c_path, "rb") as f:
            images[f"current_angle{i}"] = base64.b64encode(f.read()).decode()
    
    response = requests.post(
        "http://localhost:5000/analyze",
        json=images
    )
    
    return response.json()

# Usage
result = analyze_package_multi_angle(
    ["baseline_front.jpg", "baseline_back.jpg"],
    ["current_front.jpg", "current_back.jpg"]
)

# Access per-angle results
for angle_result in result["angle_results"]:
    print(f"{angle_result['view']}: TIS={angle_result['aggregate_tis']}")
```

### Pattern 3: Batch Processing

```python
def batch_analyze(package_list):
    """Analyze multiple packages."""
    
    results = []
    for package_id, baseline_path, current_path in package_list:
        try:
            result = analyze_package(baseline_path, current_path)
            result["package_id"] = package_id
            results.append(result)
        except Exception as e:
            print(f"Error analyzing {package_id}: {e}")
    
    return results

# Usage
packages = [
    ("PKG001", "pkg1_baseline.jpg", "pkg1_current.jpg"),
    ("PKG002", "pkg2_baseline.jpg", "pkg2_current.jpg"),
]

results = batch_analyze(packages)

# Filter high-risk packages
high_risk = [r for r in results if r["overall_assessment"] == "HIGH_RISK"]
print(f"High-risk packages: {len(high_risk)}")
```

### Pattern 4: Remote Image Analysis

```python
def analyze_remote_images(baseline_url, current_url):
    """Analyze images from remote URLs."""
    
    response = requests.post(
        "http://localhost:5000/analyze",
        json={
            "baseline_url": baseline_url,
            "current_url": current_url
        }
    )
    
    return response.json()

# Usage
result = analyze_remote_images(
    "https://cdn.example.com/baseline.jpg",
    "https://cdn.example.com/current.jpg"
)
```

### Pattern 5: Error Handling

```python
def safe_analyze(baseline_b64, current_b64):
    """Analyze with comprehensive error handling."""
    
    try:
        response = requests.post(
            "http://localhost:5000/analyze",
            json={
                "baseline_b64": baseline_b64,
                "current_b64": current_b64
            },
            timeout=30
        )
        
        if response.status_code == 200:
            return response.json()
        elif response.status_code == 400:
            print(f"Bad request: {response.json()['error']}")
            return None
        elif response.status_code == 500:
            print(f"Server error: {response.json()['error']}")
            return None
        else:
            print(f"Unexpected status: {response.status_code}")
            return None
            
    except requests.Timeout:
        print("Request timeout (30s)")
        return None
    except requests.ConnectionError:
        print("Connection error")
        return None
    except Exception as e:
        print(f"Unexpected error: {e}")
        return None
```

## Response Interpretation

### TIS Score Interpretation

- **80-100**: SAFE — Product integrity maintained
- **40-79**: MODERATE_RISK — Supervisor review recommended
- **0-39**: HIGH_RISK — Immediate quarantine required

### Severity Levels

- **HIGH**: Critical security issues (seal tampering, digital edits, repackaging)
- **MEDIUM**: Significant damage (dents, color shifts)
- **LOW**: Minor issues (scratches, stains)

### Suggested Actions

- **Immediate quarantine**: For HIGH severity or HIGH_RISK assessment
- **Supervisor review**: For MEDIUM severity or MODERATE_RISK assessment
- **Proceed**: For LOW severity or SAFE assessment

## Performance Optimization

### Image Size Optimization

```python
from PIL import Image
import io

def optimize_image(image_path, max_size=2048):
    """Resize image for faster processing."""
    
    img = Image.open(image_path)
    
    # Resize if too large
    if img.width > max_size or img.height > max_size:
        img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
    
    # Convert to JPEG for compression
    buffer = io.BytesIO()
    img.save(buffer, format="JPEG", quality=85)
    
    return base64.b64encode(buffer.getvalue()).decode()
```

### Parallel Analysis

```python
from concurrent.futures import ThreadPoolExecutor

def parallel_batch_analyze(package_list, max_workers=4):
    """Analyze multiple packages in parallel."""
    
    results = []
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {
            executor.submit(analyze_package, b_path, c_path): pkg_id
            for pkg_id, b_path, c_path in package_list
        }
        
        for future in futures:
            try:
                result = future.result()
                result["package_id"] = futures[future]
                results.append(result)
            except Exception as e:
                print(f"Error: {e}")
    
    return results
```

## Monitoring & Logging

### Log Analysis Results

```python
import json
from datetime import datetime

def log_analysis(result, package_id):
    """Log analysis result for monitoring."""
    
    log_entry = {
        "timestamp": datetime.now().isoformat(),
        "package_id": package_id,
        "tis": result["aggregate_tis"],
        "assessment": result["overall_assessment"],
        "differences_count": result["analysis_metadata"]["total_differences"],
        "high_severity_count": result["analysis_metadata"]["high_severity_count"]
    }
    
    print(json.dumps(log_entry))
```

### Track Metrics

```python
def track_metrics(results):
    """Calculate metrics from batch results."""
    
    total = len(results)
    safe = len([r for r in results if r["overall_assessment"] == "SAFE"])
    moderate = len([r for r in results if r["overall_assessment"] == "MODERATE_RISK"])
    high_risk = len([r for r in results if r["overall_assessment"] == "HIGH_RISK"])
    
    print(f"Total: {total}")
    print(f"Safe: {safe} ({100*safe/total:.1f}%)")
    print(f"Moderate Risk: {moderate} ({100*moderate/total:.1f}%)")
    print(f"High Risk: {high_risk} ({100*high_risk/total:.1f}%)")
```
