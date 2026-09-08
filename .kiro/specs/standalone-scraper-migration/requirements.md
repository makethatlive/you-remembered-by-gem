# Requirements Document

## Introduction

This document specifies the requirements for migrating the Base44 scraping system to a standalone Express backend. The system must port all existing scraping functionality from Base44 functions (scrapeCatalogueBatch, scrapeRetailerProducts, monthlyScrape) while maintaining resumable/batched architecture, product discovery methods (Shopify API, sitemap parsing, crawling), data quality preservation rules, and forensics logging.

## Glossary

- **Scraper_API**: The Express REST API endpoint that executes scraping operations
- **Gemini_Client**: Google Gemini AI client used for fallback product extraction when structured data is unavailable
- **Continuation_Token**: Base64-encoded cursor containing scraping state for resumable batch processing
- **Discovery_Method**: The technique used to find product URLs (shopify, sitemap, crawl, none)
- **Product_Record**: A row in the products table representing a single purchasable item
- **Retailer_Record**: A row in the retailers table representing a store selling products
- **ScrapeState_Lock**: Database singleton preventing concurrent scrape runs with heartbeat mechanism
- **ScrapeRunLog_Record**: Forensics record capturing per-retailer completion statistics
- **Frontend_Client**: React component (RetailerScrapeButton) invoking scraper via REST
- **Batch_Response**: JSON response containing done flag, cursor, and batch statistics
- **Coverage_Stamp**: Fields written to Retailer_Record after scraping (last_scrape_at, last_discovery_method, last_scrape_status, last_scrape_error, last_scrape_products_found)
- **Curated_Field**: Product field preserved during scraping (status, interest_tags, gift_type_tags, quality_score, data_quality_flags, ai_classifications, notes, admin feedback)
- **Safe_Field**: Product field updateable during scraping (price, description when empty, image_url when empty, last_verified)

## Requirements

### Requirement 1: Scraper API Endpoint

**User Story:** As an admin user, I want to invoke retailer scraping via REST API, so that I can discover and import products in standalone mode

#### Acceptance Criteria

1. THE Scraper_API SHALL expose a POST endpoint at /api/scrape/catalogue-batch
2. THE Scraper_API SHALL require admin authentication via JWT or session token
3. WHEN an unauthenticated request is received, THE Scraper_API SHALL return HTTP 401 with error message
4. WHEN a non-admin authenticated request is received, THE Scraper_API SHALL return HTTP 403 with error message
5. THE Scraper_API SHALL accept JSON body with optional fields: retailer_id (string), cursor (string)
6. WHEN retailer_id is provided, THE Scraper_API SHALL scope the scrape to that single Retailer_Record
7. WHEN retailer_id is omitted, THE Scraper_API SHALL process all active Retailer_Records
8. WHEN cursor is provided, THE Scraper_API SHALL resume from the encoded Continuation_Token state
9. WHEN cursor is omitted, THE Scraper_API SHALL start a fresh scrape from the beginning

### Requirement 2: Batched Resumable Architecture

**User Story:** As an admin user, I want scraping to run in bounded batches with continuation tokens, so that long-running scrapes can pause, resume, and survive timeouts

#### Acceptance Criteria

1. THE Scraper_API SHALL process one bounded batch per invocation and return a Continuation_Token
2. THE Scraper_API SHALL enforce a soft wall-clock deadline of 45 seconds per batch
3. THE Scraper_API SHALL process up to 2 Shopify pagination pages per batch (up to 500 products)
4. THE Scraper_API SHALL process up to 12 non-Shopify product pages per batch
5. THE Scraper_API SHALL use up to 4 AI fallback extractions per batch when structured data is unavailable
6. THE Scraper_API SHALL encode Continuation_Token state as base64 JSON containing: retailer id, discovery mode, Shopify origin, page number, product index, new products count, updated count, rejection reasons
7. WHEN the batch completes before all retailers are processed, THE Scraper_API SHALL return done:false with a valid Continuation_Token
8. WHEN all retailers are processed, THE Scraper_API SHALL return done:true with no Continuation_Token
9. THE Scraper_API SHALL reject invalid or corrupted Continuation_Token with HTTP 400 error
10. WHEN a Continuation_Token is minted by a per-retailer run, THE Scraper_API SHALL reject it if used for a full-run request
11. WHEN a Continuation_Token is minted by a full-run, THE Scraper_API SHALL reject it if used for a per-retailer request

