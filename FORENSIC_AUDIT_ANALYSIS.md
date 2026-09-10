# Forensic Audit Feature - Deep Analysis

## Overview

The **"Run Forensic Audit"** feature in the Audit tab is a comprehensive catalogue health check system that analyzes the entire product database and retailer coverage without making any changes to the data.

---

## What It Does

### Primary Purpose
The forensic audit performs a **read-only analysis** of the entire product catalogue and classifies every product into quality buckets while grading each retailer's coverage. It's essentially a diagnostic tool that tells you:
- Which products are healthy
- Which products need attention
- Which products were correctly rejected
- Which retailers need re-scraping

### Key Characteristics
- **Read-only**: Never modifies your catalogue data
- **Comprehensive**: Analyzes up to 5,000 products in one run
- **Evidence-based**: Uses durable evidence from the database (no network probes, no AI calls)
- **Optional reporting**: Can export detailed results to a Google Sheet

---

## The Four Product Buckets

The audit classifies every product into one of four categories:

### 1. **Healthy (Active)**
- Products that are active and have no issues
- Nothing needs to be done with these
- They have:
  - Valid names and URLs
  - Proper enrichment (descriptions, images, tags)
  - Active status
  - No quality flags

### 2. **Correctly Rejected**
- Junk products that the scraper was right to refuse
- These include:
  - **Failed validation**: Products that don't pass the scraper's heuristics
  - **Junk title flags**: Titles that match junk patterns
  - **Editorial content**: Non-product pages (articles, blogs, category pages)
  - **Duplicate URLs**: Multiple products with the same URL within a retailer
  - **URL patterns**: URLs matching non-product patterns like `/cart`, `/account`, `/login`, `/checkout`, `/terms`, `/privacy`, etc.

**Important Exception**: Products manually added as "curated_product" are NEVER auto-classified as correctly rejected, even if they trip scraper heuristics. They go to manual review instead.

### 3. **Needs Manual Review**
- The most important bucket requiring human attention
- Includes:
  - **Products awaiting review** (status: `needs_review`)
  - **Reported broken** (status: `reported_broken`)
  - **Inactive with no reason** (status: `inactive` but no recorded removal reason)
  - **Curated products that fail heuristics**: Your hand-picked products that trip the scraper's junk detection (these are flagged for you to verify, not auto-rejected)
  - **Curated duplicates**: Multiple curated products with the same URL

### 4. **Needs Re-Enrichment**
- Products that have not been properly enriched with metadata
- Issues include:
  - **Never enriched**: No `catalogue_enriched_at` timestamp
  - **Missing description**: Flagged with `missing_description`
  - **Missing image**: Flagged with `missing_image`
- **Action**: Run the Enrich function for the affected retailer, then re-run the audit

---

## Retailer Coverage Grading

The audit also evaluates each retailer and assigns a verdict:

### Coverage Verdicts

1. **OK** - Retailer is healthy and has sufficient products
2. **Needs Rescrape** - One or more issues:
   - Total products is 0
   - Active + needs_review count is below the threshold (10 products)
   - Last scrape status was "error" or "no_products"
   - Discovery method was "crawl" or "none" (weaker methods)
   - Coverage gap exists (expected products > actual reviewable products)
3. **No Source** - Retailer has no `website_url` or `gift_page_url`
4. **Inactive Retailer** - Retailer's `active` flag is false
5. **Curated Only** - Retailer is marked as `curated_only` (manually managed)

### Coverage Metrics Tracked
For each retailer, the audit reports:
- **Total products**
- **Active products**
- **Products needing review**
- **Inactive products**
- **Reported broken products**
- **Expected products found** (from scrape logs)
- **Coverage gap** (difference between expected and reviewable)
- **Last scrape status**
- **Discovery method** (sitemap, crawl, etc.)
- **Last scrape error message**
- **Rejection reason tallies** (why products were rejected during scraping)

---

## Classification Logic

### Product Classification Process

