# Implementation Plan: Standalone Scraper Migration

## Overview

Migrate Base44 scraping functions to Express REST endpoints while preserving all discovery methods (Shopify API, sitemap parsing, crawling), validation rules, field preservation logic, and forensics logging. The implementation maintains resumable batched architecture with continuation tokens.

## Tasks

- [ ] 1. Create shared utilities and continuation token module
  - Create `server/utils/scrape-utils.js` with URL normalization, product validation, age band derivation, and HTML parsing utilities
  - Create `server/utils/continuation-token.js` with base64 encoding/decoding and scope validation
  - Implement `fetchWithTimeout`, `plainText`, `normaliseUrl`, `urlKey`, `matchesNonProductUrl`, `deriveAgeBands` functions
  - _Requirements: 2.6, 2.9, 2.10, 2.11, 5.11, 6.9, 10.1, 10.12, 10.13_

- [ ] 2. Implement product discovery modules
  - [ ] 2.1 Create Shopify discovery module
    - Create `server/services/scraper/discovery/shopify-discovery.js`
    - Implement Shopify detection by testing /products.json?limit=1 on origins
    - Implement pagination with limit=250, page=N (max 40 pages, 2 pages per batch)
    - Map Shopify JSON to Product_Record fields (title→name, body_html→description, variants→price)
    - Reject products where all variants have available:false
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10_
  
  - [ ] 2.2 Create sitemap discovery module
    - Create `server/services/scraper/discovery/sitemap-discovery.js`
    - Fetch /robots.txt and extract Sitemap: directives (max 6)
    - Try conventional paths: /sitemap.xml, /sitemap_index.xml
    - Parse sitemapindex and extract child sitemap URLs (prioritize "product" in URL)
    - Extract product URLs from urlset sitemap loc tags (max 2000 per retailer)
    - Apply product path pattern matching and rejection patterns
    - Normalize URLs (remove query params, trailing slashes, hash fragments)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10, 5.11, 5.12, 5.13_
  
  - [ ] 2.3 Create crawl fallback discovery module
    - Create `server/services/scraper/discovery/crawl-discovery.js`
    - Crawl up to 2 seed URLs (website_url, gift_page_url)
    - Identify listing pages matching /collections, /category, /shop paths
    - Crawl up to 5 listing pages and extract product links (max 300 per retailer)
    - Apply same product path patterns and rejection patterns as sitemap
    - Reject links to different hostnames
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 6.11_

- [ ] 3. Implement product extraction and AI fallback
  - [ ] 3.1 Create product extractor module
    - Create `server/services/scraper/extraction/product-extractor.js`
    - Fetch product URL with 12-second timeout
    - Extract canonical URL from link[rel=canonical] or meta tags
    - Parse JSON-LD structured data (script[type=application/ld+json])
    - Extract Product fields: name, description (800 char limit), price, currency, availability
    - Fallback to meta tags: product:price:amount, og:title, og:image
    - Reject out of stock, non-GBP, no title, invalid price
    - Mark products with source_type "curated_retailer"
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10, 7.11, 7.12, 7.13_
  
  - [ ] 3.2 Create AI extractor wrapper
    - Create `server/services/scraper/extraction/ai-extractor.js`
    - Check batch AI budget (starts at 4 per batch) and decrement on use
    - Send first 30KB of HTML to Gemini with extraction schema
    - Request JSON schema: name (string), description (string), price (number), image_url (string)
    - Apply 30-second timeout to AI extraction calls
    - Reject if name empty or price invalid
    - Return normalized rejection reasons: "ai_no_buyable_product", "ai_extraction_failed", "no_structured_data_ai_budget_spent"
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 16.1, 16.2, 16.3, 16.4, 16.5, 16.6_

- [ ] 4. Implement product validation and persistence
  - [ ] 4.1 Create product validator module
    - Create `server/services/scraper/validation/product-validator.js`
    - Validate name length (min 4 chars), reject generic patterns (choose, shop now, gift guide, listing patterns)
    - Validate product_url not empty, not containing non-product paths (blog, cart, checkout, etc.)
    - Normalize rejection reasons to bounded keys: failed_validation, out_of_stock, currency_not_gbp, no_title, etc.
    - Track rejection counts per normalized reason
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9_
  
  - [ ] 4.2 Create product persister module
    - Create `server/services/scraper/persistence/product-persister.js`
    - Build URL key deduplication map (hostname + pathname, lowercased)
    - Query existing products by retailer_id and build URL key map from product_url and affiliate_url
    - For existing products: only update safe fields (last_verified, price, description if empty, image_url if empty)
    - Never update curated fields: status (except inactive rediscovery), interest_tags, gift_type_tags, quality_score, data_quality_flags, ai_classifications, notes, feedback
    - Handle inactive rediscovery: set status to "needs_review" unless data_quality_flags contains "junk_title" or "editorial_not_product"
    - For new products: set status "needs_review", source_type, added_date, last_verified
    - Derive suitable_age_bands from retailer category, product name, description, keywords
    - Resolve relative/protocol-relative image_url values
    - Accumulate creates/updates in arrays and bulk flush in chunks of 200 via Prisma
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9, 10.10, 10.11, 10.12, 10.13, 10.14, 17.1, 17.2, 17.3, 17.4, 17.5, 17.6_