### Requirement 3: Concurrency Lock with Heartbeat Recovery

**User Story:** As an admin user, I want concurrent scrape runs to be prevented, so that overlapping scrapes do not create duplicate products or corrupt state

#### Acceptance Criteria

1. THE Scraper_API SHALL acquire the ScrapeState_Lock before processing any batch
2. WHEN the ScrapeState_Lock is already held with a fresh heartbeat (within 10 minutes), THE Scraper_API SHALL return HTTP 409 with error message
3. WHEN the ScrapeState_Lock is held with a stale heartbeat (older than 10 minutes), THE Scraper_API SHALL recover the lock by overwriting is_running and heartbeat_at
4. THE Scraper_API SHALL write the current timestamp to heartbeat_at when acquiring the lock
5. THE Scraper_API SHALL update heartbeat_at periodically during long-running operations
6. THE Scraper_API SHALL set is_running to false and release the lock when the batch completes
7. THE Scraper_API SHALL set is_running to false and release the lock when an error occurs
8. THE Scraper_API SHALL set is_running to false and release the lock in a finally block to guarantee release

### Requirement 4: Shopify Product Discovery

**User Story:** As an admin user, I want Shopify retailers to be scraped via the products.json API, so that structured product data is obtained without AI extraction

#### Acceptance Criteria

1. THE Scraper_API SHALL detect Shopify retailers by testing /products.json?limit=1 on website_url and gift_page_url origins
2. WHEN a retailer is identified as Shopify, THE Scraper_API SHALL fetch products via /products.json with limit=250 and page=N pagination
3. THE Scraper_API SHALL extract product title, handle, body_html, product_type, tags, images, and variants from Shopify JSON
4. THE Scraper_API SHALL reject Shopify products where all variants have available:false
5. THE Scraper_API SHALL construct product_url as {origin}/products/{handle}
6. THE Scraper_API SHALL map Shopify product fields to Product_Record: name from title, description from body_html (plain text, 800 char limit), category from product_type or first tag, price from available variant price, image_url from first image src, search_keywords from tags array
7. THE Scraper_API SHALL mark new Shopify products with source_type "shopify_upload"
8. THE Scraper_API SHALL stop Shopify pagination when a page returns zero products or after 40 pages (10,000 product guard)
9. THE Scraper_API SHALL increment batch Shopify page counter and enforce the 2-page-per-batch limit
10. THE Scraper_API SHALL stamp Discovery_Method "shopify" on the Retailer_Record after successful Shopify scrape

### Requirement 5: Sitemap Product Discovery

**User Story:** As an admin user, I want non-Shopify retailers to be scraped via sitemaps, so that product URLs are discovered without crawling

#### Acceptance Criteria

