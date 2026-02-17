import os
import json
import re
import logging
import traceback
from typing import Any, Dict, List, Optional, Tuple

from .schema import RESPONSE_SCHEMA

logger = logging.getLogger(__name__)

try:
    import google.generativeai as genai
    logger.info("[ai.py] google.generativeai imported OK")
except Exception as e:
    genai = None
    logger.error("[ai.py] google.generativeai import FAILED: %s", e)

try:
    from jsonschema import validate, ValidationError
    logger.info("[ai.py] jsonschema imported OK")
except Exception:
    validate = None
    ValidationError = Exception
    logger.warning("[ai.py] jsonschema not available — schema validation disabled")


def _configure_genai():
    api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
    logger.info("[ai.py] _configure_genai: api_key present=%s, genai loaded=%s",
                bool(api_key), genai is not None)
    if not api_key or genai is None:
        logger.error("[ai.py] _configure_genai FAILED: api_key=%s genai=%s", bool(api_key), genai is not None)
        return False
    # Strip quotes in case .env file wraps them
    api_key = api_key.strip().strip('"').strip("'")
    logger.info("[ai.py] Configuring genai with key starting: %s...", api_key[:10])
    genai.configure(api_key=api_key)
    return True


FEW_SHOT = (
    "Return STRICT JSON as {\"differences\":[...]}. Example:\n"
    "{\n  \"differences\": [\n    {\n      \"id\": \"d1\", \"region\": \"top edge\", \"bbox\": [0.12,0.03,0.76,0.08], \"type\": \"seal_tamper\",\n"
    "      \"description\": \"Seal gap visible with lifted flap indicating potential tampering.\", \"severity\": \"HIGH\", \"confidence\": 0.84,\n"
    "      \"explainability\": [\"gap at seam\", \"edge discontinuity\", \"lifted flap\"], \"suggested_action\": \"Immediate quarantine\", \"tis_delta\": -40\n"
    "    },\n    {\n      \"id\": \"d2\", \"region\": \"left side\", \"bbox\": [0.06,0.42,0.18,0.12], \"type\": \"dent\",\n"
    "      \"description\": \"Concave deformation on left side panel suggesting impact damage.\", \"severity\": \"MEDIUM\", \"confidence\": 0.78,\n"
    "      \"explainability\": [\"shading collapse\", \"curvature change\", \"impact pattern\"], \"suggested_action\": \"Supervisor review\", \"tis_delta\": -15\n"
    "    },\n    {\n      \"id\": \"d3\", \"region\": \"right side\", \"bbox\": [0.75,0.35,0.15,0.25], \"type\": \"scratch\",\n"
    "      \"description\": \"Linear scratch mark on right side panel.\", \"severity\": \"LOW\", \"confidence\": 0.72,\n"
    "      \"explainability\": [\"linear mark\", \"surface abrasion\", \"edge contrast\"], \"suggested_action\": \"Proceed\", \"tis_delta\": -8\n"
    "    },\n    {\n      \"id\": \"d4\", \"region\": \"front panel\", \"bbox\": [0.2,0.1,0.6,0.2], \"type\": \"label_mismatch\",\n"
    "      \"description\": \"Label appears altered or replaced with different product information.\", \"severity\": \"HIGH\", \"confidence\": 0.82,\n"
    "      \"explainability\": [\"text mismatch\", \"font difference\", \"color variation\"], \"suggested_action\": \"Quarantine batch\", \"tis_delta\": -40\n"
    "    },\n    {\n      \"id\": \"d5\", \"region\": \"top-left corner\", \"bbox\": [0.0,0.0,0.15,0.15], \"type\": \"dent\",\n"
    "      \"description\": \"Corner damage detected in top-left area.\", \"severity\": \"MEDIUM\", \"confidence\": 0.75,\n"
    "      \"explainability\": [\"corner deformation\", \"impact damage\", \"structural change\"], \"suggested_action\": \"Supervisor review\", \"tis_delta\": -15\n"
    "    }\n  ]\n}"
)




def _build_model(name: str):
    generation_config = {
        "temperature": 0.15,
        "top_k": 20,
        "top_p": 0.8,
        "response_mime_type": "application/json",
    }
    logger.info("[ai.py] Building model: %s", name)
    return genai.GenerativeModel(name, generation_config=generation_config)


