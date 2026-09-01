import React, { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Layers, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const MAX_BATCHES = 300;
const CURSOR_STORAGE_KEY = "fullCatalogueScrapeCursor";
const CONFIRM_PHRASE = "SCRAPE ALL";

// Full-catalogue scrape — deliberately demoted to the Retailers tab's Advanced
// section (Kate item 3, round 3): the per-retailer Scrape buttons are the
// recommended path. Guarded by a typed confirmation and a live scope preview.
// Cursor key and batching are unchanged from round 2, so a previously paused
// run still resumes. New products always land as "needs_review" (backend rule,
// scrapeCatalogueBatch:490) and are invisible to gift generation until approved
// in the Products tab's Review queue.
export default function FullCatalogueScrapeButton() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(null);
  const [report, setReport] = useState(null);
  const stopRef = useRef(false);

  // Scope preview — client-side approximation of the backend's "usable" set
  // (active, not curated-only, has a source URL: scrapeCatalogueBatch:608-610).
  // The backend remains authoritative; this is display-only.
  const { data: retailers = [] } = useQuery({
    queryKey: ["retailers"],
    queryFn: () => base44.entities.Retailer.list("name", 5000),
  });
  const scopeCount = retailers.filter(
    (r) => r.active === true && r.curated_only !== true && (r.website_url || r.gift_page_url)
  ).length;

  const hasSavedCursor = !!localStorage.getItem(CURSOR_STORAGE_KEY);

  const run = async () => {
    stopRef.current = false;
    setRunning(true);
    setReport(null);
    const totals = { batches: 0, new_products: 0, updated: 0, rejected: 0, skipped_duplicates: 0, errors: 0 };
    const errorLines = [];
    // Resume from the saved cursor of a previous paused/interrupted run, if any.
    let cursor = localStorage.getItem(CURSOR_STORAGE_KEY) || null;
    let finished = false;
    let stopped = false;
    let scope = null;
    try {
      for (let i = 0; i < MAX_BATCHES; i++) {
        const res = await base44.functions.invoke("scrapeCatalogueBatch", cursor ? { cursor } : {});
        const data = res?.data || {};
        if (data.error) throw new Error(data.error);
        totals.batches++;
        totals.new_products += data.batch?.new_products || 0;
        totals.updated += data.batch?.updated || 0;
        totals.rejected += data.batch?.rejected || 0;
        totals.skipped_duplicates += data.batch?.skipped_duplicates || 0;
        totals.errors += data.batch?.errors?.length || 0;
        for (const e of data.batch?.errors || []) {
          if (errorLines.length < 8 && !errorLines.includes(e)) errorLines.push(e);
        }
        scope = { enabled: data.enabled_retailers, disabled: data.disabled_retailers, noSource: data.skipped_no_source, noSourceNames: data.skipped_no_source_names || [] };
        setProgress({
          remaining: data.retailers_remaining,
          current: data.current_retailer,
          newProducts: totals.new_products,
          updated: totals.updated,
          batches: totals.batches,
        });
        cursor = data.cursor;
        if (cursor) localStorage.setItem(CURSOR_STORAGE_KEY, cursor);
        // "Complete" is only ever shown when the backend explicitly returned done: true.
        if (data.done === true) {
          finished = true;
          break;
        }
        // Not done but no continuation token — a stopped run, never reported as complete.
        if (!cursor) throw new Error("the scraper did not return a continuation token");
        // Cooperative stop: break AFTER the batch and its cursor save — the next
        // press resumes exactly here. Nothing is lost.
        if (stopRef.current) {
          stopped = true;
          break;
        }
      }
      if (finished) {
        // Clear the saved cursor only after a genuinely completed run.
        localStorage.removeItem(CURSOR_STORAGE_KEY);
        setReport(
          `Full catalogue scrape complete in ${totals.batches} batch(es). Retailers: ${scope?.enabled ?? "?"} enabled, ${scope?.disabled ?? 0} disabled (skipped), ${scope?.noSource ?? 0} without a usable source URL (skipped). Products: ${totals.new_products} new (awaiting review), ${totals.updated} updated/verified, ${totals.skipped_duplicates} duplicates skipped, ${totals.rejected} rejected, ${totals.errors} error(s).` +
            (errorLines.length ? ` First errors: ${errorLines.join(" | ")}` : "") +
            (scope?.noSourceNames?.length ? ` Skipped (no source URL): ${scope.noSourceNames.join(", ")}.` : "")
        );
        toast({ description: `Catalogue scrape complete — ${totals.new_products} new products awaiting review.` });
      } else if (stopped) {
        setReport(
          `Scrape stopped by you after ${totals.batches} batch(es) — progress is saved. So far: ${totals.new_products} new (awaiting review), ${totals.updated} updated/verified, ${totals.errors} error(s). Press Full Catalogue Scrape again to resume from where it stopped.`
        );
        toast({ description: "Scrape stopped — progress saved. Press again to resume." });
      } else {
        setReport(
          `Scrape paused after ${MAX_BATCHES} batches — retailers remain. Press again to continue. So far: ${totals.new_products} new, ${totals.updated} updated/verified, ${totals.errors} error(s).` +
            (errorLines.length ? ` First errors: ${errorLines.join(" | ")}` : "")
        );
        toast({ description: "Scrape paused — press Full Catalogue Scrape again to continue." });
      }
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["scrape-state"] });
      queryClient.invalidateQueries({ queryKey: ["retailers"] });
    } catch (err) {
      // The last saved cursor stays in localStorage, so the next press resumes.
      // A 409 ("already running") means another batch is still active — report it as
      // paused rather than failed; everything else is a clear stopped state.
      // The SDK rejects on any non-2xx, so the real message lives on the response body.
      const serverError = err?.response?.data?.error;
      const busy = err?.response?.status === 409 || /already running/i.test(serverError || err.message || "");
      setReport(
        busy
          ? `Scrape paused after ${totals.batches} batch(es): a previous batch is still finishing. Wait a few minutes, then press Full Catalogue Scrape again — progress is saved.`
          : `Scrape stopped after ${totals.batches} batch(es): ${serverError || err.message || "unexpected error"}. Progress so far is saved — run again to continue from where it stopped.`
      );
      // Copy note (round 3, S5): "below the buttons" was accurate only while this
      // button lived in the Products-tab header cluster. It moves to the Retailers
      // tab's Advanced strip as its only control, so the wording is now "below".
      toast({ description: busy ? "Catalogue scrape paused — try again in a few minutes." : "Catalogue scrape stopped — see the report below." });
    } finally {
      stopRef.current = false;
      setProgress(null);
      setRunning(false);
    }
  };

  const openDialog = () => {
    setConfirmText("");
    setOpen(true);
  };

  return (
    <>
      {running ? (
        <button
          onClick={() => { stopRef.current = true; }}
          className="inline-flex items-center gap-2 border border-red-300 text-red-700 font-body text-sm font-medium rounded-full px-4 py-2.5 min-h-[44px] hover:bg-red-50"
        >
          <Loader2 className="w-4 h-4 animate-spin" /> Stop after this batch
        </button>
      ) : (
        <button
          onClick={openDialog}
          className="inline-flex items-center gap-2 border border-brand-teal/50 text-brand-teal font-body text-sm font-medium rounded-full px-4 py-2.5 min-h-[44px] hover:bg-brand-teal/5"
        >
          <Layers className="w-4 h-4" />
          {hasSavedCursor ? "Full Catalogue Scrape (resume)" : "Full Catalogue Scrape"}
        </button>
      )}

      {running && progress && (
        <p className="basis-full font-body text-xs text-brand-dark/60">
          batch {progress.batches} · {progress.remaining} retailer{progress.remaining === 1 ? "" : "s"} remaining
          {progress.current ? ` — currently ${progress.current}` : ""} · {progress.newProducts} new · {progress.updated} updated
        </p>
      )}
      {!running && report && (
        <p className="basis-full font-body text-xs text-brand-dark/70 bg-brand-gold/10 rounded-xl px-3 py-2">{report}</p>
      )}

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Full Catalogue Scrape — are you sure?</AlertDialogTitle>
            <AlertDialogDescription className="font-body">
              This walks the complete catalogue of about {scopeCount} retailer{scopeCount === 1 ? "" : "s"} in small batches and can take a long time.
              For one retailer, use the Scrape button on its row instead.
              New products land as "needs review" — nothing goes live to subscribers until approved in the Products tab's Review queue, and nothing is deleted.
              {hasSavedCursor ? " A previous run is part-finished — this will resume it." : ""}
              {" "}Type {CONFIRM_PHRASE} to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={CONFIRM_PHRASE}
            className="font-body"
          />
          <AlertDialogFooter>
            <AlertDialogCancel className="font-body">Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={confirmText !== CONFIRM_PHRASE}
              className="font-body bg-brand-teal hover:bg-brand-teal-dark disabled:opacity-50"
              onClick={run}
            >
              Start
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}