1. WHEN a retailer is not Shopify, THE Scraper_API SHALL attempt sitemap discovery
2. THE Scraper_API SHALL fetch /robots.txt and extract Sitemap: directives (up to 6 sitemaps)
3. THE Scraper_API SHALL fetch conventional sitemap URLs: {origin}/sitemap.xml, {origin}/sitemap_index.xml
4. WHEN a sitemap contains sitemapindex tag, THE Scraper_API SHALL extract child sitemap URLs from loc tags
5. THE Scraper_API SHALL prioritize child sitemaps containing "product" in the URL
6. THE Scraper_API SHALL fetch up to 6 child sitemaps per retailer
7. THE Scraper_API SHALL extract product URLs from urlset sitemap loc tags
8. THE Scraper_API SHALL accept URLs matching path pattern /\/(products?|item|itm|p|dp|buy)\/[^/]+/i
9. WHEN a URL is from a sitemap containing "product" in its name, THE Scraper_API SHALL accept descriptive slugs (hyphenated, 8+ chars, 2+ path segments)
10. THE Scraper_API SHALL reject URLs matching non-product patterns: /blog, /journal, /news, /guide, /article, /search, /collections/, /pages/, /about, /contact, /reviews, gift-card, /account, /login, /basket, /cart, /checkout, /careers, /press, /terms, /privacy, /returns, /delivery, /faq, /help, /wishlist
11. THE Scraper_API SHALL normalize URLs by removing query params (utm_*, variant, ref, source, srsltid) and trailing slashes and hash fragments
12. THE Scraper_API SHALL collect up to 2000 product URLs per retailer from sitemaps
13. THE Scraper_API SHALL stamp Discovery_Method "sitemap" on the Retailer_Record after successful sitemap discovery

### Requirement 6: Crawl Fallback Discovery

**User Story:** As an admin user, I want retailers without Shopify or sitemaps to be scraped via bounded crawling, so that product URLs can still be discovered

#### Acceptance Criteria

1. WHEN sitemap discovery returns zero URLs, THE Scraper_API SHALL attempt crawl discovery
2. THE Scraper_API SHALL crawl up to 2 seed URLs: website_url and gift_page_url
3. THE Scraper_API SHALL extract href links from seed page HTML (up to 400KB per page)
4. THE Scraper_API SHALL identify listing pages matching paths: /collections, /category, /categories, /shop, /gifts, /range
5. THE Scraper_API SHALL crawl up to 5 listing pages per retailer
6. THE Scraper_API SHALL extract href links from listing pages
7. THE Scraper_API SHALL accept links matching product path patterns or descriptive slugs (hyphenated, 8+ chars, 2+ path segments)
8. THE Scraper_API SHALL reject links to different hostnames
9. THE Scraper_API SHALL reject links matching non-product patterns
10. THE Scraper_API SHALL collect up to 300 product URLs per retailer from crawling
11. THE Scraper_API SHALL stamp Discovery_Method "crawl" on the Retailer_Record after successful crawl discovery

### Requirement 7: Product Page Extraction

**User Story:** As an admin user, I want product pages to be parsed for structured data, so that product details are extracted without AI when possible

#### Acceptance Criteria

1. THE Scraper_API SHALL fetch each discovered product URL with 12-second timeout
2. THE Scraper_API SHALL extract canonical URL from link[rel=canonical] or meta[property=og:url] or fallback to response URL
3. THE Scraper_API SHALL attempt JSON-LD structured data extraction first
4. THE Scraper_API SHALL parse script[type=application/ld+json] blocks and find Product nodes in @graph or @type arrays
5. THE Scraper_API SHALL extract name from Product.name, description from Product.description (plain text, 800 char limit), price from Product.offers.price or Product.offers.lowPrice, currency from Product.offers.priceCurrency, availability from Product.offers.availability
6. THE Scraper_API SHALL reject products where offers.availability matches /OutOfStock|Discontinued/i
7. THE Scraper_API SHALL reject products where price is not a finite positive number
8. THE Scraper_API SHALL reject products where currency is not GBP
9. THE Scraper_API SHALL reject products where name is empty
10. WHEN JSON-LD extraction fails, THE Scraper_API SHALL attempt meta tag extraction
11. THE Scraper_API SHALL extract price from meta[property="product:price:amount"], currency from meta[property="product:price:currency"], title from meta[property="og:title"] or title tag, description from meta[name="description"], image from meta[property="og:image"]
12. WHEN meta tag extraction produces valid product data, THE Scraper_API SHALL use it without AI fallback
13. THE Scraper_API SHALL mark extracted products with source_type "curated_retailer"

