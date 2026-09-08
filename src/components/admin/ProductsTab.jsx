import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Package, Pencil, AlertTriangle, Plus, Table2, Store, FileSpreadsheet, ArrowUpDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { gbp, formatDate } from "@/lib/format";
import ProductEditForm, { STATUS_LABEL } from "./ProductEditForm";
import ProductThumb from "./ProductThumb";
import ProductsByRetailer from "./ProductsByRetailer";
import ProductAddForm from "./ProductAddForm";
import RerunScrapeButton from "./RerunScrapeButton";
import RecoverCatalogueButton from "./RecoverCatalogueButton";
import CuratedImportPanel from "./CuratedImportPanel";
import NeedsReviewPanel from "./NeedsReviewPanel";
import SourceBadge from "./SourceBadge";
import { provenanceGroup, GROUP_LABELS, GROUP_ORDER } from "@/lib/provenance";

const STATUS_STYLE = {
  // Uppercase (from database)
  ACTIVE: "bg-emerald-100 text-emerald-700",
  INACTIVE: "bg-red-100 text-red-700",
  NEEDS_REVIEW: "bg-amber-100 text-amber-700",
  REPORTED_BROKEN: "bg-brand-gold/20 text-brand-dark",
  // Legacy lowercase support
  active: "bg-emerald-100 text-emerald-700",
  inactive: "bg-red-100 text-red-700",
  needs_review: "bg-amber-100 text-amber-700",
  reported_broken: "bg-brand-gold/20 text-brand-dark",
};

