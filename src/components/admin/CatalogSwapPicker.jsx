import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { gbp } from "@/lib/format";
import { SOURCE_LABELS } from "@/lib/provenance";

const UNDER_18_BANDS = new Set(["Under 5", "5-10", "11-17"]);

function normaliseGender(value) {
  const gender = (value || "").toLowerCase();
  if (/women|female|woman|ladies/.test(gender)) return "female";
  if (/\bmen\b|male|\bman\b|gents/.test(gender)) return "male";
  return "any";
}

function clearlyForChildren(product, retailerName) {
  const text = `${product.name || ""} ${product.description || ""} ${product.category || ""} ${product.product_url || ""} ${retailerName || ""}`;
  return /\b(baby|newborn|infant|toddler|nursery|for kids?|children'?s|childrens|8\s*[-–]\s*12\s*(yrs?|years?))\b/i.test(text);
}

// Lets Gem search the existing Product catalogue and pick a replacement gift directly,
// instead of typing one in by hand. Hard-filtered to the recipient's budget and (for
// under-18 recipients) age-restricted items, matching the same rules generation uses.
export default function CatalogSwapPicker({ recipient, onAdd, busy }) {
  const [search, setSearch] = useState("");
  // Many rows render here, so broken-image state is tracked per product id — a single
  // boolean would blank every thumbnail after one failure. On error the <img> is removed
  // and the existing tinted wrapper shows through, so it can never loop.
  const [broken, setBroken] = useState({});

  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: ["catalog-products-active"],
    queryFn: () => base44.entities.Product.filter({ status: "active" }, "-created_date", 5000),
  });
  const { data: retailers = [], isLoading: loadingRetailers } = useQuery({
    queryKey: ["catalog-retailers"],
    queryFn: () => base44.entities.Retailer.list("name", 5000),
  });

  const retailerById = new Map(retailers.map((r) => [r.id, r]));
  const min = Number(recipient?.budget_min);
  const max = Number(recipient?.budget_max);
  const isUnder18 = UNDER_18_BANDS.has(recipient?.age_band);

  const filtered = products.filter((p) => {
    if (Number.isFinite(min) && p.price < min) return false;
    if (Number.isFinite(max) && p.price > max) return false;
    const retailer = retailerById.get(p.retailer_id);
    const expectedBand = isUnder18 ? recipient?.age_band : "18+";
    if (Array.isArray(p.suitable_age_bands) && p.suitable_age_bands.length > 0 && !p.suitable_age_bands.includes(expectedBand)) return false;
    if (!isUnder18 && clearlyForChildren(p, retailer?.name)) return false;
    const recipientGender = normaliseGender(recipient?.gender);
    const productGender = normaliseGender(p.gender_applies_to || retailer?.category);
    if (recipientGender !== "any" && productGender !== "any" && recipientGender !== productGender) return false;
    if (isUnder18) {
      if (p.age_restricted === true || retailer?.contains_age_restricted_items === true) return false;
    }
    if (search.trim() && !(p.name || "").toLowerCase().includes(search.trim().toLowerCase())) return false;
    return true;
  });

  const loading = loadingProducts || loadingRetailers;

  return (
    <div>
      <div className="relative mb-4">
        <Search className="w-4 h-4 text-brand-dark/40 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products by name…"
          className="w-full rounded-xl border border-brand-teal/20 bg-white pl-9 pr-3 py-2.5 font-body text-sm text-brand-dark outline-none focus:border-brand-teal"
        />
      </div>

      {loading ? (
        <p className="font-body text-sm text-brand-dark/45 py-6 text-center">Loading catalogue…</p>
      ) : (
        <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
          {filtered.map((p) => (
            <div key={p.id} className="flex items-center gap-3 bg-brand-cream rounded-xl p-2.5">
              <div className="w-14 h-14 rounded-lg overflow-hidden bg-brand-gold-soft/30 shrink-0">
                {p.image_url && !broken[p.id] && (
                  <img
                    src={p.image_url}
                    alt={p.name}
                    onError={() => setBroken((b) => ({ ...b, [p.id]: true }))}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-display text-sm text-brand-dark truncate">{p.name}</p>
                <p className="font-body text-xs text-brand-gold">
                  {retailerById.get(p.retailer_id)?.name || ""} · {gbp(p.price)}
                  {SOURCE_LABELS[p.source_type] ? ` · ${SOURCE_LABELS[p.source_type]}` : ""}
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => onAdd(p, retailerById.get(p.retailer_id)?.name || "")}
                className="shrink-0 font-body text-xs text-brand-teal font-medium border border-brand-gold/60 rounded-lg px-3 py-1.5 hover:bg-brand-gold-soft/20 disabled:opacity-50"
              >
                Add to list
              </button>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="font-body text-sm text-brand-dark/45 py-6 text-center">No matching products found.</p>
          )}
        </div>
      )}
    </div>
  );
}
