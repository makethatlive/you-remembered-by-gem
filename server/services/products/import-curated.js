/**
 * Curated Product Import Service
 * Simplified version for CSV/XLSX file imports
 * Full Google Sheets integration can be added later
 */

import XLSX from 'xlsx';
import fs from 'fs';

const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15MB max
const BATCH_SIZE = 40; // Process 40 rows at a time
const PREFERRED_SHEET = "curated product list";
const HEADER_SCAN_ROWS = 5;

// Accepted column name spellings (after normalization)
const HEADER_SYNONYMS = {
  name: ["name", "product name", "product", "item name", "item"],
  product_url: ["product_url", "url", "link", "product link", "product url"],
  image_url: ["image_url", "image", "image link", "image url"],
  price: ["price", "price (gbp)", "price gbp", "price (£)"],
  retailer_name: ["retailer_name", "retailer", "shop", "site"],
  description: ["description", "blurb"],
  category: ["category", "interest category"],
  gender_applies_to: ["gender_applies_to", "gender", "for"],
  age_bands: ["age_bands", "suitable_age_bands", "ages", "age"],
  interest_tags: ["interest_tags", "interests", "interest tags"],
  gift_type_tags: ["gift_type_tags", "gift types", "gift type tags"],
  search_keywords: ["search_keywords", "keywords", "personality tags"],
};

const REQUIRED_HEADERS = ["name", "product_url", "price", "retailer_name"];

const AGE_BAND_ENUM = ["Under 5", "5-10", "11-17", "18+"];

// Age vocabulary from sheets
const SHEET_AGE_MAP = {
  "kids": ["Under 5", "5-10", "11-17"],
  "children": ["Under 5", "5-10", "11-17"],
  "child": ["Under 5", "5-10", "11-17"],
  "baby": ["Under 5"],
  "toddler": ["Under 5"],
  "young child": ["Under 5", "5-10"],
  "9-11": ["5-10", "11-17"],
  "teen": ["11-17"],
  "teenager": ["11-17"],
  "adult": ["18+"],
  "adults": ["18+"],
};

/**
 * Normalize header labels
 */
