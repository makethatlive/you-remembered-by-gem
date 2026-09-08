# Design Document: Standalone Scraper Migration

## Overview

Migrate Base44 scraping functions to Express REST endpoints, preserving all discovery methods (Shopify API, sitemap parsing, crawling), validation rules, field preservation logic, and forensics logging. The architecture maintains the resumable batched design with continuation tokens.

## Architecture

### File Structure

```
server/
├── index.js                          # Express app, endpoint registration
├── services/
│   ├── ai/
│   │   └── gemini-client.js         # Existing Gemini client (reused)
│   ├── scraper/
│   │   ├── scraper-service.js       # Main scraping orchestrator
│   │   ├── discovery/
│   │   │   ├── shopify-discovery.js # Shopify /products.json pagination
│   │   │   ├── sitemap-discovery.js # Sitemap + robots.txt parsing
│   │   │   └── crawl-discovery.js   # Bounded HTML crawling
│   │   ├── extraction/
│   │   │   ├── product-extractor.js # JSON-LD + meta tag extraction
│   │   │   └── ai-extractor.js      # Gemini fallback wrapper
│   │   ├── validation/
│   │   │   └── product-validator.js # Validation + rejection rules
│   │   └── persistence/
│   │       └── product-persister.js # Bulk upsert with field preservation
│   └── auth/
│       └── auth-middleware.js       # JWT/session auth (existing)
└── utils/
    ├── scrape-utils.js              # Shared utilities (ported from scrapeShared.ts)
    └── continuation-token.js        # Token encoding/decoding
```

### Module Responsibilities

#### `scraper-service.js`
- **Lock management**: Acquire/release ScrapeState lock with heartbeat
- **Batch orchestration**: Loop over retailers, enforce batch limits (time/pages/AI budget)
- **Continuation token**: Encode/decode cursor state, validate scope matching
- **Coverage stamping**: Update retailer last_scrape_* fields after completion
- **Forensics logging**: Create ScrapeRunLog records per retailer
- **Response building**: Construct batch response with statistics

#### `shopify-discovery.js`
- **Detection**: Test /products.json?limit=1 on website_url and gift_page_url origins
- **Pagination**: Fetch /products.json with limit=250, page=N until exhausted
- **Mapping**: Convert Shopify JSON to Product_Record fields (name, description, price, etc.)
- **Rejection**: Filter variants with available:false
- **Limits**: Stop after 40 pages or zero products

#### `sitemap-discovery.js`
- **Robots.txt**: Fetch /robots.txt, extract Sitemap: directives (max 6)
- **Conventional paths**: Try /sitemap.xml, /sitemap_index.xml
- **Index expansion**: Parse sitemapindex, extract child sitemap URLs
- **Prioritization**: Prefer sitemaps with "product" in URL
- **URL extraction**: Parse urlset, extract loc tags
- **Filtering**: Accept product path patterns, reject non-product patterns
- **Normalization**: Remove query params (utm_*, variant, ref, etc.), trailing slashes
- **Limits**: Max 2000 URLs per retailer

#### `crawl-discovery.js`
- **Seeds**: Crawl website_url and gift_page_url (max 2)
- **Listing detection**: Find /collections, /category, /shop paths
- **Listing crawl**: Crawl up to 5 listing pages, extract product links
- **Filtering**: Same product path + rejection patterns as sitemap
- **Limits**: Max 300 URLs per retailer

#### `product-extractor.js`
- **Fetch**: GET product URL with 12s timeout
- **Canonical URL**: Extract from link[rel=canonical] or meta[property=og:url]
- **JSON-LD**: Parse script[type=application/ld+json], find Product nodes
- **Field mapping**: Extract name, description (800 char limit), price, currency, availability
- **Meta tags**: Fallback to product:price:amount, og:title, og:image
- **Rejection**: Out of stock, non-GBP, no title, invalid price
- **Source type**: Mark as "curated_retailer"

#### `ai-extractor.js`
- **Budget check**: Only proceed if batch AI budget > 0, decrement on use
- **HTML truncation**: Send first 30KB of product page HTML
- **Gemini call**: Use gemini-client.generateStructuredContent with extraction schema
- **Schema**: `{ name: string, description: string, price: number, image_url: string }`
- **Timeout**: 30s per AI call
- **Error handling**: Reject product with normalized reason on failure

