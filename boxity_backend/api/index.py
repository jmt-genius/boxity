# api/index.py (improved logging & runtime checks)
import os
import sys
import traceback
import json
import io
import base64
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
from flask import Flask, request, jsonify

# CORS
try:
    from flask_cors import CORS
except Exception:
    CORS = None

# Pillow
try:
    from PIL import Image, ExifTags
except Exception:
    Image = None
    ExifTags = None

# requests
try:
    import requests
except Exception:
    requests = None

# google generative ai library
try:
    import google.generativeai as genai
except Exception:
    genai = None

# modular helpers (ai / vision)
try:
    from .ai import call_gemini_ensemble
except Exception as e:
    call_gemini_ensemble = None
    print("AI helper import failed:", e, file=sys.stderr)

try:
    from .vision import align_and_normalize
except Exception as e:
    align_and_normalize = None
    print("Vision helper import failed:", e, file=sys.stderr)

# opencv / numpy may be heavy -> check
try:
    import cv2  # type: ignore
except Exception as e:
    cv2 = None
    print("cv2 import failed:", str(e), file=sys.stderr)

try:
    import numpy as np  # type: ignore
except Exception as e:
    np = None
    print("numpy import failed:", str(e), file=sys.stderr)

app = Flask(__name__)
if CORS is not None:
    CORS(app, resources={r"/analyze": {"origins": "*"}})

IMAGE_PACK_DELIMITER = "||"

def _configure_genai():
    api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("No GOOGLE_API_KEY/GEMINI_API_KEY set in environment", file=sys.stderr)
        return False
    if genai is None:
        print("google.generativeai not installed or failed to import", file=sys.stderr)
        return False
    try:
        genai.configure(api_key=api_key)
        return True
    except Exception as e:
        print("genai.configure error:", str(e), file=sys.stderr)
        return False

@app.route('/')
def home():
    return 'Hello, World!'

@app.route('/about')
def about():
    return 'About'

def _load_image_bytes(source: str) -> Tuple[Optional[bytes], Optional[str]]:
    """Loads image bytes and MIME type from a URL or base64 data URI.

    Returns: (bytes|None, mime_type|None)
    """
    if not source:
        return None, None
    # Base64 data URI
    if source.startswith('data:'):
        try:
            header, b64 = source.split(',', 1)
            mime = header.split(';', 1)[0].replace('data:', '') or 'application/octet-stream'
            return base64.b64decode(b64), mime
        except Exception:
            return None, None
    # Heuristic: very long string without data: header is likely base64 (assume jpeg)
    if len(source) > 256 and not source.startswith('http'):
        try:
            return base64.b64decode(source), 'image/jpeg'
        except Exception:
            return None, None
    # Otherwise, treat as URL
    if requests is None:
        return None, None
    try:
        resp = requests.get(source, timeout=20)
        if resp.status_code == 200:
            mime = resp.headers.get('Content-Type', '').split(';')[0] or None
            return resp.content, mime
    except Exception:
        return None, None
    return None, None

def _get_image_info(img_bytes: Optional[bytes]) -> Dict[str, Any]:
    info: Dict[str, Any] = {"resolution": None, "exif_present": False, "camera_make": None, "camera_model": None, "datetime": None}
    if Image is None or not img_bytes:
        return info
    try:
        with Image.open(io.BytesIO(img_bytes)) as im:
            info["resolution"] = [im.width, im.height]
            exif = getattr(im, "_getexif", lambda: None)()
            if exif:
                info["exif_present"] = True
                inv = {v: k for k, v in ExifTags.TAGS.items()} if ExifTags else {}
                def get_tag(tag_name: str) -> Optional[str]:
                    key = inv.get(tag_name)
                    return str(exif.get(key)) if key in exif else None
                info["camera_make"] = get_tag("Make")
                info["camera_model"] = get_tag("Model")
                info["datetime"] = get_tag("DateTimeOriginal") or get_tag("DateTime")
    except Exception:
        pass
    return info

def _normalize_diff_item(item: Dict[str, Any]) -> Dict[str, Any]:
    # Ensure strict schema fields exist with fallbacks
    return {
        "id": str(item.get("id")) if item.get("id") is not None else "diff-unknown",
        "region": item.get("region") or "unknown",
        "bbox": item.get("bbox"),
        "type": item.get("type") or "other",
        "description": item.get("description") or "",
        "severity": item.get("severity") or "LOW",
        "confidence": float(item.get("confidence") or 0.5),
        "explainability": item.get("explainability") or [],
        "suggested_action": item.get("suggested_action") or "Review",
        "tis_delta": int(item.get("tis_delta") or 0),
    }

