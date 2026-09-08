import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const SHEET_TITLE = "Gem Product Review";
const TAB = "Sheet1";

// Exact header order requested. last_verified_date column is sourced from Product.last_verified.
const HEADERS = [
  "product_id",
  "name",
  "description",
  "price",
  "image_url",
  "affiliate_url",
  "retailer_name",
  "gender_applies_to",
  "age_restricted",
  "status",
  "last_verified_date",
  "notes",
];

// Find an existing "Gem Product Review" spreadsheet in Gem's Drive, or create one with headers.
async function getOrCreateSpreadsheet(accessToken) {
  const authHeader = { Authorization: `Bearer ${accessToken}` };

  const query = encodeURIComponent(
    `name='${SHEET_TITLE}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`
  );
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)&spaces=drive`,
    { headers: authHeader }
  );
  if (!searchRes.ok) {
    throw new Error(`Drive search failed: HTTP ${searchRes.status} ${await searchRes.text()}`);
  }
  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  // Not found — create it.
  const createRes = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
    method: "POST",
    headers: { ...authHeader, "Content-Type": "application/json" },
    body: JSON.stringify({ properties: { title: SHEET_TITLE } }),
  });
  if (!createRes.ok) {
    throw new Error(`Sheet create failed: HTTP ${createRes.status} ${await createRes.text()}`);
  }
  const created = await createRes.json();
  const spreadsheetId = created.spreadsheetId;

  // Write header row.
  const headerRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${TAB}!A1?valueInputOption=RAW`,
    {
      method: "PUT",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ values: [HEADERS] }),
    }
  );
  if (!headerRes.ok) {
    throw new Error(`Header write failed: HTTP ${headerRes.status} ${await headerRes.text()}`);
  }

  return spreadsheetId;
}

// Read the product_id column (column A, below the header) to know what's already in the sheet.
async function getExistingProductIds(accessToken, spreadsheetId) {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${TAB}!A2:A`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) {
    throw new Error(`Read existing rows failed: HTTP ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  const ids = new Set();
  for (const row of data.values || []) {
    if (row[0]) ids.add(String(row[0]));
  }
  return ids;
}

function productToRow(p, retailerName) {
  return [
    p.id,
    p.name || "",
    p.description || "",
    p.price ?? "",
    p.image_url || "",
    p.affiliate_url || "",
    retailerName || "",
    p.gender_applies_to || "",
    p.age_restricted === true ? "TRUE" : "FALSE",
    p.status || "",
    p.last_verified || "", // sheet column last_verified_date <- Product.last_verified
    p.notes || "",
  ];
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;

    // Called from scrapeRetailerProducts, which forwards the same authenticated request —
    // so a failed auth check here must always reject outright, never fall back to "allowed".
    const user = await base44.auth.me().catch(() => null);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.role !== "admin") {
      return Response.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const { accessToken } = await svc.connectors.getConnection("googlesheets");

    const spreadsheetId = await getOrCreateSpreadsheet(accessToken);
    const existingIds = await getExistingProductIds(accessToken, spreadsheetId);

    const products = await svc.entities.Product.filter({ status: "needs_review" }, "-created_date", 5000);

    // Resolve retailer names for mapping.
    const retailerIds = [...new Set(products.map((p) => p.retailer_id).filter(Boolean))];
    const retailerNameById = new Map();
    for (const rid of retailerIds) {
      let retailer = null;
      try {
        retailer = await svc.entities.Retailer.get(rid);
      } catch {
        retailer = null;
      }
      retailerNameById.set(rid, retailer?.name || "");
    }

    // Build rows only for products not already in the sheet.
    const newRows = [];
    for (const p of products) {
      if (existingIds.has(String(p.id))) continue;
      newRows.push(productToRow(p, retailerNameById.get(p.retailer_id)));
    }

    if (newRows.length > 0) {
      const appendRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${TAB}!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ values: newRows }),
        }
      );
      if (!appendRes.ok) {
        throw new Error(`Append failed: HTTP ${appendRes.status} ${await appendRes.text()}`);
      }
    }

    console.log(`mirrorProductsToSheet: added ${newRows.length} new rows to "${SHEET_TITLE}".`);

    return Response.json({ spreadsheet_id: spreadsheetId, rows_added: newRows.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