#### `product-validator.js`
- **Name validation**: Min 4 chars, reject generic patterns (choose, shop now, gift guide)
- **URL validation**: Reject non-product paths (blog, cart, checkout, etc.)
- **Normalization**: Convert rejection reasons to bounded keys (failed_validation, out_of_stock, currency_not_gbp, etc.)
- **Tally**: Track rejection counts per reason in batch stats

#### `product-persister.js`
- **Deduplication**: Build URL key map (hostname + pathname, lowercased)
- **Existing products**: Query by retailer_id, build key map from product_url and affiliate_url
- **Field preservation**: Only update safe fields (last_verified, price, description if empty, image_url if empty)
- **Curated fields**: Never update status (except inactive rediscovery), interest_tags, gift_type_tags, quality_score, data_quality_flags, ai_classifications, notes, feedback
- **Inactive rediscovery**: Set status to "needs_review" unless data_quality_flags contains "junk_title" or "editorial_not_product"
- **New products**: Set status "needs_review", source_type "shopify_upload" or "curated_retailer", added_date and last_verified to now
- **Age bands**: Derive from retailer category, product name, description, keywords (code-side logic)
- **Image normalization**: Resolve relative URLs, reject non-http(s)
- **Bulk operations**: Accumulate creates/updates in arrays, flush in chunks of 200 via Prisma

#### `scrape-utils.js`
- **fetchWithTimeout**: Wrapper for fetch with timeout and User-Agent header
- **plainText**: Strip HTML tags from descriptions
- **normaliseUrl**: Remove query params, hash, trailing slash
- **urlKey**: Generate deduplication key from hostname + pathname
- **matchesNonProductUrl**: Check URL against rejection patterns
- **deriveAgeBands**: Extract suitable_age_bands from text content
- **validProduct**: Combined validation checks

#### `continuation-token.js`
- **encodeCursor**: Base64 encode JSON cursor state
- **decodeCursor**: Base64 decode and parse JSON, return null on error
- **validateScope**: Ensure token scope (retailer vs full) matches request

## API Endpoints

### POST /api/scrape/catalogue-batch

**Auth**: Admin JWT/session required (401 if missing, 403 if non-admin)

**Request Body**:
```json
{
  "retailer_id": "optional-retailer-id",
  "cursor": "optional-base64-continuation-token"
}
```

**Response** (200):
```json
{
  "done": false,
  "cursor": "base64-token-or-null",
  "batch": {
    "new_products": 42,
    "updated": 15,
    "skipped_duplicates": 3,
    "rejected": 7,
    "discovered": 67,
    "errors": ["Error message 1"],
    "reject_reasons": {
      "out_of_stock": 3,
      "failed_validation": 4
    }
  },
  "current_retailer": "Retailer Name",
  "retailers_remaining": 5
}
```

**Errors**:
- 400: Invalid retailer_id, corrupted token, scope mismatch
- 401: Unauthenticated
- 403: Non-admin
- 409: Scrape already running (fresh lock heartbeat)
- 500: Database or unexpected error

### POST /api/scrape/monthly

**Auth**: Admin JWT/session required

**Purpose**: Scheduled monthly scraping orchestrator

**Flow**:
1. Acquire ScrapeState lock (409 if running)
2. Phase A: Check availability (HEAD/GET existing products, flag inactive)
3. Phase B: Loop POST /api/scrape/catalogue-batch until done
4. Phase C: Optional enrichment batch (if implemented)
5. Release lock

**Response** (200):
```json
{
  "checkedCount": 1250,
  "inactiveCount": 23,
  "newProductsCount": 89
}
```

## Database Schema

### ScrapeState (singleton)
- `is_running`: Boolean lock flag
- `heartbeat_at`: Timestamp, stale after 10 minutes
- `last_run_at`: Timestamp, updated on completion

### Retailer Coverage Fields
- `last_scrape_at`: Timestamp
- `last_discovery_method`: Enum (shopify, sitemap, crawl, none)
- `last_scrape_status`: Enum (ok, no_products, error, skipped_no_source)
- `last_scrape_error`: String
- `last_scrape_products_found`: Integer

