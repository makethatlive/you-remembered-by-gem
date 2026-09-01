import React, { useState, useMemo } from "react";
import { ChevronDown, ChevronRight, Pencil, Store, Package } from "lucide-react";
import { gbp } from "@/lib/format";
import { STATUS_LABEL } from "./ProductEditForm";
import ProductThumb from "./ProductThumb";
import SourceBadge from "./SourceBadge";

const STATUS_STYLE = {
  active: "bg-emerald-100 text-emerald-700",
  inactive: "bg-red-100 text-red-700",
  needs_review: "bg-amber-100 text-amber-700",
  reported_broken: "bg-brand-gold/20 text-brand-dark",
};

// Browse/edit products retailer-by-retailer. Shows EVERY retailer — active AND inactive —
// so Gem can manage products regardless of the retailer's status. Each retailer is a
// collapsible group listing its products with an Edit button.
// hideEmpty: when a source filter is active upstream, retailer groups with zero
// matching products are hidden so Gem isn't scrolling empty accordions. With no
// filter active every retailer still shows (active AND inactive — unchanged).
export default function ProductsByRetailer({ products, retailers, onEdit, hideEmpty = false }) {
  const [open, setOpen] = useState({});

  const toggle = (id) => setOpen((o) => ({ ...o, [id]: !o[id] }));

  // Group products by retailer_id.
  const byRetailer = useMemo(() => {
    const map = new Map();
    for (const p of products) {
      const key = p.retailer_id || "__none__";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(p);
    }
    return map;
  }, [products]);

  // Order: all retailers (active + inactive) sorted by name, then an "unassigned" group.
  const groups = useMemo(() => {
    const rows = retailers.map((r) => ({
      id: r.id,
      name: r.name,
      active: r.active !== false,
      items: byRetailer.get(r.id) || [],
    }));
    if (byRetailer.has("__none__")) {
      rows.push({ id: "__none__", name: "Unassigned", active: true, items: byRetailer.get("__none__") });
    }
    return hideEmpty ? rows.filter((g) => g.items.length > 0) : rows;
  }, [retailers, byRetailer, hideEmpty]);

  return (
    <div className="space-y-3">
      {groups.map((g) => {
        const isOpen = !!open[g.id];
        return (
          <div key={g.id} className="bg-brand-cream-card rounded-2xl shadow-sm overflow-hidden">
            <button
              onClick={() => toggle(g.id)}
              className="w-full flex items-center gap-3 px-5 py-4 text-left min-h-[44px]"
            >
              {isOpen ? <ChevronDown className="w-4 h-4 text-brand-dark/40" /> : <ChevronRight className="w-4 h-4 text-brand-dark/40" />}
              <Store className="w-4 h-4 text-brand-gold" />
              <span className="font-display text-lg text-brand-dark">{g.name}</span>
              {!g.active && (
                <span className="text-xs font-body font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">Inactive</span>
              )}
              <span className="ml-auto font-body text-sm text-brand-dark/45">
                {g.items.length} product{g.items.length === 1 ? "" : "s"}
              </span>
            </button>

            {isOpen && (
              <div className="border-t border-brand-gold/15">
                {g.items.length === 0 ? (
                  <p className="px-5 py-4 font-body text-sm text-brand-dark/45">No products for this retailer yet.</p>
                ) : (
                  g.items.map((p) => (
                    <div key={p.id} className="flex items-center gap-4 px-5 py-3 border-b border-brand-gold/10 last:border-0">
                      <ProductThumb src={p.image_url} />
                      <div className="min-w-0 flex-1">
                        <p className="font-display text-base text-brand-dark truncate">{p.name}</p>
                        <p className="font-body text-sm text-brand-dark/55">
                          {p.price != null ? gbp(p.price) : "—"}
                          {p.category ? ` · ${p.category}` : ""}
                        </p>
                      </div>
                      <SourceBadge product={p} />
                      <span className={`text-xs font-body font-medium px-2.5 py-1 rounded-full ${STATUS_STYLE[p.status] || ""}`}>
                        {STATUS_LABEL[p.status] || p.status}
                      </span>
                      <button
                        onClick={() => onEdit(p)}
                        className="inline-flex items-center gap-1 text-brand-teal font-body text-sm font-medium min-h-[44px]"
                      >
                        <Pencil className="w-4 h-4" /> Edit
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}

      {groups.length === 0 && (
        <div className="flex flex-col items-center py-14 text-brand-dark/40">
          <Package className="w-8 h-8 mb-2" />
          <p className="font-body text-sm">No retailers found.</p>
        </div>
      )}
    </div>
  );
}