def _split_packed(source: Any) -> List[str]:
    if source is None:
        return []
    if isinstance(source, list):
        out: List[str] = []
        for s in source:
            if s is None:
                continue
            v = str(s).strip()
            if v:
                out.append(v)
        return out
    raw = str(source).strip()
    if not raw:
        return []
    if IMAGE_PACK_DELIMITER in raw:
        return [s.strip() for s in raw.split(IMAGE_PACK_DELIMITER) if str(s).strip()]
    return [raw]

def _clamp(value: int, lo: int, hi: int) -> int:
    return max(lo, min(hi, value))

def _compute_overall(differences: List[Dict[str, Any]]) -> Tuple[int, str, float, str]:
    """Enhanced TIS calculation with proper difference weighting.
    
    Returns: (tis_score, assessment, confidence, notes)
    """
    if not differences:
        return 100, "SAFE", 0.95, "No differences detected - product integrity maintained"
    
    # Start with perfect score
    tis = 100
    total_confidence = 0.0
    severity_weights = {"HIGH": 1.0, "MEDIUM": 0.6, "LOW": 0.3}
    critical_issues = []
    high_severity_count = 0
    medium_severity_count = 0
    
    for d in differences:
        try:
            # Apply TIS delta - this should reduce the score
            tis_delta = int(d.get("tis_delta", 0))
            tis += tis_delta  # tis_delta is negative, so this reduces the score
            
            # Weight confidence by severity
            severity = str(d.get("severity", "LOW")).upper()
            weight = severity_weights.get(severity, 0.3)
            confidence = float(d.get("confidence", 0.5))
            total_confidence += confidence * weight
            
            # Count severities
            if severity == "HIGH":
                high_severity_count += 1
            elif severity == "MEDIUM":
                medium_severity_count += 1
            
            # Track critical issues
            if severity == "HIGH" and confidence > 0.6:
                issue_type = str(d.get("type", "unknown"))
                if issue_type in ["seal_tamper", "repackaging", "digital_edit"]:
                    critical_issues.append(issue_type)
                    
        except Exception:
            continue
    
    # Calculate weighted confidence
    avg_confidence = total_confidence / max(1, len(differences)) if differences else 0.0
    
    # Clamp TIS score to ensure it's never above 100
    tis = _clamp(tis, 0, 100)
    
    # Enhanced assessment logic based on actual TIS score
    if tis >= 80:
        assessment = "SAFE"
        notes = "Product integrity maintained - safe to proceed"
    elif tis >= 40:
        assessment = "MODERATE_RISK"
        notes = "Moderate risk detected - supervisor review recommended"
    else:
        assessment = "HIGH_RISK"
        notes = "High risk detected - immediate quarantine required"
    
    # Additional overrides for critical security issues
    if critical_issues:
        if "seal_tamper" in critical_issues:
            tis = min(tis, 20)  # Force very high risk for seal tampering
            assessment = "HIGH_RISK"
            notes = f"Critical security breach detected: {', '.join(critical_issues)} - immediate quarantine required"
        elif "repackaging" in critical_issues:
            tis = min(tis, 15)  # Force highest risk for repackaging
            assessment = "HIGH_RISK"
            notes = f"Product substitution detected: {', '.join(critical_issues)} - immediate quarantine required"
        elif "digital_edit" in critical_issues:
            tis = min(tis, 10)  # Force highest risk for digital tampering
            assessment = "HIGH_RISK"
            notes = "Digital tampering detected - highest security risk"
    
    # Additional logic for multiple high-severity issues
    if high_severity_count >= 2:
        tis = min(tis, 30)
        assessment = "HIGH_RISK"
        notes = f"Multiple high-severity issues detected ({high_severity_count} issues) - immediate quarantine required"
    elif high_severity_count >= 1 and medium_severity_count >= 2:
        tis = min(tis, 35)
        assessment = "HIGH_RISK"
        notes = f"Multiple damage issues detected - immediate quarantine required"
    
    return tis, assessment, avg_confidence, notes

def _call_gemini(baseline: Tuple[Optional[bytes], Optional[str]], current: Tuple[Optional[bytes], Optional[str]], view_label: Optional[str] = None) -> List[Dict[str, Any]]:
    if call_gemini_ensemble is None:
        return []
    try:
        items = call_gemini_ensemble(baseline, current, view_label=view_label)
        return [_normalize_diff_item(it) for it in items if isinstance(it, dict)]
    except Exception:
        return []