### ScrapeRunLog
- `run_date`: Date
- `scope`: Enum (full, retailer)
- `retailer_id`: Foreign key
- `retailer_name`: Denormalized string
- `scrape_status`: Enum (ok, no_products, error)
- `discovery_method`: Enum (shopify, sitemap, crawl, none)
- `new_products`: Integer
- `updated`: Integer
- `reject_reasons_json`: JSON string
- `error`: String

## Continuation Token Structure

```typescript
{
  scope: "retailer" | "full",
  retailerId: "id" | null,
  retailerIndex: number,          // Position in full run
  discoveryMode: "shopify" | "sitemap" | "crawl" | "none",
  shopifyOrigin: string | null,
  shopifyPage: number,            // Shopify pagination cursor
  productIndex: number,           // Position in discovered URLs
  newProducts: number,            // Cumulative for current retailer
  updated: number,                // Cumulative for current retailer
  rejected: number,               // Cumulative for current retailer
  rejectReasons: { [key: string]: number },  // Normalized tallies
  lastError: string | null
}
```

## Batch Limits

- **Time**: 45s soft deadline per batch
- **Shopify pages**: 2 per batch (up to 500 products)
- **Product pages**: 12 per batch
- **AI fallbacks**: 4 per batch
- **Bulk flush**: Every 200 products

## Lock Management Flow

```javascript
async function acquireLock() {
  const lock = await prisma.scrapeState.findUnique({ where: { id: 1 } });
  
  if (lock.is_running) {
    const age = Date.now() - lock.heartbeat_at.getTime();
    if (age < 10 * 60 * 1000) {
      throw new Error("Scrape already running", { status: 409 });
    }
    // Stale heartbeat: recover lock
  }
  
  await prisma.scrapeState.update({
    where: { id: 1 },
    data: { is_running: true, heartbeat_at: new Date() }
  });
}

async function releaseLock() {
  await prisma.scrapeState.update({
    where: { id: 1 },
    data: { is_running: false, last_run_at: new Date() }
  });
}
```

## Prisma Query Patterns

### Query existing products for deduplication
```javascript
const existing = await prisma.product.findMany({
  where: { retailerId },
  select: { id: true, product_url: true, affiliate_url: true, status: true, data_quality_flags: true }
});

const urlMap = new Map();
for (const p of existing) {
  urlMap.set(urlKey(p.product_url), p);
  if (p.affiliate_url) urlMap.set(urlKey(p.affiliate_url), p);
}
```

### Bulk upsert with field preservation
```javascript
// New products
await prisma.product.createMany({
  data: newProducts,
  skipDuplicates: true
});

// Updates (only safe fields)
for (const chunk of chunks(updates, 200)) {
  await prisma.$transaction(
    chunk.map(u => prisma.product.update({
      where: { id: u.id },
      data: {
        last_verified: new Date(),
        price: u.price,
        ...(u.existingDescription === '' && { description: u.description }),
        ...(u.existingImageUrl === '' && { image_url: u.image_url }),
        ...(u.shouldReactivate && { status: 'needs_review' })
      }
    }))
  );
}
```

## Gemini Client Integration

```javascript
import GeminiClient from './services/ai/gemini-client.js';

const gemini = process.env.GEMINI_API_KEY 
  ? new GeminiClient(process.env.GEMINI_API_KEY)
  : null;

// In ai-extractor.js
async function extractWithAI(html, budget) {
  if (!gemini || budget <= 0) {
    return { success: false, reason: "no_structured_data_ai_budget_spent" };
  }
  
  const prompt = `Extract product details from this HTML. Return JSON with name, description, price (number), image_url.`;
  const schema = {
    type: "object",
    properties: {
      name: { type: "string" },
      description: { type: "string" },
      price: { type: "number" },
      image_url: { type: "string" }
    }
  };
  
  try {
    const result = await Promise.race([
      gemini.generateStructuredContent(prompt + "\n\n" + html.slice(0, 30000), schema),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 30000))
    ]);
    
    if (!result.name || !Number.isFinite(result.price) || result.price <= 0) {
      return { success: false, reason: "ai_no_buyable_product" };
    }
    
    return { success: true, data: result };
  } catch (err) {
    return { success: false, reason: "ai_extraction_failed" };
  }
}
```