- [ ] 5. Checkpoint - Ensure all modules test independently
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Implement main scraper service orchestrator
  - [ ] 6.1 Create scraper service with lock management
    - Create `server/services/scraper/scraper-service.js`
    - Implement lock acquisition with heartbeat recovery (stale after 10 minutes returns 409 with fresh heartbeat)
    - Update heartbeat_at when acquiring lock and periodically during operations
    - Release lock (set is_running to false) in finally block to guarantee release
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 18.5_
  
  - [ ] 6.2 Implement batch orchestration logic
    - Loop over retailers (all active or single retailer_id)
    - Enforce batch limits: 45s time deadline, 2 Shopify pages (500 products), 12 product pages, 4 AI fallback calls
    - Call discovery modules in order: Shopify → sitemap → crawl
    - Track batch statistics: new_products, updated, skipped_duplicates, rejected, discovered, errors, reject_reasons
    - Encode/decode continuation tokens with all state fields
    - Validate token scope matching (per-retailer vs full-run)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11_
  
  - [ ] 6.3 Implement coverage stamping and forensics logging
    - Write Coverage_Stamp to Retailer_Record on completion: last_scrape_at, last_discovery_method, last_scrape_status, last_scrape_error, last_scrape_products_found
    - Create ScrapeRunLog_Record per retailer: run_date, scope, retailer_id, retailer_name, scrape_status, discovery_method, new_products, updated, reject_reasons_json, error
    - Handle errors gracefully: log, stamp retailer, create ScrapeRunLog with status "error", continue to next retailer
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 18.1, 18.2, 18.3, 18.4_
  
  - [ ] 6.4 Implement batch response builder
    - Construct batch response JSON with all required fields: done, cursor, batch, current_retailer, retailers_remaining
    - Set done=true when all retailers processed, done=false otherwise
    - Include cursor (base64 token) when done=false, null when done=true
    - Include batch statistics and normalized reject_reasons object
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7_

- [ ] 7. Implement Express API endpoints
  - [ ] 7.1 Create POST /api/scrape/catalogue-batch endpoint
    - Register endpoint in `server/index.js` with admin authentication middleware
    - Validate retailer_id before acquiring lock: exists, active, not curated_only, has website_url or gift_page_url
    - Return HTTP 400 for invalid retailer_id or corrupted token or scope mismatch (before acquiring lock)
    - Return HTTP 401 for unauthenticated requests
    - Return HTTP 403 for non-admin authenticated requests
    - Accept JSON body with optional retailer_id and cursor fields
    - Invoke scraper service orchestrator
    - Return batch response JSON or error responses (409 for running lock, 500 for unexpected errors)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 18.6_
  
  - [ ] 7.2 Create POST /api/scrape/monthly endpoint
    - Register endpoint in `server/index.js` with admin authentication middleware
    - Acquire ScrapeState lock (409 if running)
    - Phase A: Check availability of existing products (HEAD/GET requests), flag inactive products
    - Phase B: Loop POST /api/scrape/catalogue-batch internally until done
    - Phase C: Optional enrichment batch (if implemented, else skip)
    - Release lock on completion or error
    - Return JSON summary: checkedCount, inactiveCount, newProductsCount
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 19.7, 19.8_

- [ ]* 7.3 Write unit tests for validation and utilities
  - Test product validator rejection rules (name patterns, URL patterns, price/currency validation)
  - Test URL normalization, urlKey generation, matchesNonProductUrl
  - Test continuation token encoding/decoding round-trip
  - Test rejection reason normalization
  - **Property 1: Continuation Token Round-Trip Preservation**
  - **Property 6: Sitemap URL Filtering Consistency**
  - **Property 7: Product Validation Rejection Rules**
  - **Property 8: Rejection Reason Normalization**
  - **Validates: Requirements 2.6, 2.9, 5.8, 5.10, 5.11, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9**

