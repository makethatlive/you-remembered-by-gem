# Enrich Catalogue - Implementation Status

## Summary

The **"Enrich catalogue"** button functionality is **mostly implemented** in the standalone version, but **missing the AI classification track (R3)** from the original base44.

## Current Implementation Status

### ✅ **Track 1: Deterministic Enrichment** (COMPLETE)

The standalone version (`server/services/enrichment/enrichment-service.js`) already implements:

- ✅ **Description fetching**: Scrapes meta description from product URLs
- ✅ **Interest tags**: Matches against `INTEREST_KEYWORDS` taxonomy  
- ✅ **Gift type tags**: Matches against `GIFT_TYPE_KEYWORDS` taxonomy
- ✅ **Search keywords**: Generates searchable keywords from product text
- ✅ **Quality scoring**: Calculates 0-100 score based on completeness
- ✅ **Quality flags**: Detects issues (missing_description, junk_title, etc.)
- ✅ **Provenance protection**: Preserves human-authored tags (additive merge)
- ✅ **Child safety rules**: Age band restrictions (adult-only categories, etc.)
- ✅ **Batch processing**: Processes 25 products per batch (configurable 1-40)
- ✅ **Resume capability**: Tracks `catalogueEnrichedAt` stamp
- ✅ **Per-retailer scope**: Can filter by retailer_id
- ✅ **Bulk updates**: Uses Prisma transactions

### ❌ **Track 2: AI Classification (R3)** (MISSING)

The original base44 has a sophisticated AI classification system that is NOT yet implemented:

#### What's Missing:

1. **LLM Integration** (Gemini API)
   - Classifies products using AI: category, gender, age_bands, age_restricted
   - Returns confidence scores + evidence for each classification
   - Processes 15 products per batch (CLASSIFY_PER_RUN)

2. **Classification Stamping**
   - Stores verdicts in `ai_classifications` field with version tracking
   - Only re-classifies when version bumps (CLASSIFY_VERSION = 5)
   - Prevents re-processing already-classified products

3. **Provenance-Based Writing**
   - **canonical_category**: Machine-owned NEW field (write only when absent)
   - **gender_applies_to**: Correctable on non-curated products
   - **suitable_age_bands**: Correctable on machine-derived bands
   - **age_restricted**: Monotonic safety (can only escalate false → true)

4. **Low-Confidence Flagging**
   - Adds `classification_low_confidence` flag when confidence < 0.75
   - Surfaces AI uncertainty to operators

5. **Schema-Gate Probe**
   - Tests if `ai_classifications` field round-trips before burning API credits
   - Prevents classification when schema not yet published

6. **Dry-Run Mode**
   - Test mode: `{ dry_run: true }` in request body
   - Shows LLM verdicts without writing anything
   - Used for testing/previewing classifications

## What Works Right Now

The current standalone implementation provides:

### Deterministic Enrichment Features:

```javascript
POST /api/products/enrich-batch
Body: { batch_size: 25, retailer_id: null }

Response: {
  processed: 25,
  remaining: 150,
  classification_live: false,
  classification_error: undefined
}
```

**For each product:**
- Fetches description from product URL (if missing)
- Matches interest tags (e.g., "Art & design", "Food & drink")
- Matches gift type tags (e.g., "Personalisable", "Experience")
- Generates search keywords (4+ letter words)
- Calculates quality score (0-100)
- Detects quality flags (missing_description, junk_title, etc.)
- Applies age safety rules (removes kid bands from adult products)
- Stamps `catalogueEnrichedAt`

## What Needs to Be Added

To match the original base44 exactly, we need to implement:

### 1. AI Classification Service

Create `server/services/enrichment/ai-classifier.js`:

```javascript
export async function classifyProducts(products, retailerMap, geminiApiKey) {
  // Build Gemini API prompt with product data
  // Call Gemini API with JSON schema
  // Parse and sanitize verdicts
  // Return classification results
}
```

### 2. Update `enrichment-service.js`

Add Track 2 (AI classification) logic:

```javascript
// After Track 1 (deterministic enrichment):

// Track 2: AI classification
let classificationLive = false;
let classified = 0;
let classifyRemaining = 0;
let classificationError = "";

const isStamped = (p) =>
  Number(p?.aiClassifications?.version) >= CLASSIFY_VERSION && 
  !!p?.aiClassifications?.classifiedAt;

const candidates = products.filter((p) => !isStamped(p));

if (candidates.length > 0) {
  // Schema probe
  // Batch classify (15 products)
  // Apply verdicts with provenance rules
  // Apply age safety rules
  // Store ai_classifications stamps
}
```

### 3. Gemini API Integration

The original uses Anthropic Claude:

```typescript
await svc.integrations.Core.InvokeLLM({
  prompt: "...",
  response_json_schema: { ... }
})
```

We need to translate this to Gemini:

```javascript
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ 
  model: "gemini-1.5-pro",
  generationConfig: {
    responseMimeType: "application/json",
    responseSchema: { ... }
  }
});

const result = await model.generateContent(prompt);
```

### 4. Database Schema Check

The `ai_classifications` field must exist in `Product` schema:

```prisma
model Product {
  // ...
  aiClassifications Json?           @map("ai_classifications")
  // ...
}
```

**Status**: Need to verify if this field exists in your Prisma schema.

## Implementation Priority

### High Priority (Core Functionality):

1. ✅ **Deterministic enrichment** - DONE
2. ❌ **AI classification** - NEEDED for parity with base44

### Medium Priority (Nice-to-Have):

3. ❌ **Classification version tracking** - Prevents re-processing
4. ❌ **Dry-run mode** - Testing/preview capability
5. ❌ **Low-confidence flagging** - Surfaces AI uncertainty

### Low Priority (Edge Cases):

6. ❌ **Schema-gate probe** - Prevents wasted API calls
7. ❌ **Per-field provenance audit** - Full classification provenance

## Recommendation

**Option 1: Skip AI Classification (Faster)**
- Current implementation is already 80% complete
- Deterministic enrichment covers most use cases
- Manual review handles edge cases
- **Saves API costs** (no Gemini calls)

**Option 2: Full AI Classification (Original Parity)**
- Matches base44 exactly
- Better automated categorization
- Requires Gemini API integration
- **Adds API costs** (~15 products per batch)

## Next Steps

If you want full parity with the original base44, I can:

1. Check if `aiClassifications` field exists in your schema
2. Implement Gemini API classifier
3. Add Track 2 (AI classification) to enrichment service
4. Add classification stamping and provenance logic
5. Test with a small batch

**Do you want me to implement the full AI classification (Option 2)?** Or is the current deterministic enrichment sufficient (Option 1)?

---

**Current Status**: ✅ Deterministic enrichment working  
**Missing**: ❌ AI classification track (R3)  
**Effort to Complete**: ~2-3 hours for full AI classification