### Requirement 8: AI Fallback Extraction

**User Story:** As an admin user, I want AI extraction as a bounded fallback, so that products without structured data can still be imported

#### Acceptance Criteria

1. WHEN structured data and meta tag extraction both fail, THE Scraper_API SHALL use Gemini_Client for AI extraction
2. THE Scraper_API SHALL only use AI extraction when the batch AI budget is positive (starts at 4 per batch)
3. THE Scraper_API SHALL decrement the batch AI budget by 1 for each AI extraction attempt
4. THE Scraper_API SHALL send the product page HTML (first 30KB) to Gemini_Client with extraction prompt
5. THE Scraper_API SHALL request JSON response schema with fields: name (string), description (string), price (number), image_url (string)
6. THE Scraper_API SHALL reject AI extraction results where name is empty or price is not a finite positive number
7. WHEN AI extraction returns empty or invalid data, THE Scraper_API SHALL reject the product with reason "AI found no buyable product"
8. WHEN AI extraction throws an error, THE Scraper_API SHALL reject the product with reason "AI extraction failed"
9. WHEN batch AI budget reaches zero, THE Scraper_API SHALL reject remaining products with reason "no structured data (AI budget spent)"

### Requirement 9: Product Validation and Filtering

**User Story:** As an admin user, I want invalid products to be rejected with clear reasons, so that the catalogue contains only genuine buyable items

#### Acceptance Criteria

1. THE Scraper_API SHALL reject products where name is less than 4 characters
2. THE Scraper_API SHALL reject products where product_url is empty or invalid
3. THE Scraper_API SHALL reject products where name matches patterns: /^(choose|shop now|view product|learn more|skip to|reviews?)\b/i, /\btop \d+\b.*\b(tips|mistakes|faux pas|ways)\b/i
4. THE Scraper_API SHALL reject products where name matches listing patterns: /^gifts?\s+(under|over|for|by|from)\b/i, /\bgift guide\b/i, /^(all|shop|browse|explore|discover)\s+(gifts?|products?)/i, /^(new in|new arrivals|best sellers|sale|clearance|collections|categories|shop all)$/i, /^(men|women|kids|children|him|her|home|accessories|jewellery|gifting|gifts?)$/i
5. THE Scraper_API SHALL reject products where product_url contains non-product paths: /blog, /journal, /news, /guide, /article, /search, gift-card, /editorial, /magazine, /stories, gift-guide, /inspiration, /lookbook, /category/, /collection/, /tag/, /listing, /gifts-under-, /gifts-for-him, /gifts-for-her
6. THE Scraper_API SHALL normalize rejection reasons to bounded keys: failed_validation, shopify_no_available_variant, out_of_stock, no_valid_price, currency_not_gbp, no_title, no_structured_data_ai_budget_spent, ai_no_buyable_product, ai_extraction_failed, other
7. THE Scraper_API SHALL increment batch rejection count for each rejected product
8. THE Scraper_API SHALL increment batch rejection reason tally for each rejection with normalized key
9. THE Scraper_API SHALL accumulate per-retailer rejection reason tally in Continuation_Token

### Requirement 10: Product Upsert with Field Preservation

**User Story:** As an admin user, I want existing products to be updated without overwriting curated fields, so that manual curation work is preserved

#### Acceptance Criteria