export default function ProductsTab() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [view, setView] = useState("table"); // "table" | "retailer" | "review"
  const [statusFilter, setStatusFilter] = useState("all");
  const [retailerFilter, setRetailerFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all"); // "all" | "gem_pick" | "catalogue" | "legacy"
  const [gemFirst, setGemFirst] = useState(false); // Source-column sort toggle
  const [selected, setSelected] = useState([]);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: () => base44.entities.Product.list("-added_date", 5000),
  });
  const { data: retailers = [] } = useQuery({
    queryKey: ["retailers"],
    queryFn: () => base44.entities.Retailer.list("name", 5000),
  });

  const retailerName = (id) => retailers.find((r) => r.id === id)?.name || "—";

  // Source filter applies to BOTH views; status/retailer stay table-only.
  const sourceFiltered = useMemo(
    () =>
      sourceFilter === "all"
        ? products
        : products.filter((p) => provenanceGroup(p) === sourceFilter),
    [products, sourceFilter]
  );

  const filtered = useMemo(() => {
    const rows = sourceFiltered.filter(
      (p) =>
        (statusFilter === "all" || p.status === statusFilter) &&
        (retailerFilter === "all" || (p.retailerId || p.retailer_id) === retailerFilter)
    );
    if (!gemFirst) return rows;
    // Stable sort: groups in GROUP_ORDER, newest-first preserved within each group.
    const rank = { gem_pick: 0, catalogue: 1, legacy: 2 };
    return [...rows].sort((a, b) => rank[provenanceGroup(a)] - rank[provenanceGroup(b)]);
  }, [sourceFiltered, statusFilter, retailerFilter, gemFirst]);

  // Pagination calculations
  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedProducts = filtered.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, retailerFilter, sourceFilter, gemFirst, itemsPerPage]);

  // Live provenance distribution — doubles as the runtime source_type audit.
  const sourceCounts = useMemo(() => {
    const c = { gem_pick: 0, catalogue: 0, legacy: 0 };
    for (const p of products) c[provenanceGroup(p)]++;
    return c;
  }, [products]);

  const brokenCount = useMemo(
    () => products.filter((p) => p.status === "REPORTED_BROKEN").length,
    [products]
  );

  const reviewCount = useMemo(
    () => products.filter((p) => p.status === "NEEDS_REVIEW").length,
    [products]
  );

  const markActive = useMutation({
    mutationFn: async (ids) => {
      await Promise.all(
        ids.map((id) => base44.entities.Product.update(id, { status: "ACTIVE" }))
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setSelected([]);
    },
  });

  // Only needs_review rows can be flipped to active by the bulk tool
  const eligibleSelected = selected.filter(
    (id) => {
      const product = products.find((p) => p.id === id);
      return product && product.status === "NEEDS_REVIEW";
    }
  );

  const toggle = (id) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  if (editing !== null) {
    return (
      <ProductEditForm
        product={editing}
        retailerName={retailerName(editing.retailerId || editing.retailer_id)}
        onDone={() => setEditing(null)}
      />
    );
  }

  if (adding) {
    return <ProductAddForm retailers={retailers} onDone={() => setAdding(false)} />;
  }

  if (importing) {
    return <CuratedImportPanel onDone={() => setImporting(false)} />;
  }

  return (
    <div className="max-w-8xl mx-auto px-8 sm:px-12 lg:px-16 pt-6 pb-16">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-3xl text-brand-dark">Products</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 bg-brand-teal text-brand-cream font-body text-sm font-medium rounded-full px-4 py-2.5 min-h-[44px] hover:bg-brand-teal-dark"
          >
            <Plus className="w-4 h-4" /> Add Product
          </button>
          <button
            onClick={() => setImporting(true)}
            className="flex items-center gap-1.5 bg-brand-teal text-brand-cream font-body text-sm font-medium rounded-full px-4 py-2.5 min-h-[44px] hover:bg-brand-teal-dark"
          >
            <FileSpreadsheet className="w-4 h-4" /> Import from Sheet
          </button>
          <RerunScrapeButton />
          <RecoverCatalogueButton />
        </div>
      </div>

      {/* View switch: flat table vs grouped by retailer (incl. inactive retailers) */}
      <div className="flex items-center gap-1 mb-5 bg-brand-cream-card rounded-full p-1 w-fit shadow-sm">
        <ViewBtn active={view === "table"} onClick={() => setView("table")} icon={Table2} label="Table" />
        <ViewBtn active={view === "retailer"} onClick={() => setView("retailer")} icon={Store} label="By Retailer" />
        <ViewBtn active={view === "review"} onClick={() => setView("review")} icon={AlertTriangle} label={reviewCount > 0 ? `Review (${reviewCount})` : "Review"} />
      </div>

      {brokenCount > 0 && (
        <div className="flex items-center gap-2 rounded-2xl px-4 py-3 mb-5 bg-brand-gold/15 ring-1 ring-brand-gold/40">
          <AlertTriangle className="w-4 h-4 text-brand-gold" />
          <p className="font-body text-sm text-brand-dark">
            <b className="text-brand-gold">{brokenCount}</b> product{brokenCount === 1 ? "" : "s"} reported broken — needs attention.
          </p>
        </div>
      )}

      {view === "review" ? (
        <NeedsReviewPanel products={products} retailers={retailers} onEdit={setEditing} />
      ) : view === "retailer" ? (
        <>
          <div className="flex flex-wrap items-center gap-3 mb-5">
            <SourceFilterSelect value={sourceFilter} onChange={setSourceFilter} counts={sourceCounts} total={products.length} />
          </div>
          <ProductsByRetailer
            products={sourceFiltered}
            retailers={retailers}
            onEdit={setEditing}
            hideEmpty={sourceFilter !== "all"}
          />
        </>
      ) : (
      <>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-10 w-48 bg-brand-cream-card"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="INACTIVE">Inactive</SelectItem>
            <SelectItem value="NEEDS_REVIEW">Needs review</SelectItem>
            <SelectItem value="REPORTED_BROKEN">Reported broken</SelectItem>
          </SelectContent>
        </Select>
        <Select value={retailerFilter} onValueChange={setRetailerFilter}>
          <SelectTrigger className="h-10 w-48 bg-brand-cream-card"><SelectValue placeholder="Retailer" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All retailers</SelectItem>
            {retailers.map((r) => (
              <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <SourceFilterSelect value={sourceFilter} onChange={setSourceFilter} counts={sourceCounts} total={products.length} />

        {/* Per page selector */}
        <Select value={String(itemsPerPage)} onValueChange={(v) => setItemsPerPage(Number(v))}>
          <SelectTrigger className="h-10 w-32 bg-brand-cream-card"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="25">25 per page</SelectItem>
            <SelectItem value="50">50 per page</SelectItem>
            <SelectItem value="100">100 per page</SelectItem>
            <SelectItem value="200">200 per page</SelectItem>
          </SelectContent>
        </Select>

        {eligibleSelected.length > 0 && (
          <button
            onClick={() => markActive.mutate(eligibleSelected)}
            disabled={markActive.isPending}
            className="ml-auto bg-brand-teal text-brand-cream font-body text-sm font-medium rounded-full px-4 py-2.5 min-h-[44px] hover:bg-brand-teal-dark disabled:opacity-60"
          >
            Mark as Active ({eligibleSelected.length})
          </button>
        )}
      </div>

      {/* Showing X-Y of Z */}
      <div className="flex items-center justify-between mb-3">
        <p className="font-body text-sm text-brand-dark/60">
          Showing {startIndex + 1}–{Math.min(endIndex, totalItems)} of {totalItems} products
        </p>
      </div>

      <div className="bg-brand-cream-card rounded-2xl shadow-sm overflow-x-auto">
        <table className="w-full min-w-[920px]">
          <thead>
            <tr className="text-left font-body text-xs uppercase tracking-wide text-brand-dark/40 border-b border-brand-gold/15">
              <th className="px-4 py-3 w-10"></th>
              <th className="px-4 py-3">Image</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Retailer</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Gender</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Last checked</th>
              <th className="px-4 py-3">Last verified</th>
              <th className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => setGemFirst((v) => !v)}
                  title="Toggle: group by provenance, Gem's Picks first"
                  className={`inline-flex items-center gap-1 uppercase tracking-wide font-body text-xs ${
                    gemFirst ? "text-brand-teal" : "text-brand-dark/40 hover:text-brand-dark"
                  }`}
                >
                  Source <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {paginatedProducts.map((p) => (
              <tr key={p.id} className="border-b border-brand-gold/10 last:border-0">
                <td className="px-4 py-4">
                  <Checkbox checked={selected.includes(p.id)} onCheckedChange={() => toggle(p.id)} />
                </td>
                <td className="px-4 py-4">
                  <ProductThumb src={p.imageUrl || p.image_url} />
                </td>
                <td className="px-4 py-4 font-display text-base text-brand-dark">{p.name}</td>
                <td className="px-4 py-4 font-body text-sm text-brand-dark/70">{retailerName(p.retailerId || p.retailer_id)}</td>
                <td className="px-4 py-4 font-body text-sm text-brand-dark">{p.price != null ? gbp(p.price) : "—"}</td>
                <td className="px-4 py-4 font-body text-sm text-brand-dark/70">{p.category || "—"}</td>
                <td className="px-4 py-4 font-body text-sm text-brand-dark/70">{p.genderAppliesTo || p.gender_applies_to || "—"}</td>
                <td className="px-4 py-4">
                  <span className={`text-xs font-body font-medium px-2.5 py-1 rounded-full ${STATUS_STYLE[p.status] || ""}`}>
                    {STATUS_LABEL[p.status] || p.status}
                  </span>
                </td>
                <td className="px-4 py-4 font-body text-sm text-brand-dark/50">{(p.lastChecked || p.last_checked) ? formatDate(p.lastChecked || p.last_checked) : "—"}</td>
                <td className="px-4 py-4 font-body text-sm text-brand-dark/50">{(p.lastVerified || p.last_verified) ? formatDate(p.lastVerified || p.last_verified) : "—"}</td>
                <td className="px-4 py-4"><SourceBadge product={p} /></td>
                <td className="px-4 py-4 text-right">
                  <button onClick={() => setEditing(p)} className="inline-flex items-center gap-1 text-brand-teal font-body text-sm font-medium">
                    <Pencil className="w-4 h-4" /> Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-5">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="px-3 py-2 rounded-lg font-body text-sm text-brand-dark/70 hover:bg-brand-cream-card disabled:opacity-40 disabled:cursor-not-allowed"
            >
              First
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-2 rounded-lg font-body text-sm text-brand-dark/70 hover:bg-brand-cream-card disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Previous
            </button>
          </div>

          <div className="flex items-center gap-1">
            {/* Show page numbers */}
            {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 7) {
                pageNum = i + 1;
              } else if (currentPage <= 4) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 3) {
                pageNum = totalPages - 6 + i;
              } else {
                pageNum = currentPage - 3 + i;
              }
              
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`w-10 h-10 rounded-lg font-body text-sm ${
                    currentPage === pageNum
                      ? 'bg-brand-teal text-brand-cream font-medium'
                      : 'text-brand-dark/70 hover:bg-brand-cream-card'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-2 rounded-lg font-body text-sm text-brand-dark/70 hover:bg-brand-cream-card disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="px-3 py-2 rounded-lg font-body text-sm text-brand-dark/70 hover:bg-brand-cream-card disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Last
            </button>
          </div>
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="flex flex-col items-center py-14 text-brand-dark/40">
          <Package className="w-8 h-8 mb-2" />
          <p className="font-body text-sm">No products match these filters.</p>
        </div>
      )}
      </>
      )}
    </div>
  );
}

function ViewBtn({ active, onClick, icon: Icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full px-4 py-2 font-body text-sm font-medium transition-colors ${
        active ? "bg-brand-teal text-brand-cream" : "text-brand-dark/60 hover:text-brand-dark"
      }`}
    >
      <Icon className="w-4 h-4" /> {label}
    </button>
  );
}

function SourceFilterSelect({ value, onChange, counts, total }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-10 w-56 bg-brand-cream-card">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All sources ({total})</SelectItem>
        {GROUP_ORDER.map((g) => (
          <SelectItem key={g} value={g}>{GROUP_LABELS[g]} ({counts[g]})</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}