def _assess_from_tis(tis: int) -> Tuple[str, str]:
    if tis >= 80:
        return "SAFE", "Product integrity maintained - safe to proceed"
    if tis >= 40:
        return "MODERATE_RISK", "Moderate risk detected - supervisor review recommended"
    return "HIGH_RISK", "High risk detected - immediate quarantine required"

def _analyze_pair(baseline_src: str, current_src: str, view_label: str) -> Dict[str, Any]:
    baseline_bytes, baseline_mime = _load_image_bytes(baseline_src)
    current_bytes, current_mime = _load_image_bytes(current_src)

    if not baseline_bytes:
        raise ValueError(f"Failed to load baseline image for {view_label}")
    if not current_bytes:
        raise ValueError(f"Failed to load current image for {view_label}")

    baseline_info = _get_image_info(baseline_bytes)
    current_info = _get_image_info(current_bytes)

    differences = _call_gemini((baseline_bytes, baseline_mime), (current_bytes, current_mime), view_label=view_label)
    for d in differences:
        d["view"] = view_label

    if (not differences or sum(d.get("confidence", 0) for d in differences) / max(1, len(differences)) < 0.6) and baseline_bytes and current_bytes:
        cv_regions = []
        try:
            if align_and_normalize is not None and cv2 is not None:
                ab, ac = align_and_normalize(baseline_bytes, current_bytes)
                if ab is not None and ac is not None:
                    cv_regions = _classical_diff_regions(cv2.imencode('.jpg', ab)[1].tobytes(), cv2.imencode('.jpg', ac)[1].tobytes())
            if not cv_regions:
                cv_regions = _classical_diff_regions(baseline_bytes, current_bytes)
        except Exception as e:
            print("classical diff error:", str(e), file=sys.stderr)
            cv_regions = _classical_diff_regions(baseline_bytes, current_bytes)

        if cv_regions:
            for r in cv_regions:
                r["view"] = view_label
            if differences:
                seen = {d.get("id") for d in differences}
                for r in cv_regions:
                    if r.get("id") not in seen:
                        differences.append(r)
            else:
                differences = cv_regions

    tis, assessment, conf_overall, notes = _compute_overall(differences)

    return {
        "view": view_label,
        "differences": differences,
        "baseline_image_info": baseline_info,
        "current_image_info": current_info,
        "aggregate_tis": tis,
        "overall_assessment": assessment,
        "confidence_overall": conf_overall,
        "notes": notes,
        "analysis_metadata": {
            "total_differences": len(differences),
            "high_severity_count": len([d for d in differences if str(d.get("severity", "")).upper() == "HIGH"]),
            "medium_severity_count": len([d for d in differences if str(d.get("severity", "")).upper() == "MEDIUM"]),
            "low_severity_count": len([d for d in differences if str(d.get("severity", "")).upper() == "LOW"]),
            "analysis_timestamp": str(datetime.now().isoformat()) if 'datetime' in globals() else "unknown",
        },
    }

