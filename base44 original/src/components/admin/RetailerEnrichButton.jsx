import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

// Per-row "Enrich" for the Retailers tab (Kate 2026-07-24: per-retailer actions).
// Mounted by RetailersTab with prop {retailer}. Copies RerunScrapeButton's bounded
// enrich loop and stall guard verbatim; the only functional difference is the
// retailer_id body param, which scopes each batch to this retailer's
// active + needs_review products.
export default function RetailerEnrichButton({ retailer }) {
  const queryClient = useQueryClient();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState("");

  const run = async () => {
    setRunning(true);
    try {
      let totalProcessed = 0;
      let remaining = 0;
      // Tagging outcome from the most recent batch, so a silently skipped or failed
      // tagging pass is never reported to Gem as a clean success.
      let taggingLive = true;
      let taggingError = "";
      for (let i = 0; i < 20; i++) {
        const res = await base44.functions.invoke("enrichCatalogueBatch", { batch_size: 40, retailer_id: retailer.id });
        const data = res?.data || {};
        if (data.error) throw new Error(data.error);
        const processed = data.processed || 0;
        totalProcessed += processed;
        remaining = data.remaining || 0;
        taggingLive = data.classification_live !== false;
        taggingError = data.classification_error || "";
        setProgress(`Enriched ${totalProcessed}…`);
        if (remaining === 0 || processed === 0) break;
      }
      const taggingNote = taggingError
        ? ` Product tagging stopped early: ${taggingError}`
        : taggingLive
          ? ""
          : " Product tagging did not run — no tags were updated.";
      toast({ description: `${retailer.name}: enriched ${totalProcessed} product(s). ${remaining} still need enrichment.${taggingNote}` });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["catalog-products-active"] });
    } catch (err) {
      toast({ description: `Enrich stopped: ${err?.response?.data?.error || err.message || "unexpected error"} — press Enrich to retry.` });
    } finally {
      setRunning(false);
      setProgress("");
    }
  };

  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={run}
        disabled={running}
        className="inline-flex items-center gap-1.5 shrink-0 font-body text-xs text-brand-teal font-medium border border-brand-gold/60 rounded-lg px-3 py-1.5 hover:bg-brand-gold-soft/20 disabled:opacity-50"
      >
        {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        {running ? "Enriching…" : "Enrich"}
      </button>
      {running && progress && <span className="font-body text-xs text-brand-dark/60 whitespace-nowrap">{progress}</span>}
    </span>
  );
}