```javascript
// Simplified logic flow:
function classifyProduct(product) {
  const isCurated = product.source_type === "curated_product";
  
  // Rule 1: Scraper heuristic failures
  if (failsValidation || hasJunkTitleFlag || hasEditorialFlag) {
    if (isCurated) {
      return "needs_manual_review" // Never auto-reject curated items
    }
    return "correctly_rejected"
  }
  
  // Rule 2: Duplicate URL within retailer
  if (isDuplicate) {
    if (isCurated) {
      return "needs_manual_review"
    }
    return "correctly_rejected"
  }
  
  // Rule 3: Inactive with no recorded reason
  if (status === "inactive") {
    return "needs_manual_review"
  }
  
  // Rule 4: Enrichment issues
  if (!catalogue_enriched_at || hasMissingDescriptionFlag || hasMissingImageFlag) {
    return "needs_re_enrichment"
  }
  
  // Rule 5: Awaiting human action
  if (status === "needs_review" || status === "reported_broken") {
    return "needs_manual_review"
  }
  
  // Everything else is healthy
  return "healthy"
}
```

### Key Detection Patterns

**Non-Product URL Patterns:**
```javascript
const NON_PRODUCT_PATTERNS = [
  "/account", "/login", "/basket", "/cart", "/checkout",
  "/careers", "/press", "/terms", "/privacy", "/returns",
  "/delivery", "/faq", "/help", "/wishlist", "/blog",
  "/blogs", "/pages", "/collections", "/search", "/about"
];
```

**Duplicate Detection:**
- Uses a normalized URL key: `${hostname}${pathname}` (lowercased, trailing slash removed)
- Checks within each retailer's products
- Keeps the oldest product (by `created_date`), marks others as duplicates

---

## Google Sheet Export (Optional)

### When Enabled
If you check **"Also overwrite the Google Sheet"**, the audit will:

1. **Find or create** a Google Sheet named **"Scrape Forensics"** in your Drive
2. **Clear** everything on two tabs: `Products` and `Coverage`
3. **Write** the complete audit results

### Sheet Structure

**Products Tab Columns:**
- product_id
- name
- retailer
- status
- source_type
- enriched (yes/no)
- data_quality_flags
- bucket (classification)
- reasons (why it was classified this way)
- price
- product_url

**Coverage Tab Columns:**
- retailer
- verdict
- active (TRUE/FALSE)
- curated_only (TRUE/FALSE)
- has_source (TRUE/FALSE)
- products_total
- active_products
- needs_review
- inactive
- reported_broken
- correctly_rejected
- needs_manual_review
- needs_re_enrichment
- expected_found
- coverage_gap
- last_scrape_status
- discovery_method
- reject_reasons (JSON)
- last_scrape_error

### Important Sheet Behavior
- The sheet is a **snapshot**, not a history log
- Each run **completely replaces** the previous data
- Anything manually typed into the sheet is lost on the next run
- If sheet writing fails, you still get the complete audit on-screen

---

## User Interface

### Audit Tab Location
In the Admin Dashboard, accessible via the "Audit" tab

### UI Elements

1. **Title**: "Catalogue audit"
2. **Checkbox**: "Also overwrite the Google Sheet" (unchecked by default)
3. **Run Button**: "Run forensics audit" (shows "Auditing…" when running)
4. **Description**: Clear explanation of what the audit does

### Results Display

When complete, shows:

**Summary Stats (Grid):**
- Total products
- Correctly rejected count
- Needs manual review count
- Needs re-enrichment count
- Healthy (active) count
- Retailers needing rescrape
- Retailers without source URLs
- Run-log rows available

**Retailer Coverage Table:**
- Sortable table with all retailers
- Color-coded verdict badges:
  - Green (ok)
  - Red (needs_rescrape)
  - Amber (no_source)
  - Gray (inactive_retailer)
  - Gold (curated_only)

**Sample Examples:**
- First 15 items from each problem bucket
- Shows: product name, retailer, status, and reasons

**Notes Section:**
- Important caveats about the audit
- Guidance on interpreting results

---

## Data Sources

### Primary Entities Read

1. **Product** entity (up to 5,000 newest products):
   - name
   - product_url
   - status (active, needs_review, inactive, reported_broken)
   - source_type (curated_product vs catalogue)
   - data_quality_flags array
   - catalogue_enriched_at timestamp
   - retailer_id
   - price