@app.route("/analyze", methods=["POST"])
def analyze():
    try:
        # quick runtime sanity
        if not _configure_genai():
            # If you do not want to require gemini for fallback, change logic here.
            # For debugging, return an explicit error.
            return jsonify({
                "error": "GOOGLE_API_KEY / GEMINI_API_KEY not configured or google.generativeai import failed.",
                "differences": [],
                "aggregate_tis": 100,
                "overall_assessment": "UNKNOWN"
            }), 500

        data = request.get_json(silent=True) or {}

        baseline_angle1 = data.get("baseline_angle1") or data.get("baseline_1")
        baseline_angle2 = data.get("baseline_angle2") or data.get("baseline_2")
        current_angle1 = data.get("current_angle1") or data.get("current_1")
        current_angle2 = data.get("current_angle2") or data.get("current_2")

        if baseline_angle1 or baseline_angle2 or current_angle1 or current_angle2:
            baseline_sources = [s for s in [baseline_angle1, baseline_angle2] if s]
            current_sources = [s for s in [current_angle1, current_angle2] if s]
        else:
            baseline_src = data.get("baseline_url") or data.get("baseline_b64") or data.get("baseline")
            current_src = data.get("current_url") or data.get("current_b64") or data.get("current")
            baseline_sources = _split_packed(baseline_src)
            current_sources = _split_packed(current_src)

        if len(baseline_sources) == 0 or len(current_sources) == 0:
            return jsonify({
                "error": "Missing baseline/current image inputs",
                "differences": [],
                "aggregate_tis": 100,
                "overall_assessment": "UNKNOWN",
            }), 400

        # Backwards compatible: single baseline + single current
        if len(baseline_sources) == 1 and len(current_sources) == 1:
            result = _analyze_pair(str(baseline_sources[0]), str(current_sources[0]), view_label="single")
            response = {
                "differences": result["differences"],
                "baseline_image_info": result["baseline_image_info"],
                "current_image_info": result["current_image_info"],
                "aggregate_tis": result["aggregate_tis"],
                "overall_assessment": result["overall_assessment"],
                "confidence_overall": result["confidence_overall"],
                "notes": result["notes"],
                "analysis_metadata": result["analysis_metadata"],
            }
            return jsonify(response)

        # Two-angle mode: require exactly 2 baseline and 2 current
        if not (len(baseline_sources) == 2 and len(current_sources) == 2):
            return jsonify({
                "error": "Two-angle analysis requires exactly 2 baseline and 2 current images",
                "differences": [],
                "aggregate_tis": 100,
                "overall_assessment": "UNKNOWN",
            }), 400

        r1 = _analyze_pair(str(baseline_sources[0]), str(current_sources[0]), view_label="angle_1")
        r2 = _analyze_pair(str(baseline_sources[1]), str(current_sources[1]), view_label="angle_2")

        # Prefix IDs so merged list doesn't collide
        diffs: List[Dict[str, Any]] = []
        for d in r1["differences"]:
            d2 = dict(d)
            d2["id"] = f"a1-{d2.get('id', 'diff')}"
            diffs.append(d2)
        for d in r2["differences"]:
            d2 = dict(d)
            d2["id"] = f"a2-{d2.get('id', 'diff')}"
            diffs.append(d2)

        tis1 = int(r1["aggregate_tis"])
        tis2 = int(r2["aggregate_tis"])
        tis_avg = int(round((tis1 + tis2) / 2.0))
        conf_avg = float(r1.get("confidence_overall", 0.0) + r2.get("confidence_overall", 0.0)) / 2.0

        # Security posture: keep aggregate score as average, but assessment/notes based on the worst view
        tis_worst = min(tis1, tis2)
        assessment, notes = _assess_from_tis(tis_worst)

        response = {
            "differences": diffs,
            "baseline_image_info": {"angles": [r1["baseline_image_info"], r2["baseline_image_info"]]},
            "current_image_info": {"angles": [r1["current_image_info"], r2["current_image_info"]]},
            "aggregate_tis": tis_avg,
            "overall_assessment": assessment,
            "confidence_overall": conf_avg,
            "notes": notes,
            "angle_results": [
                {
                    "view": "angle_1",
                    "aggregate_tis": r1["aggregate_tis"],
                    "overall_assessment": r1["overall_assessment"],
                    "confidence_overall": r1["confidence_overall"],
                    "notes": r1["notes"],
                    "differences": r1["differences"],
                    "analysis_metadata": r1["analysis_metadata"],
                },
                {
                    "view": "angle_2",
                    "aggregate_tis": r2["aggregate_tis"],
                    "overall_assessment": r2["overall_assessment"],
                    "confidence_overall": r2["confidence_overall"],
                    "notes": r2["notes"],
                    "differences": r2["differences"],
                    "analysis_metadata": r2["analysis_metadata"],
                },
            ],
            "analysis_metadata": {
                "total_differences": len(diffs),
                "high_severity_count": len([d for d in diffs if str(d.get("severity", "")).upper() == "HIGH"]),
                "medium_severity_count": len([d for d in diffs if str(d.get("severity", "")).upper() == "MEDIUM"]),
                "low_severity_count": len([d for d in diffs if str(d.get("severity", "")).upper() == "LOW"]),
                "analysis_timestamp": str(datetime.now().isoformat()) if 'datetime' in globals() else "unknown",
                "angle_1_tis": tis1,
                "angle_2_tis": tis2,
                "angle_tis_min": tis_worst,
                "angle_tis_max": max(tis1, tis2),
            },
        }

        return jsonify(response)
    except ValueError as ve:
        return jsonify({
            "error": str(ve),
            "differences": [],
            "aggregate_tis": 100,
            "overall_assessment": "UNKNOWN",
        }), 400
    except Exception as e:
        tb = traceback.format_exc()
        print("Exception in /analyze:", tb, file=sys.stderr)
        # return error info (status 500) so client sees problem
        return jsonify({
            "error": "Analyzer internal error",
            "details": str(e),
            "traceback": tb,
            "differences": [],
            "aggregate_tis": 100,
            "overall_assessment": "UNKNOWN"
        }), 500