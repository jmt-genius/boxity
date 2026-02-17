# api/index.py — OpenCV preprocessing + Gemini analysis (one angle per call)
import logging
import os
import sys
import traceback
import json
import io
import base64
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
from flask import Flask, request, jsonify

# Auth
try:
    from .auth import optional_auth, require_auth
    AUTH_AVAILABLE = True
except Exception as e:
    AUTH_AVAILABLE = False
    optional_auth = lambda f: f
    require_auth = lambda f: f
    print("Auth module import failed:", e, file=sys.stderr)

# CORS
try:
    from flask_cors import CORS
except Exception:
    CORS = None

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

# Gemini AI helper
try:
    from .ai import call_gemini_ensemble
except Exception as e:
    call_gemini_ensemble = None
    print("AI helper import failed:", e, file=sys.stderr)

# OpenCV vision helper (preprocessing / alignment)
try:
    from .vision import align_and_normalize
except Exception as e:
    align_and_normalize = None
    print("Vision helper import failed:", e, file=sys.stderr)

# OpenCV + numpy (for encoding preprocessed images)
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

# Set up logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)
if CORS is not None:
    CORS(app, resources={r"/analyze": {"origins": "*"}})

SCORING_VERSION = "cv-gemini-v1"
logger.info("=== api/index.py loaded === SCORING_VERSION=%s, cv2=%s, genai=%s, vision=%s",
            SCORING_VERSION, cv2 is not None, genai is not None, align_and_normalize is not None)

@app.after_request
def _add_cors_headers(response):
    origin = request.headers.get("Origin")
    if origin:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Vary"] = "Origin"
    else:
        response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type,Authorization"
    response.headers["Access-Control-Max-Age"] = "600"
    return response

IMAGE_PACK_DELIMITER = "||"

# ── helpers ──────────────────────────────────────────────

def _configure_genai():
    api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
    if not api_key:
        logger.error("No GOOGLE_API_KEY/GEMINI_API_KEY set in environment")
        return False
    if genai is None:
        logger.error("google.generativeai not installed or failed to import")
        return False
    # Strip quotes in case .env wraps the value
    api_key = api_key.strip().strip('"').strip("'")
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
    """Load image bytes and MIME type from a URL or base64 data URI."""
    if not source:
        return None, None
    if source.startswith('data:'):
        try:
            header, b64 = source.split(',', 1)
            mime = header.split(';', 1)[0].replace('data:', '') or 'application/octet-stream'
            return base64.b64decode(b64), mime
        except Exception:
            return None, None
    if len(source) > 256 and not source.startswith('http'):
        try:
            return base64.b64decode(source), 'image/jpeg'
        except Exception:
            return None, None
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


def _normalize_diff_item(item: Dict[str, Any]) -> Dict[str, Any]:
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


def _clamp(value: int, lo: int, hi: int) -> int:
    return max(lo, min(hi, value))


def _compute_overall(differences: List[Dict[str, Any]]) -> Tuple[int, str, float, str]:
    """Compute TIS score, assessment, confidence and notes from Gemini differences."""
    if not differences:
        return 100, "SAFE", 0.95, "No differences detected - product integrity maintained"

    tis = 100
    total_confidence = 0.0
    severity_weights = {"HIGH": 1.0, "MEDIUM": 0.6, "LOW": 0.3}
    critical_issues = []
    high_severity_count = 0
    medium_severity_count = 0

    for d in differences:
        try:
            tis += int(d.get("tis_delta", 0))
            severity = str(d.get("severity", "LOW")).upper()
            weight = severity_weights.get(severity, 0.3)
            confidence = float(d.get("confidence", 0.5))
            total_confidence += confidence * weight
            if severity == "HIGH":
                high_severity_count += 1
            elif severity == "MEDIUM":
                medium_severity_count += 1
            if severity == "HIGH" and confidence > 0.6:
                issue_type = str(d.get("type", "unknown"))
                if issue_type in ["seal_tamper", "repackaging", "digital_edit"]:
                    critical_issues.append(issue_type)
        except Exception:
            continue

    avg_confidence = total_confidence / max(1, len(differences))
    tis = _clamp(tis, 0, 100)
    if differences and tis == 0:
        tis = 1

    if tis >= 80:
        assessment, notes = "SAFE", "Product integrity maintained - safe to proceed"
    elif tis >= 40:
        assessment, notes = "MODERATE_RISK", "Moderate risk detected - supervisor review recommended"
    else:
        assessment, notes = "HIGH_RISK", "High risk detected - immediate quarantine required"

    if critical_issues:
        if "seal_tamper" in critical_issues:
            tis = min(tis, 20); assessment = "HIGH_RISK"
            notes = f"Critical security breach: {', '.join(critical_issues)} - quarantine"
        elif "repackaging" in critical_issues:
            tis = min(tis, 15); assessment = "HIGH_RISK"
            notes = f"Product substitution: {', '.join(critical_issues)} - quarantine"
        elif "digital_edit" in critical_issues:
            tis = min(tis, 10); assessment = "HIGH_RISK"
            notes = "Digital tampering detected - highest security risk"

    if high_severity_count >= 2:
        tis = min(tis, 30); assessment = "HIGH_RISK"
        notes = f"Multiple high-severity issues ({high_severity_count}) - quarantine"
    elif high_severity_count >= 1 and medium_severity_count >= 2:
        tis = min(tis, 35); assessment = "HIGH_RISK"
        notes = "Multiple damage issues detected - quarantine"

    return tis, assessment, avg_confidence, notes