2. **Retailer** entity (all retailers):
   - name
   - active flag
   - curated_only flag
   - website_url
   - gift_page_url
   - last_scrape_status (Layer-C, may not exist pre-publish)
   - last_scrape_products_found (Layer-C, may not exist pre-publish)
   - last_scrape_error (Layer-C, may not exist pre-publish)
   - last_discovery_method (Layer-C, may not exist pre-publish)

3. **ScrapeRunLog** entity (all logs, newest first):
   - retailer_id
   - created_date
   - scrape_status
   - new_products
   - updated
   - discovery_method
   - error
   - reject_reasons_json (JSON string with reason counts)

### Layer-C Considerations
- Some Retailer fields and the entire ScrapeRunLog entity are "Layer-C" (publish-gated)
- Pre-publish, these may not exist
- The audit gracefully handles missing data:
  - Tries to read stamps from Retailer first
  - Falls back to ScrapeRunLog if available
  - Shows "—" (dash) for unknown values instead of "0"
  - Continues working even if ScrapeRunLog entity doesn't exist

---

## Technical Implementation

### Backend Function
**Location:** `base44/functions/auditScrapeForensics/entry.ts`

**Function:** `auditScrapeForensics`

**Parameters:**
```javascript
{
  write_sheet: boolean // Optional, default false
}
```

**Response:**
```javascript
{
  generated_at: "ISO timestamp",
  totals: {
    products: number,
    pool_truncated: boolean, // true if hit 5000 limit
    healthy: number,
    correctly_rejected: number,
    needs_manual_review: number,
    needs_re_enrichment: number,
    retailers: number,
    retailers_needing_rescrape: number,
    retailers_no_source: number,
    run_log_rows: number
  },
  coverage: [
    {
      retailer_id: string,
      name: string,
      active: boolean,
      curated_only: boolean,
      has_source: boolean,
      counts: { /* status/bucket counters */ },
      expected_found: number | null,
      coverage_gap: number | null,
      last_scrape_status: string,
      discovery_method: string,
      last_scrape_error: string,
      reject_reasons: object,
      verdict: string
    }
    // ... one per retailer
  ],
  examples: {
    correctly_rejected: [/* first 15 */],
    needs_manual_review: [/* first 15 */],
    needs_re_enrichment: [/* first 15 */]
  },
  sheet: {
    spreadsheet_id: string,
    product_rows: number,
    coverage_rows: number
  } | { error: string } | null,
  notes: [
    "Per-URL rejection reasons...",
    "Retailer scrape stamps...",
    "needs_re_enrichment rows...",
    "Curated rows...",
    "The retailer coverage grade..."
  ]
}
```

### Frontend Component
**Location:** `src/components/admin/ForensicsAuditPanel.jsx`

**API Call:**
```javascript
await base44.functions.invoke("auditScrapeForensics", { 
  write_sheet: writeSheet 
});
```

---

## Use Cases & When to Run

### Primary Use Cases

1. **Before a major scraping session**
   - Identify which retailers need re-scraping
   - Find retailers with missing source URLs
   - Check overall catalogue health

2. **After enrichment runs**
   - Verify that enrichment fixed missing data
   - See products migrate from "needs_re_enrichment" to "healthy"

3. **When the catalogue "feels wrong"**
   - Diagnose quality issues
   - Find patterns in rejections
   - Identify systematic problems

4. **Regular health checks**
   - Weekly or monthly catalogue review
   - Monitor retailer coverage trends
   - Catch issues early

5. **Before making major changes**
   - Baseline measurement
   - Understand current state
   - Plan remediation work

### Operator Manual Guidance

From the help documentation:

> "Use the Audit tab when the catalogue 'feels wrong' and you want to know where to spend an hour, or before a big scraping session."

> "Everything looks fine but gift lists feel poor? Run the Audit tab, look at 'Needs re-enrichment' and at the shops graded 'needs a re-scrape', and fix those first. Thin, untagged stock is the usual cause."

---

## Important Notes & Caveats

### From the Audit Response Notes:

1. **Historical Rejection Reasons**: Per-URL rejection reasons for runs before ScrapeRunLog was implemented were never persisted and are unrecoverable. Reason tallies only appear for runs made after ScrapeRunLog went live (post-publish).

