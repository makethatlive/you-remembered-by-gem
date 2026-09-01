import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { RefreshCw, Loader2, Sparkles } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const CURSOR_STORAGE_KEY = "availabilityCheckCursor";

export default function RerunScrapeButton() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [enriching, setEnriching] = useState(false);

  // Keep the shared ScrapeState cache warm while this sweep runs. The availability
  // check takes NO ScrapeState lock, so the lock must never gate this button —
  // otherwise a stuck catalogue-scrape lock would disable the sweep entirely.
  useQuery({
    queryKey: ["scrape-state"],
    queryFn: () => base44.entities.ScrapeState.list(),
    refetchInterval: running ? 5000 : false,
  });
  const isBusy = running;

  const runScrape = async () => {
    setRunning(true);
    try {
      let totalProcessed = 0;
      // Resume from the saved cursor of a previous capped/interrupted sweep, if any.
      const saved = Number(localStorage.getItem(CURSOR_STORAGE_KEY));
      let cursor = Number.isFinite(saved) && saved > 0 ? saved : 0;
      let finished = false;
      for (let i = 0; i < 100; i++) {
        const res = await base44.functions.invoke("checkAvailabilityBatch", { cursor, batch_size: 25 });
        const data = res?.data || {};
        if (data.error) throw new Error(data.error);
        const processed = data.processed || 0;
        totalProcessed += processed;
        cursor = typeof data.next_cursor === "number" ? data.next_cursor : cursor + processed;
        if (data.done === true) {
          finished = true;
          break;
        }
        // Save progress after every batch so the next press resumes here.
        localStorage.setItem(CURSOR_STORAGE_KEY, String(cursor));
        if (processed === 0) break;
      }
      // Clear the saved cursor only after a genuinely completed sweep.
      if (finished) localStorage.removeItem(CURSOR_STORAGE_KEY);
      toast({
        description: finished
          ? `Availability check complete — ${totalProcessed} product(s) checked.`
          : `Checked ${totalProcessed} product(s) — press Re-run Scrape again to continue.`,
      });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["scrape-state"] });
    } catch (err) {
      toast({ description: `Scrape stopped: ${err?.response?.data?.error || err.message || "unexpected error"} — run again to retry.` });
    } finally {
      setRunning(false);
    }
  };

  const enrichCatalogue = async () => {
    setEnriching(true);
    try {
      let totalProcessed = 0;
      let remaining = 0;
      // Tagging outcome from the most recent batch, so a silently skipped or failed
      // tagging pass is never reported to Gem as a clean success.
      let taggingLive = true;
      let taggingError = "";
      for (let i = 0; i < 20; i++) {
        const res = await base44.functions.invoke("enrichCatalogueBatch", { batch_size: 40 });
        const data = res?.data || {};
        if (data.error) throw new Error(data.error);
        const processed = data.processed || 0;
        totalProcessed += processed;
        remaining = data.remaining || 0;
        taggingLive = data.classification_live !== false;
        taggingError = data.classification_error || "";
        if (remaining === 0 || processed === 0) break;
      }
      const taggingNote = taggingError
        ? ` Product tagging stopped early: ${taggingError}`
        : taggingLive
          ? ""
          : " Product tagging did not run — no tags were updated.";
      toast({ description: `Enriched ${totalProcessed} products. ${remaining} still need enrichment.${taggingNote}` });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["catalog-products-active"] });
    } catch {
      toast({ description: "Catalogue enrichment couldn't complete — please try again." });
    } finally {
      setEnriching(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setOpen(true)}
          disabled={isBusy || enriching}
          className="inline-flex items-center gap-2 bg-brand-teal text-brand-cream font-body text-sm font-medium rounded-full px-4 py-2.5 min-h-[44px] hover:bg-brand-teal-dark disabled:opacity-50"
        >
          {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {isBusy ? "Scraping…" : "Re-run Scrape"}
        </button>
        <button
          onClick={enrichCatalogue}
          disabled={isBusy || enriching}
          className="inline-flex items-center gap-2 border border-brand-gold/60 text-brand-teal font-body text-sm font-medium rounded-full px-4 py-2.5 min-h-[44px] hover:bg-brand-gold-soft/20 disabled:opacity-50"
        >
          {enriching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {enriching ? "Enriching catalogue…" : "Enrich catalogue"}
        </button>
      </div>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Re-run Scrape</AlertDialogTitle>
            <AlertDialogDescription className="font-body">
              This will check all active products for availability and add new items from retailer pages. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-body">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="font-body bg-brand-teal hover:bg-brand-teal-dark"
              onClick={runScrape}
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}