def _call_gemini(
    baseline: Tuple[Optional[bytes], Optional[str]],
    current: Tuple[Optional[bytes], Optional[str]],
    view_label: Optional[str] = None,
) -> List[Dict[str, Any]]:
    if call_gemini_ensemble is None:
        print("Gemini module not loaded", file=sys.stderr)
        return []
    try:
        items = call_gemini_ensemble(baseline, current, view_label=view_label)
        return [_normalize_diff_item(it) for it in items if isinstance(it, dict)]
    except Exception as e:
        print(f"Gemini call failed for {view_label}: {e}", file=sys.stderr)
        return []


def _preprocess_with_cv(baseline_bytes: bytes, current_bytes: bytes) -> Tuple[bytes, bytes]:
    """Use OpenCV to align and normalize images before sending to Gemini.
    
    Returns the preprocessed image bytes (JPEG encoded).
    Falls back to originals if OpenCV is unavailable or fails.
    """
    logger.info("[PREPROCESS] Starting OpenCV preprocessing. cv2=%s, np=%s, align_fn=%s",
                cv2 is not None, np is not None, align_and_normalize is not None)
    if cv2 is None or np is None or align_and_normalize is None:
        logger.warning("[PREPROCESS] OpenCV preprocessing unavailable, using raw images")
        return baseline_bytes, current_bytes

    try:
        logger.info("[PREPROCESS] Calling align_and_normalize with %d / %d bytes",
                    len(baseline_bytes), len(current_bytes))
        b_norm, c_norm = align_and_normalize(baseline_bytes, current_bytes)
        if b_norm is not None and c_norm is not None:
            _, b_enc = cv2.imencode('.jpg', b_norm, [cv2.IMWRITE_JPEG_QUALITY, 95])
            _, c_enc = cv2.imencode('.jpg', c_norm, [cv2.IMWRITE_JPEG_QUALITY, 95])
            logger.info("[PREPROCESS] OpenCV preprocessing SUCCESSFUL. Output sizes: %d / %d bytes",
                        len(b_enc.tobytes()), len(c_enc.tobytes()))
            return b_enc.tobytes(), c_enc.tobytes()
        else:
            logger.warning("[PREPROCESS] align_and_normalize returned None, using raw images")
            return baseline_bytes, current_bytes
    except Exception as e:
        logger.error("[PREPROCESS] OpenCV preprocessing FAILED: %s, using raw images", e)
        return baseline_bytes, current_bytes


# ── core analysis ────────────────────────────────────────

