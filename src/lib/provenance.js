// Single source of truth for Product provenance (source_type) display + grouping.
// Round 3, package R5. Replaces the four per-file SOURCE_LABELS maps from round 2
// (ProductsTab, ProductsByRetailer, CatalogSwapPicker, ProductEditForm).
//
// HAND-SYNCED TWIN: base44/shared/provenanceShared.ts carries the same model for
// backend functions (the frontend cannot import a Deno .ts file and functions
// cannot import from src/). Change one, change both, plus Product.jsonc if the
// enum itself changes (schema-gated).
//
// MODEL (normative, shared with R4's ranking):
//   gem_pick  = source_type "curated_product" — personally supplied/selected by
//               Gem. The ONLY machine marker of Gem's curation.
//   catalogue = "curated_retailer" (site scan) | "shopify_upload" (Shopify feed)
//               — auto-discovered. Kate's ruling 2026-07-24: both display as
//               "Catalogue upload".
//   legacy    = "legacy_unknown", absent, or any unrecognised value — provenance
//               unproven. NEVER treated as curated by any consumer.

export const PROVENANCE_GROUP = {
  curated_product: "gem_pick",
  curated_retailer: "catalogue",
  shopify_upload: "catalogue",
  legacy_unknown: "legacy",
};

export function provenanceGroup(product) {
  return PROVENANCE_GROUP[product?.source_type] || "legacy";
}

export function isGemsPick(product) {
  return product?.source_type === "curated_product";
}

// Plain display labels (tables, pickers, badges).
export const SOURCE_LABELS = {
  curated_product: "Gem's Pick",
  curated_retailer: "Catalogue upload",
  shopify_upload: "Catalogue upload",
  legacy_unknown: "Legacy",
};

// Label with "Legacy" fallback for absent/unknown values — the behaviour the two
// table surfaces already had. The swap picker intentionally does NOT use this
// (it omits the label for unknown values; see CatalogSwapPicker).
export function sourceLabel(product) {
  return SOURCE_LABELS[product?.source_type] || "Legacy";
}

// Disambiguated labels — ONLY for the editable Provenance <Select> in
// ProductEditForm, where Gem must see which stored value she is choosing.
export const SOURCE_LABELS_EDIT = {
  curated_product: "Gem's Pick",
  curated_retailer: "Catalogue upload (site scan)",
  shopify_upload: "Catalogue upload (Shopify feed)",
  legacy_unknown: "Legacy",
};

// Fixed group order for filters and the "Gem's Picks first" sort.
export const GROUP_ORDER = ["gem_pick", "catalogue", "legacy"];

export const GROUP_LABELS = {
  gem_pick: "Gem's Pick",
  catalogue: "Catalogue upload",
  legacy: "Legacy",
};
