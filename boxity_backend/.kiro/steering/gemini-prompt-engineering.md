# Gemini Prompt Engineering & AI Integration

## Overview

The Gemini integration uses an ensemble approach with two models (`gemini-3-flash-preview`) for robustness and consensus. The prompt is carefully engineered to detect security threats, physical damage, and tampering indicators.

## Prompt Structure

### System Message Components

The system message in `api/ai.py` contains:

1. **Role Definition**: "Expert multimodal forensic analyst"
2. **Mission**: Compare baseline vs current package photos
3. **Detection Targets**: List of 9 detection types with descriptions
4. **Region Specification**: Precise location naming conventions
5. **Analysis Rules**: 8 critical rules for output format and quality
6. **Few-Shot Examples**: 5 detailed examples with expected JSON structure

### Generation Config

```python
generation_config = {
    "temperature": 0.15,        # Low temperature for consistency
    "top_k": 20,                # Limit token choices
    "top_p": 0.8,               # Nucleus sampling
    "response_mime_type": "application/json",  # Force JSON output
}
```

**Rationale**:
- Low temperature (0.15) ensures consistent, deterministic responses
- JSON mime type forces structured output
- top_k and top_p prevent hallucinations

## Detection Types & Prompting

### Security-Critical Detections

These are emphasized in the prompt as highest priority:

- **seal_tamper**: Broken, lifted, or altered seals (CRITICAL SECURITY RISK)
- **repackaging**: Different packaging, missing elements, structural changes
- **label_mismatch**: Altered, replaced, or counterfeit labels
- **digital_edit**: Photo manipulation, cloning, artificial modifications

**Prompt Strategy**: Lead with security threats, use strong language ("CRITICAL", "IMMEDIATE QUARANTINE")

### Physical Damage Detections

- **dent**: Physical damage from impact or compression
- **scratch**: Surface abrasions or cuts
- **stain**: Discoloration or contamination
- **color_shift**: Significant color changes indicating tampering
- **missing_item**: Absent components or contents

**Prompt Strategy**: Provide visual cues (shading, curvature, patterns) to help model identify

## Region Naming in Prompts

The prompt specifies exact region terminology:

```
- 'left side': Left edge/panel of the package
- 'right side': Right edge/panel of the package
- 'top edge': Upper portion/seal area
- 'bottom edge': Lower portion/base
- 'front panel': Main visible surface
- 'back panel': Rear surface
- 'corner': Specific corner (top-left, top-right, etc.)
- 'center': Middle area of package
```

**Why**: Ensures consistent, specific region identification across all analyses

## Few-Shot Examples

The prompt includes 5 detailed examples showing:

1. **seal_tamper** with HIGH severity, 0.84 confidence, -40 TIS delta
2. **dent** with MEDIUM severity, 0.78 confidence, -15 TIS delta
3. **scratch** with LOW severity, 0.72 confidence, -8 TIS delta
4. **label_mismatch** with HIGH severity, 0.82 confidence, -40 TIS delta
5. **dent** (corner) with MEDIUM severity, 0.75 confidence, -15 TIS delta

**Purpose**: Demonstrates expected output format, severity levels, confidence ranges, and TIS deltas

## Confidence Score Guidance

The prompt instructs:

- `> 0.8`: Only for unequivocal evidence (clear seal break, obvious dent)
- `0.6-0.8`: Likely detections (probable damage, likely tampering)
- `< 0.6`: Uncertain (triggers classical CV fallback)

**Rationale**: Conservative scoring prevents false positives while catching real issues

## JSON Schema Enforcement

The prompt requires strict JSON structure:

```json
{
  "differences": [
    {
      "id": "string",
      "region": "string",
      "bbox": [x, y, w, h],
      "type": "string",
      "description": "string",
      "severity": "HIGH|MEDIUM|LOW",
      "confidence": 0.0-1.0,
      "explainability": ["string"],
      "suggested_action": "string",
      "tis_delta": integer
    }
  ]
}
```

**Validation**: Response is validated against `RESPONSE_SCHEMA` in `api/schema.py`

## Ensemble Strategy

### Two-Model Approach

1. **Model 1**: `gemini-3-flash-preview` (fast, good for most cases)
2. **Model 2**: `gemini-3-flash-preview` (consensus, catches edge cases)

**Process**:
1. Send same prompt + images to both models
2. Parse JSON from both responses
3. Merge results, preferring consensus detections
4. Limit to 8 differences (prevent hallucination)

### Merging Logic

```python
# Merge: keep items with matching region/type (rough consensus) first
merged = []
seen = set()
for item in list1 + list2:
    key = (item.get("region"), item.get("type"))
    if key not in seen:
        seen.add(key)
        merged.append(item)
```