def _analyze_pair(baseline_src: str, current_src: str, view_label: str) -> Dict[str, Any]:
    """Analyze ONE angle: OpenCV preprocess → Gemini analysis → TIS scoring."""
    logger.info("======== _analyze_pair START [%s] ========", view_label)
    logger.info("[LOAD] Loading baseline image (first 80 chars): %s", baseline_src[:80] + "...")
    baseline_bytes, baseline_mime = _load_image_bytes(baseline_src)
    logger.info("[LOAD] Loading current image (first 80 chars): %s", current_src[:80] + "...")
    current_bytes, current_mime = _load_image_bytes(current_src)

    logger.info("[LOAD] baseline=%s bytes, mime=%s | current=%s bytes, mime=%s",
                len(baseline_bytes) if baseline_bytes else 0, baseline_mime,
                len(current_bytes) if current_bytes else 0, current_mime)

    if not baseline_bytes:
        raise ValueError(f"Failed to load baseline image for {view_label}")
    if not current_bytes:
        raise ValueError(f"Failed to load current image for {view_label}")

    cv_used = False

    # STEP 1: OpenCV preprocessing (alignment + normalization)
    logger.info("[STEP 1] Running OpenCV preprocessing...")
    prep_baseline, prep_current = _preprocess_with_cv(baseline_bytes, current_bytes)
    if prep_baseline is not baseline_bytes:
        cv_used = True
        baseline_mime = "image/jpeg"
        current_mime = "image/jpeg"
    logger.info("[STEP 1] cv_used=%s, prep_baseline=%d bytes, prep_current=%d bytes",
                cv_used, len(prep_baseline), len(prep_current))

    # STEP 2: Send preprocessed images to Gemini for analysis
    logger.info("[STEP 2] Calling Gemini with view_label=%s...", view_label)
    differences = _call_gemini(
        (prep_baseline, baseline_mime or "image/jpeg"),
        (prep_current, current_mime or "image/jpeg"),
        view_label=view_label,
    )

    logger.info("[STEP 2] Gemini returned %d differences", len(differences))
    for i, d in enumerate(differences):
        logger.info("  diff[%d]: type=%s severity=%s region=%s desc=%s",
                    i, d.get('type'), d.get('severity'), d.get('region'), (d.get('description', '')[:80]))

    for d in differences:
        d["view"] = view_label

    # STEP 3: Compute TIS score from Gemini findings
    tis, assessment, conf_overall, notes = _compute_overall(differences)
    logger.info("[STEP 3] TIS=%d assessment=%s confidence=%.2f notes=%s", tis, assessment, conf_overall, notes)
    logger.info("======== _analyze_pair END [%s] ========", view_label)

    return {
        "view": view_label,
        "differences": differences,
        "aggregate_tis": tis,
        "overall_assessment": assessment,
        "confidence_overall": conf_overall,
        "notes": notes,
        "can_upload": bool(tis >= 40),
        "analysis_metadata": {
            "total_differences": len(differences),
            "high_severity_count": len([d for d in differences if str(d.get("severity", "")).upper() == "HIGH"]),
            "medium_severity_count": len([d for d in differences if str(d.get("severity", "")).upper() == "MEDIUM"]),
            "low_severity_count": len([d for d in differences if str(d.get("severity", "")).upper() == "LOW"]),
            "analysis_timestamp": str(datetime.now().isoformat()),
            "scoring_version": SCORING_VERSION,
            "gemini_diff_count": len(differences),
            "cv_used": cv_used,
        },
    }


# ── route ────────────────────────────────────────────────

@app.route("/analyze", methods=["POST", "OPTIONS"])
def analyze():
    """
    Accepts ONE pair of images (1 baseline + 1 current) per call.
    The frontend calls this twice — once for Angle 1, once for Angle 2.
    
    Expected JSON body:
      { "baseline_b64": "...", "current_b64": "...", "view_label": "angle_1" }
    """
    try:
        logger.info("===== /analyze endpoint called, method=%s =====", request.method)
        if request.method == "OPTIONS":
            return ("", 204)

        if call_gemini_ensemble is None:
            logger.error("/analyze: Gemini module not available!")
            return jsonify({
                "error": "Gemini module not available.",
                "differences": [], "aggregate_tis": 100,
                "overall_assessment": "UNKNOWN",
            }), 500

        gemini_ready = _configure_genai()
        if not gemini_ready:
            return jsonify({
                "error": "Gemini API key missing or configuration failed.",
                "differences": [], "aggregate_tis": 100,
                "overall_assessment": "UNKNOWN",
            }), 500

        data = request.get_json(silent=True) or {}

        # Accept a single pair of images
        baseline_src = (
            data.get("baseline_b64")
            or data.get("baseline_url")
            or data.get("baseline")
            or data.get("baseline_angle1")
            or data.get("baseline_1")
        )
        current_src = (
            data.get("current_b64")
            or data.get("current_url")
            or data.get("current")
            or data.get("current_angle1")
            or data.get("current_1")
        )
        view_label = data.get("view_label", "single")

        if not baseline_src or not current_src:
            return jsonify({
                "error": "Missing baseline or current image",
                "differences": [], "aggregate_tis": 100,
                "overall_assessment": "UNKNOWN",
            }), 400

        result = _analyze_pair(str(baseline_src), str(current_src), view_label=str(view_label))

        response = {
            "differences": result["differences"],
            "aggregate_tis": result["aggregate_tis"],
            "overall_assessment": result["overall_assessment"],
            "confidence_overall": result["confidence_overall"],
            "notes": result["notes"],
            "can_upload": result["can_upload"],
            "analysis_metadata": {
                **result["analysis_metadata"],
                "gemini_ready": True,
                "cv_available": bool(cv2 is not None),
            },
        }
        return jsonify(response)

    except ValueError as ve:
        return jsonify({
            "error": str(ve),
            "differences": [], "aggregate_tis": 100,
            "overall_assessment": "UNKNOWN",
        }), 400
    except Exception as e:
        tb = traceback.format_exc()
        print("Exception in /analyze:", tb, file=sys.stderr)
        return jsonify({
            "error": "Analyzer internal error",
            "details": str(e),
            "traceback": tb,
            "differences": [], "aggregate_tis": 100,
            "overall_assessment": "UNKNOWN",
        }), 500
