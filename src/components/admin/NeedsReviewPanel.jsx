import React, { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Package, TriangleAlert as AlertTriangle, ExternalLink, LoaderCircle as Loader2, Pencil } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/components/ui/use-toast";
import { gbp } from "@/lib/format";
import { SOURCE_LABELS } from "@/lib/provenance";
import ProductThumb from "./ProductThumb";

// Review queue for scraped products (Kate item 3, round 3). Every scrape lands
// products as status "needs_review" (scrapeCatalogueBatch:490, scrapeRetailerProducts:192)
// and generateGiftList pools ONLY "active" rows — so nothing here can reach a
// subscriber until Gem approves it. Approve/Discard write EXACTLY ONE field
// ({ status }) so Gem's curated data (source_type, tags, notes) is never touched.

// Rows the scrapers themselves flagged as probably-not-a-product. Excluded from
// group select-all (approving them should be a deliberate, individual act).
const JUNK_FLAGS = ["junk_title", "editorial_not_product"];
const isJunk = (p) => Array.isArray(p.data_quality_flags) && p.data_quality_flags.some((f) => JUNK_FLAGS.includes(f));

export default function NeedsReviewPanel({ products, retailers, onEdit }) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState([]);

  const reviewRows = useMemo(() => products.filter((p) => p.status === "needs_review"), [products]);
  const notEnriched = useMemo(() => reviewRows.filter((p) => !p.catalogue_enriched_at).length, [reviewRows]);

  const groups = useMemo(() => {
    const byRetailer = new Map();
    for (const p of reviewRows) {
      const key = p.retailer_id || "";
      if (!byRetailer.has(key)) byRetailer.set(key, []);
      byRetailer.get(key).push(p);
    }
    const named = [...byRetailer.entries()].map(([id, rows]) => ({
      id,
      name: retailers.find((r) => r.id === id)?.name || "No retailer",
      rows,
    }));
    named.sort((a, b) => a.name.localeCompare(b.name));
    return named;
  }, [reviewRows, retailers]);

  // Selected ids that still exist as needs_review rows (the products cache can
  // refresh underneath the selection).
  const validSelected = useMemo(() => {
    const ids = new Set(reviewRows.map((p) => p.id));
    return selected.filter((id) => ids.has(id));
  }, [selected, reviewRows]);
  const selectedJunkCount = useMemo(
    () => validSelected.filter((id) => { const p = reviewRows.find((x) => x.id === id); return p && isJunk(p); }).length,
    [validSelected, reviewRows]
  );

  const setStatus = useMutation({
    mutationFn: async ({ ids, status }) => {
      // Sequential slices of 20: a single burst of hundreds of parallel updates
      // is a rate-limit risk; per-slice Promise.all keeps it fast but bounded.
      for (let i = 0; i < ids.length; i += 20) {
        await Promise.all(ids.slice(i, i + 20).map((id) => base44.entities.Product.update(id, { status })));
      }
      return { count: ids.length, status };
    },
    onSuccess: ({ count, status }) => {
      toast({
        description: status === "active"
          ? `${count} product(s) approved — now live and eligible for gift generation.`
          : `${count} product(s) discarded (marked inactive).`,
      });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["catalog-products-active"] });
      setSelected([]);
    },
    onError: (err) => {
      // A mid-slice failure leaves earlier slices applied — refresh to show truth.
      toast({ description: `Update stopped part-way: ${err?.response?.data?.error || err.message || "unexpected error"} — the queue has been refreshed.` });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setSelected([]);
    },
  });

  const toggle = (id) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  // Group select-all covers non-junk rows only; junk rows stay individually selectable.
  const toggleGroup = (group) => {
    const eligible = group.rows.filter((p) => !isJunk(p)).map((p) => p.id);
    const allIn = eligible.length > 0 && eligible.every((id) => selected.includes(id));
    setSelected((s) => (allIn ? s.filter((id) => !eligible.includes(id)) : [...new Set([...s, ...eligible])]));
  };

  if (reviewRows.length === 0) {
    return (
      <div className="flex flex-col items-center py-14 text-brand-dark/40">
        <Package className="w-8 h-8 mb-2" />
        <p className="font-body text-sm">Nothing awaiting review — every product has been approved or discarded.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <p className="font-body text-sm text-brand-dark/70">
          <b className="text-brand-dark">{reviewRows.length}</b> product{reviewRows.length === 1 ? "" : "s"} awaiting review
          {notEnriched > 0 && (
            <span className="text-brand-dark/50"> · {notEnriched} not yet enriched — run Enrich on the retailer first so tags and quality flags are filled in</span>
          )}
        </p>
        {validSelected.length > 0 && (
          <div className="ml-auto flex items-center gap-2">
            {selectedJunkCount > 0 && (
              <span className="font-body text-xs text-amber-700 bg-amber-100 rounded-full px-2.5 py-1">
                includes {selectedJunkCount} flagged as junk/editorial
              </span>
            )}
            <button
              onClick={() => setStatus.mutate({ ids: validSelected, status: "active" })}
              disabled={setStatus.isPending}
              className="bg-brand-teal text-brand-cream font-body text-sm font-medium rounded-full px-4 py-2.5 min-h-[44px] hover:bg-brand-teal-dark disabled:opacity-60"
            >
              {setStatus.isPending ? <Loader2 className="w-4 h-4 animate-spin inline" /> : null} Approve ({validSelected.length})
            </button>
            <button
              onClick={() => setStatus.mutate({ ids: validSelected, status: "inactive" })}
              disabled={setStatus.isPending}
              className="border border-red-300 text-red-700 font-body text-sm font-medium rounded-full px-4 py-2.5 min-h-[44px] hover:bg-red-50 disabled:opacity-60"
            >
              Discard ({validSelected.length})
            </button>
          </div>
        )}
      </div>

      <div className="space-y-6">
        {groups.map((group) => {
          const eligible = group.rows.filter((p) => !isJunk(p)).map((p) => p.id);
          const allIn = eligible.length > 0 && eligible.every((id) => selected.includes(id));
          return (
            <div key={group.id || "none"} className="bg-brand-cream-card rounded-2xl shadow-sm overflow-x-auto">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-brand-gold/15">
                <Checkbox checked={allIn} onCheckedChange={() => toggleGroup(group)} disabled={eligible.length === 0} />
                <p className="font-display text-lg text-brand-dark">{group.name}</p>
                <span className="font-body text-xs text-brand-dark/50">{group.rows.length} awaiting review</span>
              </div>
              <table className="w-full min-w-[860px]">
                <tbody>
                  {group.rows.map((p) => (
                    <tr key={p.id} className="border-b border-brand-gold/10 last:border-0">
                      <td className="px-4 py-3 w-10">
                        <Checkbox checked={selected.includes(p.id)} onCheckedChange={() => toggle(p.id)} />
                      </td>
                      <td className="px-4 py-3"><ProductThumb src={p.image_url} /></td>
                      <td className="px-4 py-3">
                        <p className="font-display text-base text-brand-dark">{p.name}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {isJunk(p) && (
                            <span className="inline-flex items-center gap-1 text-xs font-body font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                              <AlertTriangle className="w-3 h-3" /> flagged: {p.data_quality_flags.filter((f) => JUNK_FLAGS.includes(f)).join(", ")}
                            </span>
                          )}
                          <span className={`text-xs font-body px-2 py-0.5 rounded-full ${p.catalogue_enriched_at ? "bg-emerald-100 text-emerald-700" : "bg-brand-gold/15 text-brand-dark/60"}`}>
                            {p.catalogue_enriched_at ? "Enriched" : "Not enriched"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-body text-sm text-brand-dark whitespace-nowrap">{p.price != null ? gbp(p.price) : "—"}</td>
                      <td className="px-4 py-3 font-body text-sm text-brand-dark/70 whitespace-nowrap">{SOURCE_LABELS[p.source_type] || "Legacy"}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {p.product_url && (
                          <a href={p.product_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brand-teal font-body text-sm font-medium">
                            View <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button onClick={() => onEdit(p)} className="inline-flex items-center gap-1 text-brand-teal font-body text-sm font-medium">
                          <Pencil className="w-4 h-4" /> Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </div>
  );
}