- [ ]* 7.4 Write integration tests for scraper service
  - Test lock acquisition and heartbeat recovery
  - Test batch limit enforcement (time, pages, AI budget)
  - Test token scope validation
  - Test field preservation on product updates (safe vs curated fields)
  - Test inactive product rediscovery logic
  - Test URL key deduplication within batch
  - Test coverage stamping and ScrapeRunLog creation
  - Test error isolation per retailer
  - **Property 2: Batch Limit Enforcement**
  - **Property 3: Lock Prevents Concurrent Execution**
  - **Property 4: Token Scope Validation**
  - **Property 9: Curated Field Preservation on Update**
  - **Property 10: Inactive Product Rediscovery Logic**
  - **Property 11: URL Key Deduplication**
  - **Property 13: Coverage Stamp Completeness on Retailer Completion**
  - **Property 14: ScrapeRunLog Creation on Completion**
  - **Property 15: Early Retailer Validation Before Lock**
  - **Property 16: Bulk Operation Chunking**
  - **Property 17: Error Isolation Per Retailer**
  - **Property 18: Lock Release Guarantee**
  - **Validates: Requirements 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.6, 3.7, 3.8, 10.4, 10.5, 10.6, 10.7, 10.1, 10.14, 12.1, 12.2, 13.1, 13.2, 14.1-14.7, 17.3, 17.4, 18.1-18.5**

- [ ] 8. Frontend integration - Update RetailerScrapeButton component
  - [ ] 8.1 Replace Base44 function invocation with Express endpoint
    - Locate and update frontend scrape button component (likely in `src/components/admin/`)
    - Replace `base44.functions.invoke("scrapeCatalogueBatch")` with `fetch('/api/scrape/catalogue-batch', {method: 'POST', ...})`
    - Include retailer_id in request body for per-retailer scrapes
    - Include cursor from localStorage in request body when resuming
    - Save returned cursor to localStorage keyed by retailer_id
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 20.1_
  
  - [ ] 8.2 Implement batch loop and progress display
    - Loop invoking endpoint until done=true in response
    - Display batch progress: batch count, new_products, updated, rejected counts
    - Display completion toast when done=true
    - Clear saved cursor from localStorage on completion
    - _Requirements: 15.5, 15.6, 15.7, 15.8_
  
  - [ ] 8.3 Implement error handling and cooperative stop
    - Handle HTTP 409: display "scrape already running" message
    - Handle HTTP 400 with continuation token error: clear saved cursor, display restart message
    - Implement cooperative stop: set stopRef flag between batches, save cursor, display "stopped" toast
    - _Requirements: 15.9, 15.10, 15.11_

- [ ] 9. Checkpoint - End-to-end testing
  - Test single retailer scrape via frontend button
  - Test full scrape with continuation and resumption
  - Test concurrent scrape rejection (409 response)
  - Verify coverage stamps and forensics logs are created
  - Verify curated fields are preserved on existing products
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Remove Base44 dependencies
  - [ ] 10.1 Remove Base44 imports from Express server
    - Search for and remove all `@base44/sdk` imports from server code
    - Remove `@base44/sdk` from package.json dependencies if present
    - Verify no remaining references to `base44.` calls in server code
    - _Requirements: 20.2, 20.3, 20.4, 20.5_
  
  - [ ] 10.2 Verify standalone operation
    - Test scraping without Base44 connection
    - Verify authentication works via session/JWT mechanism
    - Verify all discovery methods function correctly
    - Verify Prisma handles all database operations
    - _Requirements: 20.3, 20.4, 20.5_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- The implementation preserves all existing functional behavior from Base44 functions
- The scraper uses the existing Gemini client for AI fallback extraction
- Bulk database operations are chunked at 200 records for performance
- Lock management with heartbeat prevents concurrent scrapes and enables recovery from stale locks
- Continuation tokens enable resumable batched processing for large catalogs
- Field preservation logic ensures manual curation work is never overwritten

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1", "2.2", "2.3", "3.1", "3.2", "4.1", "4.2"] },
    { "id": 2, "tasks": ["6.1"] },
    { "id": 3, "tasks": ["6.2", "6.3", "6.4"] },
    { "id": 4, "tasks": ["7.1", "7.2"] },
    { "id": 5, "tasks": ["7.3", "7.4", "8.1"] },
    { "id": 6, "tasks": ["8.2", "8.3"] },
    { "id": 7, "tasks": ["10.1", "10.2"] }
  ]
}
```
