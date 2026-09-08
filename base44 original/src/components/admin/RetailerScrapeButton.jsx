import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { RefreshCw, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

const MAX_BATCHES = 200;

// Per-retailer catalogue scrape: the same resumable batched backend as the full
// scrape, scoped to one retailer via retailer_id. No confirm dialog — one retailer
// is a bounded, non-destructive walk (new products land as needs_review; nothing is
// deleted or deactivated), matching the confirm-free Enrich convention.
// Durable outcome lives on the row itself: coverage stamps refresh via the
// ["retailers"] invalidation (Pulled / 0 found / Stuck badges).
export default function RetailerScrapeButton({ retailer }) {
  const queryClient = useQueryClient();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(null);
  const stopRef = React.useRef(false);
  const cursorKey = `retailerScrapeCursor:${retailer.id}`;

  const run = async () => {
    stopRef.current = false;
    setRunning(true);
    const totals = { batches: 0, new_products: 0, updated: 0, errors: 0 };
    // Resume from the saved cursor of a previous paused/interrupted run, if any.
    let cursor = localStorage.getItem(cursorKey) || null;
    let finished = false;
    try {
      for (let i = 0; i < MAX_BATCHES; i++) {
        const res = await base44.functions.invoke("scrapeCatalogueBatch", {
          retailer_id: retailer.id,
          ...(cursor ? { cursor } : {}),
        });
        const data = res?.data || {};
        if (data.error) throw new Error(data.error);
        totals.batches++;
        totals.new_products += data.batch?.new_products || 0;
        totals.updated += data.batch?.updated || 0;
        totals.errors += data.batch?.errors?.length || 0;
        setProgress({ newProducts: totals.new_products, updated: totals.updated, batches: totals.batches });
        cursor = data.cursor;
        if (cursor) localStorage.setItem(cursorKey, cursor);
        // "Complete" only when the backend explicitly returned done: true.
        if (data.done === true) {
          finished = true;
          break;
        }
        if (!cursor) throw new Error("the scraper did not return a continuation token");
        // Cooperative stop (pressed while running): break AFTER the batch and its
        // cursor save, so the next press resumes exactly here. Nothing is lost.
        if (stopRef.current) break;
      }
      if (finished) {
        localStorage.removeItem(cursorKey);
        toast({ description: `${retailer.name} scraped in ${totals.batches} batch(es) — ${totals.new_products} new (awaiting review), ${totals.updated} updated/verified, ${totals.errors} error(s).` });
      } else {
        toast({ description: stopRef.current
          ? `${retailer.name} scrape stopped after ${totals.batches} batch(es) — progress saved, press Scrape to resume.`
          : `${retailer.name} scrape paused after ${MAX_BATCHES} batches — press Scrape again to continue.` });
      }
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["retailers"] });
      queryClient.invalidateQueries({ queryKey: ["scrape-state"] });
    } catch (err) {
      // SDK rejects on non-2xx — the real message lives on the response body.
      const serverError = err?.response?.data?.error;
      const msg = serverError || err.message || "unexpected error";
      const busy = err?.response?.status === 409 || /already running/i.test(msg);
      // A rejected token (invalid, or minted by a different scrape scope) can never
      // succeed on retry — clear it so the next press starts this retailer fresh.
      if (/continuation token/i.test(msg)) localStorage.removeItem(cursorKey);
      toast({
        description: busy
          ? `Another scrape is still running — wait a few minutes, then press Scrape on ${retailer.name} again. Progress is saved.`
          : `${retailer.name} scrape stopped: ${msg}. Press Scrape again to resume from where it stopped.`,
      });
      queryClient.invalidateQueries({ queryKey: ["retailers"] });
    } finally {
      stopRef.current = false;
      setProgress(null);
      setRunning(false);
    }
  };

  return (
    <span className="inline-flex items-center gap-2">
      <button
        onClick={running ? () => { stopRef.current = true; } : run}
        className="inline-flex items-center gap-1 font-body text-xs text-brand-teal font-medium border border-brand-gold/60 rounded-lg px-3 py-1.5 hover:bg-brand-gold-soft/20"
      >
        {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
        {running ? "Stop" : "Scrape"}
      </button>
      {running && progress && (
        <span className="font-body text-xs text-brand-dark/60 whitespace-nowrap">
          batch {progress.batches} · {progress.newProducts} new · {progress.updated} updated
        </span>
      )}
    </span>
  );
}