1. THE Scraper_API SHALL deduplicate products by URL key (hostname + pathname, lowercased, no trailing slash)
2. THE Scraper_API SHALL query existing Product_Records by retailer_id and build URL key map from product_url and affiliate_url
3. WHEN a scraped product URL key matches an existing Product_Record, THE Scraper_API SHALL update the existing record
4. THE Scraper_API SHALL only update Safe_Fields on existing Product_Records: last_verified (always), price (if changed), description (only if existing is empty), image_url (only if existing is empty)
5. THE Scraper_API SHALL never update Curated_Fields on existing Product_Records: status (except inactive rediscovery rule), interest_tags, gift_type_tags, quality_score, data_quality_flags, ai_classifications, notes, feedback, admin_feedback_reason, admin_feedback_note
6. WHEN an existing Product_Record has status "inactive" and is rediscovered in the current scrape, THE Scraper_API SHALL set status to "needs_review"
7. WHEN an existing Product_Record has status "inactive" and data_quality_flags contains "junk_title" or "editorial_not_product", THE Scraper_API SHALL not change status to "needs_review"
8. WHEN a scraped product URL key does not match any existing Product_Record, THE Scraper_API SHALL create a new Product_Record
9. THE Scraper_API SHALL set status to "needs_review" for all new Product_Records
10. THE Scraper_API SHALL set source_type to "shopify_upload" for new Shopify products and "curated_retailer" for new sitemap/crawl products
11. THE Scraper_API SHALL set added_date and last_verified to current date for new Product_Records
12. THE Scraper_API SHALL derive suitable_age_bands from retailer category, product name, description, and keywords using code-side logic (no AI)
13. THE Scraper_API SHALL resolve relative or protocol-relative image_url values against product_url and reject non-http(s) URLs
14. THE Scraper_API SHALL skip duplicate products within the same batch using in-memory URL key set

### Requirement 11: Batch Statistics and Response Format

**User Story:** As a frontend client, I want batch responses to include completion status and statistics, so that I can display progress and detect completion

#### Acceptance Criteria

1. THE Scraper_API SHALL return Batch_Response as JSON with top-level fields: done (boolean), cursor (string or null), batch (object), current_retailer (string or null), retailers_remaining (number)
2. THE Batch_Response.done field SHALL be true when all retailers are processed, false otherwise
3. THE Batch_Response.cursor field SHALL contain base64 Continuation_Token when done is false, null when done is true
4. THE Batch_Response.batch object SHALL contain: new_products (number), updated (number), skipped_duplicates (number), rejected (number), discovered (number), errors (array of strings), reject_reasons (object with normalized reason keys and counts)
5. THE Batch_Response.current_retailer field SHALL contain the name of the retailer being processed in this batch, null if none
6. THE Batch_Response.retailers_remaining field SHALL contain the count of retailers not yet processed
7. WHEN an error occurs, THE Scraper_API SHALL return HTTP 500 with JSON body containing error field with error message

### Requirement 12: Retailer Coverage Stamping

**User Story:** As an admin user, I want retailers to be stamped with coverage metadata after scraping, so that I can audit what was discovered and when

#### Acceptance Criteria

1. WHEN a retailer completes processing (all batches), THE Scraper_API SHALL write Coverage_Stamp to the Retailer_Record
2. THE Coverage_Stamp SHALL include: last_scrape_at (current timestamp), last_discovery_method (Discovery_Method enum), last_scrape_status (ScrapeStatus enum), last_scrape_error (string or null), last_scrape_products_found (number)
3. THE last_scrape_status SHALL be "ok" when products were discovered, "no_products" when zero products found, "error" when an error occurred, "skipped_no_source" when retailer has no website_url or gift_page_url
4. THE last_scrape_error SHALL contain the last error message encountered for the retailer, empty string when status is "ok" or "no_products"
5. THE last_scrape_products_found SHALL contain the sum of new_products and updated counts for the retailer across all batches
6. THE Scraper_API SHALL stamp Coverage_Stamp even when errors occur (best-effort, failures silently ignored)
7. THE Scraper_API SHALL only stamp "skipped_no_source" once per full run on the first batch, not on continuation batches

### Requirement 13: Forensics Logging

**User Story:** As an admin user, I want per-retailer completion records saved to ScrapeRunLog, so that I can audit historical scrape outcomes

#### Acceptance Criteria