2. **Pre-Publish Behavior**: Retailer scrape stamps are publish-gated fields. Before publish, the expected/actual comparison uses product counts and heuristics only.

3. **Re-Enrichment Workflow**: For products in "needs_re_enrichment", run the Enrich function for the affected retailers (via Retailers tab), then re-run this audit. Rows will migrate to "needs_manual_review" once enriched.

4. **Curated Product Protection**: Curated rows (source_type = "curated_product") are never auto-bucketed as "correctly rejected". Scraper-heuristic hits on them are advisory (curated_fails_scraper_heuristics / curated_duplicate_url). Always verify with the product curator before retiring anything manually supplied.

5. **Coverage Counting Difference**: The retailer coverage grade counts active + needs_review against the threshold of 10. The Retailers tab's "Underfilled" badge counts actives only. These two surfaces can legitimately disagree on retailers with many unreviewed rows.

6. **5,000 Product Cap**: The audit reads up to 5,000 products (newest first). If your catalogue exceeds this, `pool_truncated: true` will be set, and the audit only covers the newest 5,000.

7. **Sheet Writing is Destructive**: When sheet writing is enabled, it completely clears and rewrites the "Scrape Forensics" spreadsheet. It's a snapshot, not an append operation. Any manual notes in the sheet are lost.

8. **Best-Effort Sheet Writing**: If the Google Sheet write fails, you still get the complete audit results on-screen. The sheet is supplementary, not essential.

---

## Comparison to Other Admin Features

### vs. "Re-run Scrape" (Link Checker)
- **Audit**: Read-only analysis, no changes
- **Link Checker**: Actively checks URLs, retires dead products

### vs. "Enrich Catalogue"
- **Audit**: Identifies products needing enrichment
- **Enrich**: Actually fixes missing tags, descriptions, images

### vs. "Full Catalogue Scrape"
- **Audit**: Analyzes existing products
- **Scrape**: Fetches new/updated products from retailer websites

### vs. "Insights Tab"
- **Audit**: Product quality and retailer coverage
- **Insights**: User feedback, purchase/love/reject stats, trends

---

## Workflow Example

Typical workflow using the forensic audit:

1. **Run the audit** (sheet writing OFF for quick check)
2. **Review the summary stats** - identify major issues
3. **Check "Needs manual review"** examples - look for patterns
4. **Check "Needs re-enrichment"** - note which retailers
5. **Review retailer coverage table** - find "needs_rescrape" retailers
6. **Take action**:
   - Run Enrich for retailers with enrichment gaps
   - Re-scrape retailers marked "needs_rescrape"
   - Fix retailers with "no_source" (add URLs in Retailers tab)
7. **Run audit again with sheet writing ON** - get full detail
8. **Work through the Google Sheet** - systematically fix issues
9. **Final audit run** - verify improvements

---

## Security & Permissions

- **Admin only**: Requires `role === "admin"`
- **Read-only by default**: No data is modified unless sheet writing is enabled
- **Google OAuth required**: For sheet writing, uses the connected Google Sheets connector
- **Authentication**: Uses Base44 auth tokens from session

---

## Performance Characteristics

- **Read limits**: 5,000 products, all retailers, all ScrapeRunLogs
- **Processing**: Single-pass classification (no batching needed)
- **Network calls**: None to external sites (except Google Sheets API if writing)
- **Typical duration**: Seconds for small catalogues, ~10-30 seconds for 5,000 products
- **Sheet writing**: Adds 5-15 seconds depending on row count

---

## Summary

The **"Run Forensic Audit"** feature is a powerful diagnostic tool that:

✅ **Analyzes** every product in your catalogue  
✅ **Classifies** them into actionable quality buckets  
✅ **Grades** each retailer's coverage and health  
✅ **Identifies** specific issues with clear reasons  
✅ **Protects** curated products from auto-rejection  
✅ **Never modifies** your data (read-only)  
✅ **Exports** detailed results to Google Sheets (optional)  
✅ **Provides** clear next steps for remediation  

It's the first tool you should reach for when diagnosing catalogue quality issues or planning data maintenance work.