**Benefit**: Reduces false positives while catching real issues

## Fallback & Repair

### Schema Validation Failure

If response doesn't match schema:

1. **Attempt Repair**: Ask model to fix JSON to match schema
2. **Re-validate**: Check repaired response
3. **Fallback**: If still invalid, return empty differences

```python
def _validate_or_repair(payload, model):
    try:
        validate(instance=payload, schema=RESPONSE_SCHEMA)
        return payload
    except ValidationError:
        # Ask model to repair
        result = model.generate_content([
            "Repair this JSON to match the schema...",
            json.dumps(payload)
        ])
        repaired = _extract_json(result.text)
        validate(instance=repaired, schema=RESPONSE_SCHEMA)
        return repaired
```

### Low Confidence Fallback

If average confidence < 0.6:

1. Run classical CV pipeline (`align_and_normalize()`)
2. Generate region proposals with OpenCV
3. Merge CV results with Gemini results
4. Prefer Gemini if both detect same region

## Prompt Optimization Tips

### For Better Detection

1. **Add More Examples**: Include examples specific to your package types
2. **Clarify Ambiguities**: If model misses certain damage types, add explicit examples
3. **Adjust Temperature**: Lower (0.1) for consistency, higher (0.3) for creativity
4. **Refine Region Names**: Use terms specific to your packages (e.g., "seal flap" instead of "top edge")

### For Faster Responses

1. **Use flash model**: Already using `gemini-3-flash-preview`
2. **Reduce examples**: Fewer few-shot examples = faster processing
3. **Simplify prompt**: Remove unnecessary instructions

### For Higher Accuracy

1. **Add more examples**: 10+ examples for complex scenarios
2. **Use pro model**: `gemini-3-pro-preview` for critical analyses
3. **Increase temperature slightly**: 0.2-0.3 for more thoughtful responses
4. **Add constraints**: "Maximum 5 differences per image" to prevent hallucination

## Common Prompt Issues & Fixes

### Issue: Model Returns Non-JSON

**Cause**: Prompt not clear enough about JSON requirement

**Fix**: Add explicit instruction: "Return STRICT JSON as {...} with NO additional text"

### Issue: Confidence Scores Too High

**Cause**: Model being too confident

**Fix**: Add: "Be conservative with confidence scores - only use >0.8 when evidence is unequivocal"

### Issue: Missing Detections

**Cause**: Model not focusing on specific damage types

**Fix**: Add more few-shot examples of that damage type

### Issue: Wrong Region Names

**Cause**: Model using generic terms

**Fix**: Add: "ALWAYS specify exact region (left side, right side, top edge, etc.) - never use generic terms"

### Issue: Hallucinated Differences

**Cause**: Model inventing issues that don't exist

**Fix**: 
1. Lower temperature to 0.1
2. Add: "Only report differences you can clearly see in the images"
3. Limit output: "Maximum 8 differences per analysis"

## Testing Prompts

### Test Case 1: Identical Images

**Input**: Same image as baseline and current

**Expected**: `differences: []`, `aggregate_tis: 100`, `overall_assessment: SAFE`

### Test Case 2: Obvious Damage

**Input**: Baseline (pristine) vs current (visible dent)

**Expected**: One dent detection, HIGH or MEDIUM severity, TIS < 85

### Test Case 3: Seal Tampering

**Input**: Baseline (sealed) vs current (broken seal)

**Expected**: seal_tamper detection, HIGH severity, TIS < 40

### Test Case 4: Digital Edit

**Input**: Baseline (original) vs current (digitally altered)

**Expected**: digital_edit detection, HIGH severity, TIS < 50

## Monitoring Prompt Performance

### Metrics to Track

1. **Detection Rate**: % of images with detections
2. **False Positive Rate**: Detections on identical images
3. **Confidence Distribution**: Average confidence scores
4. **TIS Distribution**: Range of TIS scores
5. **Model Agreement**: % of consensus between two models

### Logging

```python
print(f"Gemini call for {view_label}: {len(baseline_bytes)} bytes", file=sys.stderr)
print(f"Detections: {len(differences)}, Avg confidence: {avg_conf:.2f}", file=sys.stderr)
print(f"TIS: {tis}, Assessment: {assessment}", file=sys.stderr)
```

## Future Improvements

1. **Fine-tuning**: Train custom model on your package types
2. **Multi-language**: Adapt prompts for different languages
3. **Domain-Specific**: Customize for pharma, food, luxury goods, etc.
4. **Real-time Feedback**: Collect user feedback to improve prompts
5. **A/B Testing**: Test prompt variations to find optimal version