1. WHEN a retailer completes processing, THE Scraper_API SHALL create a ScrapeRunLog_Record
2. THE ScrapeRunLog_Record SHALL include: run_date (current date), scope ("full" or "retailer"), retailer_id, retailer_name (denormalized), scrape_status (ScrapeRunStatus enum), discovery_method (Discovery_Method enum), new_products (count from cursor), updated (count from cursor), reject_reasons_json (JSON string of normalized reason tally from cursor), error (string or empty)
3. THE scope field SHALL be "retailer" when retailer_id was provided in request body, "full" otherwise
4. THE scrape_status field SHALL be "ok" when products were found, "no_products" when zero products found, "error" when an error occurred
5. THE reject_reasons_json field SHALL contain JSON-serialized object of normalized rejection reason counts accumulated in Continuation_Token for that retailer
6. THE Scraper_API SHALL create ScrapeRunLog_Record only when a retailer fully completes, not for partial batches
7. WHEN ScrapeRunLog creation fails, THE Scraper_API SHALL log the error but not fail the scrape batch

### Requirement 14: Retailer Scope Validation

**User Story:** As an admin user, I want invalid retailer_id values to be rejected before acquiring the lock, so that bad requests do not block concurrent scrapes

#### Acceptance Criteria

1. WHEN retailer_id is provided but is not a string, THE Scraper_API SHALL return HTTP 400 with error message before acquiring ScrapeState_Lock
2. WHEN retailer_id does not match any Retailer_Record, THE Scraper_API SHALL return HTTP 400 with error message before acquiring ScrapeState_Lock
3. WHEN retailer_id matches a Retailer_Record with active:false, THE Scraper_API SHALL return HTTP 400 with error message before acquiring ScrapeState_Lock
4. WHEN retailer_id matches a Retailer_Record with curated_only:true, THE Scraper_API SHALL return HTTP 400 with error message before acquiring ScrapeState_Lock
5. WHEN retailer_id matches a Retailer_Record with empty website_url and empty gift_page_url, THE Scraper_API SHALL return HTTP 400 with error message before acquiring ScrapeState_Lock
6. THE Scraper_API SHALL validate Continuation_Token scope: per-retailer tokens can only continue per-retailer requests, full-run tokens can only continue full-run requests
7. WHEN Continuation_Token scope mismatches the request, THE Scraper_API SHALL return HTTP 400 with error message before acquiring ScrapeState_Lock

### Requirement 15: Frontend Integration

**User Story:** As an admin user, I want the frontend scrape button to invoke the new Express endpoint, so that scraping works in standalone mode

#### Acceptance Criteria

1. THE Frontend_Client SHALL invoke POST /api/scrape/catalogue-batch with Content-Type application/json
2. THE Frontend_Client SHALL include retailer_id in request body for per-retailer scrapes
3. THE Frontend_Client SHALL include cursor in request body when resuming a paused scrape
4. THE Frontend_Client SHALL save returned cursor to localStorage keyed by retailer_id
5. THE Frontend_Client SHALL loop invoking Scraper_API until Batch_Response.done is true
6. THE Frontend_Client SHALL display batch progress: batch count, new_products, updated counts
7. THE Frontend_Client SHALL display completion toast when Batch_Response.done is true
8. THE Frontend_Client SHALL clear saved cursor from localStorage when scrape completes
9. WHEN Scraper_API returns HTTP 409, THE Frontend_Client SHALL display "scrape already running" message
10. WHEN Scraper_API returns HTTP 400 with "continuation token" error, THE Frontend_Client SHALL clear saved cursor and display restart message
11. THE Frontend_Client SHALL allow cooperative stop: set stopRef flag between batches, save cursor, display "stopped" toast

### Requirement 16: Gemini Client Integration

**User Story:** As a developer, I want the scraper to use the existing Gemini client, so that AI extraction is consistent with gift generation

#### Acceptance Criteria