function normalizeHeader(label) {
  return String(label ?? "")
    .toLowerCase()
    .replace(/▸\s*optional/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Build header map from row
 */
function buildHeaderMap(headerRow) {
  const map = new Map();
  for (let c = 0; c < headerRow.length; c++) {
    const label = normalizeHeader(headerRow[c]);
    if (!label) continue;
    for (const [canonical, synonyms] of Object.entries(HEADER_SYNONYMS)) {
      if (synonyms.includes(label) && !map.has(canonical)) {
        map.set(canonical, c);
      }
    }
  }
  return map;
}

/**
 * Normalize URL
 */
function normalizeUrl(url) {
  try {
    const u = new URL(String(url || "").trim());
    return u.href;
  } catch {
    return "";
  }
}

/**
 * Split comma/semicolon separated list
 */
function splitList(value) {
  return String(value || "").split(/[,|;]/).map((part) => part.trim()).filter(Boolean);
}

/**
 * Parse uploaded file (CSV or XLSX)
 */
async function parseUploadedFile(fileUrl) {
  console.log(`📄 Reading uploaded file from: ${fileUrl}`);
  
  // The file URL is a local file path from multer upload
  let fileBytes;
  
  try {
    const buffer = fs.readFileSync(fileUrl);
    fileBytes = new Uint8Array(buffer);
    console.log(`   ✅ Read ${fileBytes.length} bytes from file`);
  } catch (e) {
    throw new Error(`Could not read uploaded file: ${e.message}. Re-upload and try again.`);
  }
  if (fileBytes.byteLength > MAX_FILE_BYTES) {
    throw new Error("Uploaded file is larger than 15 MB. Export just the product tab and upload that.");
  }
  
  let workbook;
  try {
    workbook = XLSX.read(fileBytes, { type: "array", raw: false });
  } catch (e) {
    throw new Error(`Could not parse the uploaded file as .xlsx or .csv (${e.message}). Download the template and paste your rows into it.`);
  }
  
  const sheetNames = workbook.SheetNames || [];
  if (sheetNames.length === 0) {
    throw new Error("The uploaded workbook contains no sheets.");
  }
  
  // Convert sheet to array of arrays
  const gridFor = (name) =>
    XLSX.utils.sheet_to_json(workbook.Sheets[name], { 
      header: 1, 
      raw: false, 
      defval: "", 
      blankrows: true 
    });
  
  // Scan for header row
  const scanSheet = (name) => {
    const grid = gridFor(name);
    const limit = Math.min(grid.length, HEADER_SCAN_ROWS);
    for (let rix = 0; rix < limit; rix++) {
      const map = buildHeaderMap(grid[rix] || []);
      if (REQUIRED_HEADERS.every((h) => map.has(h))) {
        return { grid, headerRowIdx: rix, map };
      }
    }
    return null;
  };
  
  // Find the right sheet
  let picked = null;
  let pickedName = "";
  
  const preferred = sheetNames.find((n) => normalizeHeader(n) === PREFERRED_SHEET);
  for (const name of preferred ? [preferred, ...sheetNames.filter((n) => n !== preferred)] : sheetNames) {
    picked = scanSheet(name);
    if (picked) { 
      pickedName = name; 
      break; 
    }
  }
  
  if (!picked) {
    throw new Error(
      `No sheet in this workbook has the required columns (${REQUIRED_HEADERS.join(", ")}) ` +
      `in its first ${HEADER_SCAN_ROWS} rows. Sheets found: ${sheetNames.join(", ")}. ` +
      `Download the template and paste your rows into it.`
    );
  }
  
  const headerMap = picked.map;
  const allRows = picked.grid.slice(picked.headerRowIdx + 1);
  
  console.log(`   ✅ Found sheet "${pickedName}" with ${allRows.length} data rows`);
  
  return { headerMap, allRows };
}

/**
 * Process a batch of rows
 */
export async function importCuratedBatch(prisma, { fileUrl, startRow, batchSize, expectedTotal }) {
  console.log(`📦 Import batch: start_row=${startRow}, batch_size=${batchSize}`);
  
  // Parse the file
  const { headerMap, allRows } = await parseUploadedFile(fileUrl);
  
  const extractedTotal = allRows.length;
  
  // Validate row count stability (for continuation batches)
  if (expectedTotal > 0 && extractedTotal !== expectedTotal) {
    throw new Error(
      `Re-reading the uploaded file returned ${extractedTotal} data row(s) this time ` +
      `but ${expectedTotal} on an earlier batch. Click Start Import again to restart.`
    );
  }
  
  // Get the batch slice
  const rows = allRows.slice(startRow - 2, startRow - 2 + batchSize);
  
  if (rows.length === 0) {
    return {
      done: true,
      next_row: startRow,
      processed: 0,
      extracted_total: extractedTotal,
      created_active: 0,
      created_needs_review: 0,
      updated_existing: 0,
      matched_existing: 0,
      fields_filled: 0,
      created_retailers: [],
      unknown_categories: [],
      unknown_genders: [],
      skipped: [],
    };
  }
  
  // Helper to get cell value
  const cell = (row, header) => String(row[headerMap.get(header)] ?? "").trim();
  
  // Fetch existing products and retailers
  const existingProducts = await prisma.product.findMany({
    select: { id: true, productUrl: true, affiliateUrl: true },
    take: 5000,
  });
  
  const existingByUrl = new Map();
  for (const p of existingProducts) {
    for (const raw of [p.productUrl, p.affiliateUrl]) {
      if (!raw) continue;
      const key = normalizeUrl(raw);
      if (key && !existingByUrl.has(key)) {
        existingByUrl.set(key, p);
      }
    }
  }
  
  const retailers = await prisma.retailer.findMany({
    select: { id: true, name: true, category: true, curatedOnly: true },
    take: 5000,
  });
  
  const retailerByName = new Map();
  for (const r of retailers) {
    const key = String(r.name || "").toLowerCase().trim();
    if (key) retailerByName.set(key, r);
  }
  
  // Process rows
  const skipped = [];
  const updates = [];
  const createdRetailers = [];
  const unknownCategories = [];
  const unknownGenders = [];
  
  let createdActive = 0;
  let createdNeedsReview = 0;
  let updatedExisting = 0;
  let matchedExisting = 0;
  let fieldsFilled = 0;
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] || [];
    const absoluteRow = startRow + i;
    
    const name = cell(row, "name");
    const rawUrl = cell(row, "product_url");
    const rawPrice = cell(row, "price");
    const retailerName = cell(row, "retailer_name");
    
    // Skip blank rows
    if (!name && !rawUrl && !rawPrice && !retailerName) continue;
    
    // Validate name
    if (name.length < 4) {
      skipped.push({ row: absoluteRow, name, reason: "name missing/too short" });
      continue;
    }
    
    // Validate URL
    const canonical = normalizeUrl(rawUrl);
    if (!canonical) {
      skipped.push({ row: absoluteRow, name, reason: "invalid URL" });
      continue;
    }
    
    // Validate price
    const price = Number(rawPrice.replace(/[£,\s]/g, ""));
    if (!Number.isFinite(price) || price <= 0 || price > 10000) {
      skipped.push({ row: absoluteRow, name, reason: "invalid price" });
      continue;
    }
    
    // Get or create retailer
    const retailerKey = retailerName.toLowerCase().trim();
    let retailer = retailerByName.get(retailerKey);
    
    if (!retailer) {
      // Auto-create retailer
      let origin = "";
      try { origin = new URL(canonical).origin; } catch { origin = ""; }
      
      if (!origin) {
        skipped.push({ row: absoluteRow, name, reason: `could not derive website URL for retailer "${retailerName}"` });
        continue;
      }
      
      try {
        retailer = await prisma.retailer.create({
          data: {
            name: retailerName.trim(),
            websiteUrl: origin,
            category: "UNISEX_ADULT", // Use the correct Prisma enum value
            active: true,
            curatedOnly: true,
          }
        });
        
        retailerByName.set(retailerKey, retailer);
        createdRetailers.push({ 
          name: retailer.name, 
          category: retailer.category, 
          website_url: origin 
        });
        
        console.log(`   ✨ Created retailer: ${retailer.name}`);
      } catch (e) {
        skipped.push({ row: absoluteRow, name, reason: `retailer auto-create failed: ${e.message}` });
        continue;
      }
    }
    
    // Parse other fields
    const description = cell(row, "description").slice(0, 1000);
    const category = cell(row, "category");
    const imageUrl = cell(row, "image_url");
    const genderRaw = cell(row, "gender_applies_to");
    
    // Map gender
    let gender = "UNISEX";
    if (genderRaw) {
      const g = genderRaw.toLowerCase().trim();
      if (g === "male" || g === "men" || g === "man" || g === "boys") gender = "MALE";
      else if (g === "female" || g === "women" || g === "woman" || g === "girls") gender = "FEMALE";
    }
    
    // Parse age bands
    const rawAgeBands = splitList(cell(row, "age_bands"));
    const ageBands = [...new Set(
      rawAgeBands.flatMap((b) => {
        const key = b.toLowerCase().trim();
        return SHEET_AGE_MAP[key] || (AGE_BAND_ENUM.includes(b) ? [b] : []);
      })
    )];
    
    const interestTags = splitList(cell(row, "interest_tags")).slice(0, 15);
    const giftTypeTags = splitList(cell(row, "gift_type_tags")).slice(0, 15);
    const searchKeywords = splitList(cell(row, "search_keywords")).slice(0, 15);
    
    // Check if product exists
    const existing = existingByUrl.get(canonical);
    
    if (existing) {
      // Update only empty fields
      matchedExisting++;
      
      const patch = {};
      let filled = 0;
      
      const existingProduct = await prisma.product.findUnique({
        where: { id: existing.id }
      });
      
      if (!existingProduct.description && description) { patch.description = description; filled++; }
      if (!existingProduct.imageUrl && imageUrl) { patch.imageUrl = imageUrl; filled++; }
      if (!existingProduct.category && category) { patch.category = category; filled++; }
      if (interestTags.length > 0 && (!existingProduct.interestTags || existingProduct.interestTags.length === 0)) {
        patch.interestTags = interestTags;
        filled++;
      }
      if (giftTypeTags.length > 0 && (!existingProduct.giftTypeTags || existingProduct.giftTypeTags.length === 0)) {
        patch.giftTypeTags = giftTypeTags;
        filled++;
      }
      
      if (Object.keys(patch).length > 0) {
        await prisma.product.update({
          where: { id: existing.id },
          data: patch,
        });
        updatedExisting++;
        fieldsFilled += filled;
        console.log(`   📝 Updated existing: ${name}`);
      }
    } else {
      // Create new product
      try {
        const newProduct = await prisma.product.create({
          data: {
            name,
            description,
            productUrl: canonical,
            imageUrl: imageUrl || null,
            price,
            retailerId: retailer.id,
            category: category || null,
            genderAppliesTo: gender,
            suitableAgeBands: ageBands.length > 0 ? ageBands : ["18+"],
            interestTags: interestTags,
            giftTypeTags: giftTypeTags,
            searchKeywords: searchKeywords,
            sourceType: "CURATED_PRODUCT",
            status: "NEEDS_REVIEW",
            addedDate: new Date(),
          }
        });
        
        createdNeedsReview++;
        console.log(`   ✅ Created: ${name}`);
      } catch (e) {
        skipped.push({ row: absoluteRow, name, reason: `create failed: ${e.message}` });
      }
    }
  }
  
  const processed = rows.length;
  const nextRow = startRow + processed;
  const done = nextRow > allRows.length + 1;
  
  console.log(`   📊 Batch complete: ${processed} processed, ${createdNeedsReview} created, ${updatedExisting} updated, ${skipped.length} skipped`);
  
  return {
    done,
    next_row: nextRow,
    processed,
    extracted_total: extractedTotal,
    created_active: createdActive,
    created_needs_review: createdNeedsReview,
    updated_existing: updatedExisting,
    matched_existing: matchedExisting,
    fields_filled: fieldsFilled,
    created_retailers: createdRetailers,
    unknown_categories: unknownCategories,
    unknown_genders: unknownGenders,
    skipped,
  };
}