def _extract_json(text: str) -> Dict[str, Any]:
    text = (text or "").strip()
    if not text:
        return {"differences": []}
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\n|\n```$", "", text)
    if not text.lstrip().startswith('{'):
        match = re.search(r"\{[\s\S]*\}", text)
        text = match.group(0) if match else '{"differences": []}'
    try:
        return json.loads(text)
    except Exception as e:
        logger.error("[ai.py] JSON parse failed: %s — raw text: %s", e, text[:200])
        return {"differences": []}


def _validate_or_repair(payload: Dict[str, Any], model) -> Dict[str, Any]:
    if validate is None:
        return payload
    try:
        validate(instance=payload, schema=RESPONSE_SCHEMA)
        return payload
    except ValidationError as ve:
        logger.warning("[ai.py] Schema validation failed: %s — attempting repair", ve.message[:100] if hasattr(ve, 'message') else str(ve)[:100])
        try:
            result = model.generate_content([
                "Repair this JSON to match the schema {differences:[...] with required fields}:",
                json.dumps(payload)
            ])
            repaired = _extract_json(result.text or "")
            validate(instance=repaired, schema=RESPONSE_SCHEMA)
            return repaired
        except Exception as e2:
            logger.error("[ai.py] Repair also failed: %s", e2)
            return {"differences": []}


def call_gemini_ensemble(
    baseline: Tuple[Optional[bytes], Optional[str]],
    current: Tuple[Optional[bytes], Optional[str]],
    view_label: Optional[str] = None,
) -> List[Dict[str, Any]]:
    logger.info("[ai.py] ====== call_gemini_ensemble START (view=%s) ======", view_label)

    if not _configure_genai():
        logger.error("[ai.py] _configure_genai returned False — aborting")
        return []

    baseline_bytes, baseline_mime = baseline
    current_bytes, current_mime = current

    logger.info("[ai.py] baseline: %d bytes, mime=%s | current: %d bytes, mime=%s",
                len(baseline_bytes) if baseline_bytes else 0, baseline_mime,
                len(current_bytes) if current_bytes else 0, current_mime)

    if not baseline_bytes or not current_bytes:
        logger.error("[ai.py] Missing image bytes — aborting")
        return []

    view_context = f"\nVIEW CONTEXT: {view_label}\n" if view_label else ""

    system = (
        "You are an expert multimodal forensic analyst specializing in package integrity and tampering detection.\n"
        "\nMISSION: Compare baseline vs current package photos to detect security breaches and integrity violations.\n"
        "\nDETECTION TARGETS:\n"
        "- seal_tamper: Broken, lifted, or altered seals (CRITICAL SECURITY RISK)\n"
        "- repackaging: Different packaging, missing elements, or structural changes\n"
        "- label_mismatch: Altered, replaced, or counterfeit labels\n"
        "- digital_edit: Photo manipulation, cloning, or artificial modifications\n"
        "- dent: Physical damage from impact or compression\n"
        "- scratch: Surface abrasions or cuts\n"
        "- stain: Discoloration or contamination\n"
        "- color_shift: Significant color changes indicating tampering\n"
        "- missing_item: Absent components or contents\n"
        "\nREGION SPECIFICATION:\n"
        "Be VERY specific about damage locations:\n"
        "- 'left side': Left edge/panel of the package\n"
        "- 'right side': Right edge/panel of the package\n"
        "- 'top edge': Upper portion/seal area\n"
        "- 'bottom edge': Lower portion/base\n"
        "- 'front panel': Main visible surface\n"
        "- 'back panel': Rear surface\n"
        "- 'corner': Specific corner (top-left, top-right, etc.)\n"
        "- 'center': Middle area of package\n"
        "\nANALYSIS RULES:\n"
        "1. Return STRICT JSON: {\"differences\":[...]} with NO additional text\n"
        "2. Focus on security-critical issues first (seal_tamper, repackaging, digital_edit)\n"
        "3. Provide precise bbox coordinates [x,y,w,h] in 0..1 range\n"
        "4. Use HIGH severity for security breaches, MEDIUM for damage, LOW for minor issues\n"
        "5. Confidence must reflect certainty: >0.8 for clear evidence, <0.6 for uncertain\n"
        "6. TIS delta: seal_tamper(-40), repackaging(-35), digital_edit(-50), labeling(-40), physical(-15)\n"
        "7. ALWAYS specify exact region - never use generic terms\n"
        + view_context
        + "\n" + FEW_SHOT
    )

    parts = [
        system,
        "\nCRITICAL: Focus on security threats. A single seal_tamper or digital_edit should trigger immediate quarantine.\n"
        "Be conservative with confidence scores.\n"
        "\nBaseline Image (Reference):", {"mime_type": baseline_mime or "image/jpeg", "data": baseline_bytes},
        "\nCurrent Image (Under Analysis):", {"mime_type": current_mime or "image/jpeg", "data": current_bytes},
    ]

    # Optimized for speed: Use gemini-2.0-flash
    model = _build_model("gemini-2.5-flash")

    max_retries = 3
    base_delay = 2

    import time
    from google.api_core import exceptions

    for attempt in range(max_retries + 1):
        try:
            logger.info("[ai.py] Sending request to Gemini (model=gemini-2.0-flash) [Attempt %d/%d]...", attempt + 1, max_retries + 1)
            response = model.generate_content(parts)
            raw_text = response.text or ""
            logger.info("[ai.py] Gemini raw response (first 500 chars): %s", raw_text[:500])

            payload = _extract_json(raw_text)
            logger.info("[ai.py] Extracted JSON payload: %d differences found", len(payload.get("differences", [])))

            validated = _validate_or_repair(payload, model)
            result = validated.get("differences", [])[:8]
            logger.info("[ai.py] Final validated result: %d differences", len(result))
            logger.info("[ai.py] ====== call_gemini_ensemble END (view=%s) ======", view_label)

            return result

        except exceptions.ResourceExhausted as exc:
            if attempt < max_retries:
                # Extract retry delay if available, otherwise exponential backoff
                sleep_time = base_delay * (2 ** attempt)
                # Check if the error message provides a specific delay
                error_msg = str(exc)
                match = re.search(r"retry in (\d+(\.\d+)?)s", error_msg)
                if match:
                    sleep_time = float(match.group(1)) + 1.0 # Add 1s buffer
                
                logger.warning("[ai.py] Quota exceeded (429). Retrying in %.2fs... (Attempt %d/%d)", sleep_time, attempt + 1, max_retries + 1)
                time.sleep(sleep_time)
                continue
            else:
                logger.error("[ai.py] !!!!! GEMINI QUOTA EXHAUSTED after %d retries: %s", max_retries, exc)
                return []

        except Exception as e:
            logger.error("[ai.py] !!!!! GEMINI CALL EXCEPTION: %s", e)
            logger.error("[ai.py] Full traceback:\n%s", traceback.format_exc())
            return []
    
    return []
