import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Store, Plus, Pencil } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import RetailerForm from "./RetailerForm";
import RetailerScrapeButton from "./RetailerScrapeButton";
import RetailerEnrichButton from "./RetailerEnrichButton";
import FullCatalogueScrapeButton from "./FullCatalogueScrapeButton";

const STATUS_BADGE = {
  ok: { label: "Pulled", cls: "bg-emerald-100 text-emerald-700" },
  no_products: { label: "0 found", cls: "bg-amber-100 text-amber-700" },
  error: { label: "Stuck", cls: "bg-red-100 text-red-700" },
  skipped_no_source: { label: "No URL", cls: "bg-red-100 text-red-700" },
};
const METHOD_LABEL = { shopify: "Shopify", sitemap: "Sitemap", crawl: "Crawl", none: "—" };

export default function RetailersTab() {
  const [editing, setEditing] = useState(null); // null | {} | record

  const { data: retailers = [], isLoading } = useQuery({
    queryKey: ["retailers"],
    queryFn: () => base44.entities.Retailer.list("name", 5000),
  });
  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => base44.entities.Product.list("-added_date", 5000),
  });

  // Per-retailer product counts: total, active, needs_review, inactive.
  const countsByRetailer = useMemo(() => {
    const map = new Map();
    for (const p of products) {
      if (!p.retailer_id) continue;
      const c = map.get(p.retailer_id) || { total: 0, active: 0, needs_review: 0, inactive: 0 };
      c.total++;
      if (p.status === "active") c.active++;
      else if (p.status === "needs_review") c.needs_review++;
      else if (p.status === "inactive") c.inactive++;
      map.set(p.retailer_id, c);
    }
    return map;
  }, [products]);

  const countsFor = (id) => countsByRetailer.get(id) || { total: 0, active: 0, needs_review: 0, inactive: 0 };
  const isUnderfilled = (r) => r.active && !r.curated_only && countsFor(r.id).active < 10;

  if (editing !== null) {
    return <RetailerForm retailer={editing} onDone={() => setEditing(null)} />;
  }

  return (
    <div className="max-w-5xl mx-auto px-5 pt-6 pb-16">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl text-brand-dark">Retailers</h1>
        <button
          onClick={() => setEditing({})}
          className="flex items-center gap-1.5 bg-brand-teal text-brand-cream font-body text-sm font-medium rounded-full px-4 py-2.5 min-h-[44px] hover:bg-brand-teal-dark"
        >
          <Plus className="w-4 h-4" /> Add Retailer
        </button>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {retailers.map((r) => (
          <div key={r.id} className="bg-brand-cream-card rounded-2xl shadow-sm p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-display text-lg text-brand-dark">{r.name}</p>
                <p className="font-body text-sm text-brand-dark/50 break-all">{r.website_url}</p>
              </div>
              <button onClick={() => setEditing(r)} className="text-brand-teal p-2 -mr-2" aria-label="Edit">
                <Pencil className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className="text-xs font-body px-2.5 py-1 rounded-full bg-brand-gold/15 text-brand-dark/70">{r.category}</span>
              {r.contains_age_restricted_items && (
                <span className="text-xs font-body px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">Age restricted</span>
              )}
              <span className={`text-xs font-body font-medium px-2.5 py-1 rounded-full ${r.active ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                {r.active ? "Active" : "Inactive"}
              </span>
              {r.curated_only && (
                <span className="text-xs font-body font-medium px-2.5 py-1 rounded-full bg-brand-gold/15 text-brand-dark/70">Curated only</span>
              )}
              {isUnderfilled(r) && (
                <span className="text-xs font-body font-medium px-2.5 py-1 rounded-full bg-red-100 text-red-700">Underfilled</span>
              )}
              {!r.curated_only && r.last_scrape_status && r.last_scrape_status !== "ok" && STATUS_BADGE[r.last_scrape_status] && (
                <span title={r.last_scrape_error || ""} className={`text-xs font-body font-medium px-2.5 py-1 rounded-full ${STATUS_BADGE[r.last_scrape_status].cls}`}>{STATUS_BADGE[r.last_scrape_status].label}</span>
              )}
            </div>
            <p className="font-body text-xs text-brand-dark/60 mt-2">
              {countsFor(r.id).total} products · {countsFor(r.id).active} active · {countsFor(r.id).needs_review} needs review · {countsFor(r.id).inactive} inactive{" · "}{r.last_scrape_at ? `scraped ${formatDateTime(r.last_scrape_at)}` : "never scraped"}{r.last_discovery_method && r.last_discovery_method !== "none" ? ` via ${METHOD_LABEL[r.last_discovery_method]}` : ""}
            </p>
            {!r.curated_only && (
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <RetailerScrapeButton retailer={r} />
                <RetailerEnrichButton retailer={r} />
              </div>
            )}
            {(r.last_scrape_status === "error" || r.last_scrape_status === "skipped_no_source") && r.last_scrape_error && (
              <p className="font-body text-xs text-red-700 mt-1">{r.last_scrape_error}</p>
            )}
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-brand-cream-card rounded-2xl shadow-sm overflow-x-auto">
        <table className="w-full min-w-[1080px]">
          <thead>
            <tr className="text-left font-body text-xs uppercase tracking-wide text-brand-dark/40 border-b border-brand-gold/15">
              <th className="px-5 py-3">Name</th>
              <th className="px-5 py-3">Website</th>
              <th className="px-5 py-3">Category</th>
              <th className="px-5 py-3">Age restricted</th>
              <th className="px-5 py-3">Products</th>
              <th className="px-5 py-3">Source</th>
              <th className="px-5 py-3">Last scraped</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {retailers.map((r) => (
              <tr key={r.id} className="border-b border-brand-gold/10 last:border-0">
                <td className="px-5 py-4 font-display text-base text-brand-dark">{r.name}</td>
                <td className="px-5 py-4 font-body text-sm text-brand-dark/60 break-all max-w-xs">{r.website_url}</td>
                <td className="px-5 py-4 font-body text-sm text-brand-dark">{r.category}</td>
                <td className="px-5 py-4 font-body text-sm text-brand-dark/70">{r.contains_age_restricted_items ? "Yes" : "No"}</td>
                <td className="px-5 py-4 font-body text-xs text-brand-dark/70 whitespace-nowrap">
                  {countsFor(r.id).total} total · {countsFor(r.id).active} active · {countsFor(r.id).needs_review} review · {countsFor(r.id).inactive} inactive
                </td>
                <td className="px-5 py-4 font-body text-sm text-brand-dark/70">{METHOD_LABEL[r.last_discovery_method] || "—"}</td>
                <td className="px-5 py-4 font-body text-sm text-brand-dark/50 whitespace-nowrap">{r.last_scrape_at ? formatDateTime(r.last_scrape_at) : "Never"}</td>
                <td className="px-5 py-4">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`text-xs font-body font-medium px-2.5 py-1 rounded-full ${r.active ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                      {r.active ? "Active" : "Inactive"}
                    </span>
                    {r.curated_only && (
                      <span className="text-xs font-body font-medium px-2.5 py-1 rounded-full bg-brand-gold/15 text-brand-dark/70">Curated only</span>
                    )}
                    {isUnderfilled(r) && (
                      <span className="text-xs font-body font-medium px-2.5 py-1 rounded-full bg-red-100 text-red-700">Underfilled</span>
                    )}
                    {!r.curated_only && r.last_scrape_status && r.last_scrape_status !== "ok" && STATUS_BADGE[r.last_scrape_status] && (
                      <span title={r.last_scrape_error || ""} className={`text-xs font-body font-medium px-2.5 py-1 rounded-full ${STATUS_BADGE[r.last_scrape_status].cls}`}>{STATUS_BADGE[r.last_scrape_status].label}</span>
                    )}
                  </div>
                </td>
                <td className="px-5 py-4 text-right">
                  <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                    {!r.curated_only && <RetailerScrapeButton retailer={r} />}
                    {!r.curated_only && <RetailerEnrichButton retailer={r} />}
                    <button onClick={() => setEditing(r)} className="inline-flex items-center gap-1 text-brand-teal font-body text-sm font-medium">
                      <Pencil className="w-4 h-4" /> Edit
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Advanced: the full-catalogue walk lives here (Kate item 3, round 3) —
          demoted from the Products-tab header so it can't be pressed by habit.
          Per-retailer Scrape/Enrich on the rows above are the recommended path. */}
      {retailers.length > 0 && (
        <div className="mt-8 border-t border-brand-gold/20 pt-5">
          <p className="font-body text-xs uppercase tracking-wide text-brand-dark/40 mb-3">Advanced</p>
          <div className="flex flex-wrap items-center gap-2">
            <FullCatalogueScrapeButton />
          </div>
          <p className="font-body text-xs text-brand-dark/50 mt-2">
            Walks every enabled retailer's complete catalogue. Prefer the per-retailer Scrape buttons above — this can take hours and holds the scrape lock the whole time.
          </p>
        </div>
      )}

      {!isLoading && retailers.length === 0 && (
        <div className="flex flex-col items-center py-14 text-brand-dark/40">
          <Store className="w-8 h-8 mb-2" />
          <p className="font-body text-sm">No retailers yet.</p>
        </div>
      )}
    </div>
  );
}