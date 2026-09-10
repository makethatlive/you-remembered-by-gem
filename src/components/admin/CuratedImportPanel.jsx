import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { ArrowLeft, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import CuratedRetailersReport from "./CuratedRetailersReport";

// Hard cap on the client-side batch loop — the backend processes a bounded slice of
// sheet rows per invocation and reports next_row; this loop must never run unbounded.
const MAX_BATCHES = 100;

// The published import template — the single source of truth for accepted
// columns. Header labels are verified against the backend's HEADER_SYNONYMS
// (importCuratedProducts/entry.ts): every label here resolves after
// normaliseHeader. Occasion/Comments are deliberately absent (dropped by the
// importer). UTF-8 BOM so Excel renders "£" correctly; the backend parser is
// BOM-aware.
const TEMPLATE_HEADERS = [
  "Item Name", "Retailer", "Product URL", "Image URL", "Price (£)", "Description",
  "Interest Category", "Gender", "Age", "Interest Tags", "Gift Type Tags", "Personality Tags",
];
const TEMPLATE_EXAMPLE = [
  "Personalised Walnut Chopping Board", "Oak & Ember",
  "https://oakandember.co.uk/products/walnut-chopping-board", "", "45",
  "Solid walnut board engraved with a family name", "Cooking & Food", "Unisex",
  "", "Cooking & Food, Homeware", "Personalised", "foodie, host",
];
function downloadTemplate() {
  const quote = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const csv = "\uFEFF" + [TEMPLATE_HEADERS, TEMPLATE_EXAMPLE]
    .map((row) => row.map(quote).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = "curated-import-template.csv";
  a.click();
  URL.revokeObjectURL(href);
}

// Import Gem's personally curated products from a Google Sheet. Every imported row is
// stamped source_type: "curated_product" by the backend; rows matching an existing
// catalogue URL fill in only blank fields (never overwriting saved data), so re-running is safe.
export default function CuratedImportPanel({ onDone }) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState(null);
  const [url, setUrl] = useState("");
  const [tabName, setTabName] = useState("");
  const [running, setRunning] = useState(false);
  const [processed, setProcessed] = useState(0);
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  const [foundHeaders, setFoundHeaders] = useState([]);

  const startImport = async () => {
    setRunning(true);
    setError("");
    setFoundHeaders([]);
    setProcessed(0);
    setReport(null);

    const totals = {
      created_active: 0,
      created_needs_review: 0,
      updated_existing: 0,
      matched_existing: 0,
      fields_filled: 0,
      created_retailers: [],
      category_conflicts_unresolved: [],
      unknown_categories: [],
      unknown_genders: [],
      skipped: [],
    };
    let processedCount = 0;
    let start_row = 2;
    let expectedTotal = 0;

    try {
      // File mode: upload once, then loop the same bounded batches with file_url.
      let file_url = "";
      if (file) {
        const uploaded = await base44.integrations.Core.UploadFile({ file });
        file_url = uploaded?.file_url || "";
        if (!file_url) throw new Error("File upload did not return a URL — try again.");
      }
      for (let i = 0; i < MAX_BATCHES; i++) {
        const res = await base44.functions.invoke(
          "importCuratedProducts",
          file_url
            ? { file_url, tab_name: tabName || undefined, start_row, batch_size: 40, expected_total: expectedTotal || undefined }
            : { spreadsheet_url: url, tab_name: tabName || undefined, start_row, batch_size: 40 }
        );
        if (res?.data?.error) {
          setError(res.data.error);
          break;
        }
        // Check for both snake_case (legacy) and camelCase (current) field names
        const done = res?.data?.done;
        const nextRow = res?.data?.nextRow || res?.data?.next_row;
        
        if (typeof done !== "boolean" || typeof nextRow !== "number") {
          console.error('Unexpected response format:', res?.data);
          setError("Unexpected response from import — stopped.");
          break;
        }
        // File mode only: pin the row count the FIRST successful batch reports, so
        // every later batch's fresh re-extraction is checked against it server-side
        // (backend W3.3(c) Part 2) — a shrunk/reordered re-extraction 409s instead
        // of silently finishing with done:true and rows missing.
        const extractedTotal = res?.data?.extractedTotal || res?.data?.extracted_total;
        if (file_url && !expectedTotal && typeof extractedTotal === "number") {
          expectedTotal = extractedTotal;
        }

        totals.created_active += res.data.createdActive || res.data.created_active || 0;
        totals.created_needs_review += res.data.createdNeedsReview || res.data.created_needs_review || 0;
        totals.updated_existing += res.data.updatedExisting || res.data.updated_existing || 0;
        totals.matched_existing += res.data.matchedExisting || res.data.matched_existing || 0;
        totals.fields_filled += res.data.fieldsFilled || res.data.fields_filled || 0;
        totals.created_retailers = totals.created_retailers.concat(res.data.createdRetailers || res.data.created_retailers || []);
        totals.category_conflicts_unresolved = totals.category_conflicts_unresolved.concat(res.data.categoryConflictsUnresolved || res.data.category_conflicts_unresolved || []);
        // Round-3 (R1d) reports every Interest Category / Gender value the canonical
        // taxonomy did not recognise. Union across batches, first-seen order, so the
        // report can show Gem the real value set in one place: the response arrays are
        // otherwise visible only in the network tab.
        const unknownCategories = res.data.unknownCategories || res.data.unknown_categories || [];
        totals.unknown_categories = totals.unknown_categories.concat(
          unknownCategories.filter((v) => !totals.unknown_categories.includes(v))
        );
        const unknownGenders = res.data.unknownGenders || res.data.unknown_genders || [];
        totals.unknown_genders = totals.unknown_genders.concat(
          unknownGenders.filter((v) => !totals.unknown_genders.includes(v))
        );
        totals.skipped = totals.skipped.concat(res.data.skipped || []);
        processedCount += res.data.processed || 0;
        setProcessed(processedCount);
        setReport({ ...totals, skipped: totals.skipped.slice() });

        if (done) break;
        if (nextRow <= start_row) {
          setError("Import made no forward progress — stopped.");
          break;
        }
        start_row = nextRow;
      }
    } catch (e) {
      // functions.invoke rejects on any non-2xx — the function's real JSON body (its
      // error message and diagnostic found_headers) lives on e.response.data, not e.message.
      const body = e?.response?.data;
      setError(body?.error || e?.message || "Import failed — please try again.");
      if (Array.isArray(body?.found_headers)) setFoundHeaders(body.found_headers);
    } finally {
      // Always refresh: earlier batches may have created products AND retailers
      // before a later batch threw, so the catch path must invalidate too.
      // ["retailers"] feeds RetailersTab/ProductsTab; ["catalog-retailers"] feeds
      // CatalogSwapPicker (CatalogSwapPicker.jsx:44).
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["retailers"] });
      queryClient.invalidateQueries({ queryKey: ["catalog-retailers"] });
      setRunning(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-8 sm:px-12 lg:px-16 pt-6 pb-16">
      <button
        onClick={onDone}
        className="flex items-center gap-1.5 text-brand-teal font-body text-sm font-medium mb-4 min-h-[44px]"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Products
      </button>
      <h1 className="font-display text-2xl text-brand-dark mb-6">Import from Sheet</h1>

      <div className="space-y-5">
        <div className="space-y-1.5">
          <Label className="font-body text-sm text-brand-dark/80">Upload spreadsheet (.xlsx or .csv)</Label>
          <Input
            type="file"
            accept=".xlsx,.csv"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="h-12 pt-2.5"
          />
          <p className="font-body text-xs text-brand-dark/55">
            Multi-sheet workbooks are fine — the importer finds the “Curated
            Product List” tab automatically (or set Tab Name below). Unknown
            retailers are created automatically. Occasion and Comments columns
            are not imported. The template below includes one example row —
            replace it with your own products before importing.
          </p>
          <button
            type="button"
            onClick={downloadTemplate}
            className="font-body text-sm text-brand-teal font-medium underline underline-offset-2 min-h-[44px]"
          >
            Download template (.csv)
          </button>
        </div>
        <p className="font-body text-xs uppercase tracking-wide text-brand-dark/40 text-center">
          or import from Google Sheets
        </p>
        <div className="space-y-1.5">
          <Label className="font-body text-sm text-brand-dark/80">Google Sheet URL</Label>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/…"
            className="h-12"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="font-body text-sm text-brand-dark/80">Tab Name (optional — Google Sheets or multi-sheet uploads)</Label>
          <Input
            value={tabName}
            onChange={(e) => setTabName(e.target.value)}
            placeholder="Leave blank to auto-detect"
            className="h-12"
          />
        </div>

        <p className="font-body text-sm text-brand-dark/55 bg-brand-cream-card rounded-xl px-4 py-3">
          Required columns:{" "}
          <b className="text-brand-dark">Item Name, Retailer, Product URL, Price (£)</b>.
          Optional: Image URL, Description, Interest Category, Gender, Age,
          Interest Tags, Gift Type Tags, Personality Tags. Use “Download
          template” above for the exact layout — files are read exactly as
          written (no AI guessing). Rows matching an existing product only fill
          in fields that are currently blank; nothing already saved is ever
          overwritten.
        </p>

        <button
          onClick={startImport}
          disabled={running}
          className="w-full bg-brand-teal text-brand-cream font-body font-medium rounded-xl py-3.5 min-h-[44px] flex items-center justify-center gap-2 hover:bg-brand-teal-dark disabled:opacity-60"
        >
          {running && <Loader2 className="w-4 h-4 animate-spin" />}
          Start Import
        </button>

        {processed > 0 && (
          <p className="font-body text-sm text-brand-dark/55">Processed {processed} rows…</p>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-2xl px-4 py-3 bg-brand-gold/15 ring-1 ring-brand-gold/40">
            <AlertTriangle className="w-4 h-4 text-brand-gold" />
            <div>
              <p className="font-body text-sm text-brand-dark">{error}</p>
              {foundHeaders.length > 0 && (
                <p className="font-body text-sm text-brand-dark/55">
                  Headers found in your sheet: {foundHeaders.join(", ")}
                </p>
              )}
              <p className="font-body text-sm text-brand-dark/55">
                Fix the issue and click Start Import again — already-imported rows are detected
                and will not be duplicated.
              </p>
            </div>
          </div>
        )}

        {report && (
          <div className="bg-brand-cream-card rounded-2xl shadow-sm p-5 space-y-3">
            <p className="flex items-center gap-1.5 font-body text-xs uppercase tracking-wide text-brand-dark/40">
              <CheckCircle2 className="w-3.5 h-3.5" /> Import results
            </p>
            <p className="font-body text-sm text-brand-dark">
              Created active: <b>{report.created_active}</b>
            </p>
            <p className="font-body text-sm text-brand-dark">
              Created needs review: <b>{report.created_needs_review}</b>
            </p>
            <p className="font-body text-sm text-brand-dark">
              Updated existing: <b>{report.updated_existing}</b>
            </p>
            <p className="font-body text-sm text-brand-dark">
              Matched existing (no change needed): <b>{Math.max(0, (report.matched_existing || 0) - (report.updated_existing || 0))}</b>
            </p>
            <p className="font-body text-sm text-brand-dark">
              Fields filled on existing products: <b>{report.fields_filled || 0}</b>
            </p>
            <CuratedRetailersReport retailers={report.created_retailers} />
            {(report.category_conflicts_unresolved || []).length > 0 && (
              <p className="font-body text-sm text-brand-gold">
                {report.category_conflicts_unresolved.length} retailer categor
                {report.category_conflicts_unresolved.length === 1 ? "y" : "ies"} could
                not be auto-corrected — open Retailers and check manually.
              </p>
            )}
            {(report.unknown_categories || []).length > 0 && (
              <p className="font-body text-sm text-brand-gold">
                {report.unknown_categories.length} unrecognised interest categor
                {report.unknown_categories.length === 1 ? "y" : "ies"} — imported exactly
                as written, nothing was dropped: {report.unknown_categories.join(", ")}
              </p>
            )}
            {(report.unknown_genders || []).length > 0 && (
              <p className="font-body text-sm text-brand-gold">
                {report.unknown_genders.length} unrecognised gender
                {report.unknown_genders.length === 1 ? "" : "s"} — treated as Unisex:{" "}
                {report.unknown_genders.join(", ")}
              </p>
            )}

            {report.skipped.length > 0 && (
              <div className="space-y-1.5 max-h-[280px] overflow-y-auto">
                <p className="font-body text-xs uppercase tracking-wide text-brand-dark/40">
                  Skipped rows ({report.skipped.length})
                </p>
                {report.skipped.map((s, i) => (
                  <p key={`${s.row}-${i}`} className="font-body text-sm text-brand-dark/55">
                    Row {s.row} — {s.name || "—"} — {s.reason}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