1. THE Scraper_API SHALL import and instantiate Gemini_Client from server/services/ai/gemini-client.js
2. THE Scraper_API SHALL pass GEMINI_API_KEY from environment to Gemini_Client constructor
3. WHEN GEMINI_API_KEY is missing, THE Scraper_API SHALL proceed with scraping but skip AI fallback extractions
4. THE Scraper_API SHALL call Gemini_Client.generateContent with extraction prompt and HTML for AI extraction
5. THE Scraper_API SHALL handle Gemini_Client errors gracefully and reject products with normalized reason
6. THE Scraper_API SHALL apply 30-second timeout to AI extraction calls

### Requirement 17: Database Bulk Operations

**User Story:** As a developer, I want products to be upserted in bulk, so that scraping is performant for large catalogues

#### Acceptance Criteria

1. THE Scraper_API SHALL accumulate Product_Record creates in an in-memory array during batch processing
2. THE Scraper_API SHALL accumulate Product_Record updates in an in-memory array during batch processing
3. THE Scraper_API SHALL flush pending creates and updates to database in chunks of 200 using Prisma bulkCreate/bulkUpdate or equivalent
4. THE Scraper_API SHALL flush pending operations before returning Batch_Response
5. THE Scraper_API SHALL flush pending operations when batch deadline is reached
6. THE Scraper_API SHALL clear pending arrays after successful flush

### Requirement 18: Error Handling and Recovery

**User Story:** As an admin user, I want scraping errors to be isolated per retailer, so that one failing retailer does not abort the entire run

#### Acceptance Criteria

1. WHEN a retailer fetch or parse operation fails, THE Scraper_API SHALL log the error, increment batch errors count, and continue to next retailer
2. THE Scraper_API SHALL capture last error message per retailer in Continuation_Token
3. THE Scraper_API SHALL stamp last_scrape_error on Retailer_Record with the captured error message
4. THE Scraper_API SHALL create ScrapeRunLog_Record with scrape_status "error" and error field populated when a retailer fails
5. THE Scraper_API SHALL release ScrapeState_Lock in finally block even when unhandled errors occur
6. WHEN database operations fail, THE Scraper_API SHALL return HTTP 500 and release lock

### Requirement 19: Scheduled Scraping Integration

**User Story:** As an admin user, I want scheduled scraping to continue working via the new Express endpoint, so that monthly catalog refresh still happens

#### Acceptance Criteria

1. THE Express server SHALL provide a POST /api/scrape/monthly endpoint for scheduled operations
2. THE /api/scrape/monthly endpoint SHALL require admin authentication
3. THE /api/scrape/monthly endpoint SHALL acquire ScrapeState_Lock with heartbeat recovery
4. THE /api/scrape/monthly endpoint SHALL execute Phase A: availability checking (HEAD/GET requests, flag inactive products)
5. THE /api/scrape/monthly endpoint SHALL execute Phase B: invoke POST /api/scrape/catalogue-batch in loop until done
6. THE /api/scrape/monthly endpoint SHALL execute Phase C: optionally invoke enrichment batch (if implemented)
7. THE /api/scrape/monthly endpoint SHALL release ScrapeState_Lock on completion or error
8. THE /api/scrape/monthly endpoint SHALL return JSON summary with counts: checkedCount, inactiveCount, newProductsCount

### Requirement 20: Migration Path

**User Story:** As a developer, I want to cleanly remove Base44 function calls, so that the app runs fully standalone

#### Acceptance Criteria

1. THE Frontend_Client SHALL replace base44.functions.invoke("scrapeCatalogueBatch") with fetch POST /api/scrape/catalogue-batch
2. THE Express server SHALL remove all imports and references to @base44/sdk
3. THE Express server SHALL handle authentication via existing session/JWT mechanism instead of base44.auth.me()
4. THE Express server SHALL use Prisma client exclusively for database operations instead of base44 entities
5. THE Express server SHALL preserve all existing functional behavior including discovery methods, validation rules, preservation rules, and forensics logging
