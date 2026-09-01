// Product provenance model — HAND-SYNCED TWIN of src/lib/provenance.js.
// Round 3, package R5 (interface commit; consumed by R4's curated ranking).
//
// RULES (prime directive — never overwrite Gem's curation):
//  - "curated_product" is the only machine marker of Gem's curation. Only
//    Gem-facing surfaces may SET it (importCuratedProducts, ProductAddForm,
//    ApprovalDetail manual add, ProductEditForm's Provenance select).
//  - Machine writers may stamp "curated_retailer"/"shopify_upload" on CREATE
//    only and must never re-stamp an existing row (scrapeCatalogueBatch's
//    upsertProduct already complies — see its comment "Existing records are
//    never re-stamped").
//  - Absent/unknown source_type is "legacy": never treated as curated by any
//    consumer. It may rank like "catalogue"; it may never rank like "gem_pick".

export type ProvenanceGroup = "gem_pick" | "catalogue" | "legacy";

const GROUP_BY_SOURCE: Record<string, ProvenanceGroup> = {
  curated_product: "gem_pick",
  curated_retailer: "catalogue",
  shopify_upload: "catalogue",
  legacy_unknown: "legacy",
};

export function provenanceGroup(
  product: { source_type?: string } | null | undefined,
): ProvenanceGroup {
  const st = product?.source_type;
  return (st && GROUP_BY_SOURCE[st]) || "legacy";
}

export function isGemCurated(
  product: { source_type?: string } | null | undefined,
): boolean {
  return product?.source_type === "curated_product";
}