## Auth Middleware Reuse

```javascript
// In server/index.js
import { requireAuth, requireAdmin } from './services/auth/auth-middleware.js';

app.post('/api/scrape/catalogue-batch', requireAuth, requireAdmin, async (req, res) => {
  // Scraper logic
});
```

## Frontend Migration

**Before** (Base44):
```javascript
const result = await base44.functions.invoke("scrapeCatalogueBatch", { 
  retailerId, 
  cursor 
});
```

**After** (Express):
```javascript
const result = await fetch('/api/scrape/catalogue-batch', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}` 
  },
  body: JSON.stringify({ retailer_id: retailerId, cursor })
}).then(r => r.json());
```

## Error Isolation

Errors during retailer processing are isolated:
1. Catch error at retailer level
2. Capture error message in cursor state
3. Stamp retailer with last_scrape_status="error", last_scrape_error=message
4. Create ScrapeRunLog with scrape_status="error"
5. Continue to next retailer

Unhandled errors release lock in finally block:
```javascript
try {
  await acquireLock();
  // Batch processing
} finally {
  await releaseLock();
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Continuation Token Round-Trip Preservation

*For any* valid cursor state object, encoding then decoding the continuation token SHALL produce an equivalent state object with all fields preserved.

**Validates: Requirements 2.6, 2.9**

### Property 2: Batch Limit Enforcement

*For any* scraping batch operation, the system SHALL respect all batch limits: 45s time deadline, 2 Shopify pages (500 products), 12 non-Shopify product pages, and 4 AI fallback calls per batch.

**Validates: Requirements 2.2, 2.3, 2.4, 2.5**

### Property 3: Lock Prevents Concurrent Execution

*For any* concurrent scrape requests, when a lock is held with a fresh heartbeat (within 10 minutes), subsequent requests SHALL be rejected with HTTP 409 until the lock is released.

**Validates: Requirements 3.1, 3.2, 3.6, 3.7, 3.8**

### Property 4: Token Scope Validation

*For any* continuation token, requests with scope mismatch (per-retailer token used for full run, or vice versa) SHALL be rejected with HTTP 400 before acquiring the lock.

**Validates: Requirements 2.10, 2.11, 14.6, 14.7**

### Property 5: Shopify Product Mapping Preservation

*For any* valid Shopify product JSON response, the mapped Product_Record SHALL contain name from title, description from body_html (plain text, 800 char limit), price from available variant, and product_url as {origin}/products/{handle}.

**Validates: Requirements 4.3, 4.5, 4.6, 4.7**

### Property 6: Sitemap URL Filtering Consistency

*For any* URL extracted from a sitemap, acceptance SHALL depend only on path pattern matching (product paths) and rejection pattern exclusion (blog, cart, etc.), independent of query parameters or hash fragments.

**Validates: Requirements 5.8, 5.10, 5.11**

### Property 7: Product Validation Rejection Rules

*For any* product candidate, rejection SHALL occur when name is empty, name length < 4 characters, name matches generic patterns, URL contains non-product paths, price is not finite positive, or currency is not GBP.

**Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5**

### Property 8: Rejection Reason Normalization

*For any* rejection reason string, normalization SHALL produce a bounded stable key from the set: failed_validation, shopify_no_available_variant, out_of_stock, no_valid_price, currency_not_gbp, no_title, no_structured_data_ai_budget_spent, ai_no_buyable_product, ai_extraction_failed, other.

**Validates: Requirements 9.6, 9.7, 9.8, 9.9**

### Property 9: Curated Field Preservation on Update

*For any* existing Product_Record matched by URL key during scraping, updates SHALL only modify safe fields (last_verified, price, description if empty, image_url if empty) and SHALL never modify curated fields (status except inactive rediscovery, interest_tags, gift_type_tags, quality_score, data_quality_flags, ai_classifications, notes, feedback).

**Validates: Requirements 10.4, 10.5**

### Property 10: Inactive Product Rediscovery Logic

*For any* existing Product_Record with status "inactive" that is rediscovered during scraping, status SHALL be updated to "needs_review" UNLESS data_quality_flags contains "junk_title" or "editorial_not_product".

**Validates: Requirements 10.6, 10.7**

### Property 11: URL Key Deduplication

*For any* set of product URLs within a single batch, deduplication by URL key (hostname + pathname, lowercased, no trailing slash) SHALL ensure no duplicate products are created or updated within that batch.

**Validates: Requirements 10.1, 10.14**

### Property 12: Batch Response Structure Completeness

*For any* batch response, the JSON SHALL contain all required top-level fields: done (boolean), cursor (string or null), batch (object with new_products, updated, skipped_duplicates, rejected, discovered, errors, reject_reasons), current_retailer (string or null), and retailers_remaining (number).

**Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5, 11.6**

### Property 13: Coverage Stamp Completeness on Retailer Completion

*For any* retailer that completes processing (all batches), the system SHALL write all Coverage_Stamp fields to the Retailer_Record: last_scrape_at, last_discovery_method, last_scrape_status, last_scrape_error, last_scrape_products_found.

**Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.5**

### Property 14: ScrapeRunLog Creation on Completion

*For any* retailer that fully completes processing, the system SHALL create a ScrapeRunLog_Record with all required fields: run_date, scope, retailer_id, retailer_name, scrape_status, discovery_method, new_products, updated, reject_reasons_json, error.

**Validates: Requirements 13.1, 13.2, 13.4, 13.5, 13.6**

### Property 15: Early Retailer Validation Before Lock

*For any* request with retailer_id parameter, validation (exists, active, not curated_only, has website_url or gift_page_url) SHALL complete and reject with HTTP 400 BEFORE acquiring the ScrapeState_Lock.

**Validates: Requirements 14.1, 14.2, 14.3, 14.4, 14.5**

### Property 16: Bulk Operation Chunking

*For any* collection of product creates or updates, bulk database operations SHALL be chunked into batches of 200 records to prevent oversized transactions.

**Validates: Requirements 17.3, 17.4**

### Property 17: Error Isolation Per Retailer

*For any* retailer processing error, the error SHALL be captured in the retailer's Coverage_Stamp and ScrapeRunLog, and processing SHALL continue to the next retailer without aborting the entire scrape run.

**Validates: Requirements 18.1, 18.2, 18.3, 18.4**

### Property 18: Lock Release Guarantee

*For any* scrape batch execution path (success, error, or exception), the ScrapeState_Lock SHALL be released in a finally block to prevent indefinite locking.

**Validates: Requirements 3.6, 3.7, 3.8, 18.5**

## Implementation Notes

### Port from Base44 TypeScript to Express JavaScript

1. **Module conversion**: Base44 functions are self-contained TypeScript modules; port to CommonJS/ESM JavaScript
2. **Import changes**: Replace Base44 SDK imports with Prisma client and local utilities
3. **Type removal**: Strip TypeScript type annotations, keep JSDoc comments for clarity
4. **Async/await**: Preserve existing async patterns from Base44 code
5. **Error handling**: Replace Base44 error responses with Express res.status().json()

### Shared Utility Migration

Port `base44/shared/scrapeShared.ts` to `server/utils/scrape-utils.js`:
- Remove Deno/npm: prefix imports
- Convert to Node.js fetch (built-in Node 18+)
- Keep all validation logic, regex patterns, and normalization functions identical

### Testing Strategy

- **Unit tests**: Product validator rules, URL filtering, field preservation logic
- **Integration tests**: Full scrape flow with mocked Prisma and fetch
- **Property tests**: Continuation token round-trip, rejection reason normalization, URL key deduplication, bulk operation chunking

### Performance Considerations

- **Batch flushing**: Flush database operations every 200 products to balance memory and transaction size
- **Timeout handling**: 12s per product page fetch, 30s per AI extraction, 45s batch deadline
- **Concurrent limits**: Single lock prevents concurrent scrapes; consider queue pattern for future scaling

### Security

- **Auth**: Require admin role for all scraping endpoints
- **Input validation**: Validate retailer_id, cursor format before processing
- **SQL injection**: Use Prisma parameterized queries exclusively
- **DoS**: Batch limits prevent runaway scraping
