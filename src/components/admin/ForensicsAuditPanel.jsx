import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { ClipboardList, Loader2, ExternalLink } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/components/ui/use-toast";

// Admin "Audit" tab — catalogue forensics for the big scrape run (Kate item 9).
// One invocation, no batching: the backend classifies every product and grades
// every retailer, optionally snapshotting the detail into the "Scrape Forensics"
// Google Sheet. Buckets: correctly rejected / needs manual review /
// needs re-enrichment; needs-rescrape is a per-retailer verdict in the table.
const VERDICT_STYLE = {
  ok: "bg-emerald-100 text-emerald-700",
  needs_rescrape: "bg-red-100 text-red-700",
  no_source: "bg-amber-100 text-amber-700",
  inactive_retailer: "bg-brand-dark/10 text-brand-dark/60",
  curated_only: "bg-brand-gold/15 text-brand-dark/70",
};

export default function ForensicsAuditPanel() {
  const [running, setRunning] = useState(false);
  const [writeSheet, setWriteSheet] = useState(false);
  const [result, setResult] = useState(null);

  const run = async () => {
    setRunning(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke("auditScrapeForensics", { write_sheet: writeSheet });
      const data = res?.data || {};
      if (data.error) throw new Error(data.error);
      setResult(data);
      toast({ description: `Audit complete — ${data.totals?.products ?? 0} products classified.` });
    } catch (err) {
      // The SDK rejects on any non-2xx; the real message lives on the response body.
      const msg = err?.response?.data?.error || err.message || "unexpected error";
      toast({ description: `Audit failed — ${msg}` });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="max-w-8xl mx-auto px-5 pt-6 pb-16">
      <div className="flex items-center justify-between mb-2">
        <h1 className="font-display text-3xl text-brand-dark">Catalogue audit</h1>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 font-body text-sm text-brand-dark/70">
            <Checkbox checked={writeSheet} onCheckedChange={(v) => setWriteSheet(v === true)} />
            Also overwrite the Google Sheet
          </label>
          <button
            onClick={run}
            disabled={running}
            className="flex items-center gap-1.5 bg-brand-teal text-brand-cream font-body text-sm font-medium rounded-full px-4 py-2.5 min-h-[44px] hover:bg-brand-teal-dark disabled:opacity-60"
          >
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardList className="w-4 h-4" />}
            {running ? "Auditing…" : "Run forensics audit"}
          </button>
        </div>
      </div>
      <p className="font-body text-sm text-brand-dark/60 mb-3">
        Sorts every catalogue product into correctly rejected, needs manual review, or needs
        re-enrichment, and grades each retailer&apos;s coverage. Your catalogue is never changed
        — the audit only reads it. Rows needing re-enrichment: run Enrich for that retailer
        (Retailers tab), then run this again.
      </p>
      {writeSheet ? (
        <p className="font-body text-sm text-amber-700 bg-amber-50 rounded-xl px-3 py-2 mb-6">
          Sheet writing is on. This run will find (or create) a Google Sheet named Scrape Forensics
          in your Drive, then erase everything on its Products and Coverage tabs and replace it with
          this run. It is a snapshot, not an appended log — anything typed into those two tabs is
          lost. Untick the box to report on screen only.
        </p>
      ) : (
        <p className="font-body text-sm text-brand-dark/50 mb-6">
          Sheet writing is off — this run only reports on screen. Tick the box to also snapshot it
          to the Scrape Forensics sheet, which clears and rewrites that whole spreadsheet each run.
        </p>
      )}

      {result && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <Stat label="Products" value={result.totals.products} />
            <Stat label="Correctly rejected" value={result.totals.correctly_rejected} />
            <Stat label="Needs manual review" value={result.totals.needs_manual_review} />
            <Stat label="Needs re-enrichment" value={result.totals.needs_re_enrichment} />
            <Stat label="Healthy (active)" value={result.totals.healthy} />
            <Stat label="Retailers to rescrape" value={result.totals.retailers_needing_rescrape} />
            <Stat label="Retailers w/o source URL" value={result.totals.retailers_no_source} />
            <Stat label="Run-log rows" value={result.totals.run_log_rows} />
          </div>

          {result.totals.pool_truncated && (
            <p className="font-body text-sm text-red-700 bg-red-50 rounded-xl px-3 py-2 mb-4">
              The catalogue exceeds the 5,000-row read cap — this audit covers the newest 5,000 products only.
            </p>
          )}

          {result.sheet?.spreadsheet_id && (
            <a
              href={`https://docs.google.com/spreadsheets/d/${result.sheet.spreadsheet_id}`}
              target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1.5 font-body text-sm font-medium text-brand-teal mb-4"
            >
              <ExternalLink className="w-4 h-4" />
              Open the Scrape Forensics sheet ({result.sheet.product_rows} product rows, {result.sheet.coverage_rows} retailers)
            </a>
          )}
          {result.sheet?.error && (
            <p className="font-body text-sm text-amber-700 bg-amber-50 rounded-xl px-3 py-2 mb-4">
              Sheet snapshot failed ({result.sheet.error}) — the summary above is still complete.
            </p>
          )}

          <h2 className="font-display text-xl text-brand-dark mb-2">Retailer coverage</h2>
          <div className="bg-brand-cream-card rounded-2xl shadow-sm overflow-x-auto mb-8">
            <table className="w-full min-w-[880px]">
              <thead>
                <tr className="text-left font-body text-xs uppercase tracking-wide text-brand-dark/40 border-b border-brand-gold/15">
                  <th className="px-4 py-3">Retailer</th>
                  <th className="px-4 py-3">Verdict</th>
                  <th className="px-4 py-3">Active</th>
                  <th className="px-4 py-3">Review</th>
                  <th className="px-4 py-3">Inactive</th>
                  <th className="px-4 py-3">Expected</th>
                  <th className="px-4 py-3">Gap</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">Last error</th>
                </tr>
              </thead>
              <tbody>
                {result.coverage.map((c) => (
                  <tr key={c.retailer_id} className="border-b border-brand-gold/10 last:border-0">
                    <td className="px-4 py-3 font-body text-sm text-brand-dark">{c.name}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-body font-medium px-2.5 py-1 rounded-full ${VERDICT_STYLE[c.verdict] || ""}`}>
                        {c.verdict.replaceAll("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-body text-sm">{c.counts.active}</td>
                    <td className="px-4 py-3 font-body text-sm">{c.counts.needs_review}</td>
                    <td className="px-4 py-3 font-body text-sm">{c.counts.inactive}</td>
                    <td className="px-4 py-3 font-body text-sm">{c.expected_found ?? "—"}</td>
                    <td className="px-4 py-3 font-body text-sm">{c.coverage_gap ?? "—"}</td>
                    <td className="px-4 py-3 font-body text-sm">{c.discovery_method || "—"}</td>
                    <td className="px-4 py-3 font-body text-xs text-brand-dark/50 max-w-[240px] truncate" title={c.last_scrape_error}>{c.last_scrape_error || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {["correctly_rejected", "needs_manual_review", "needs_re_enrichment"].map((key) => (
            <div key={key} className="mb-6">
              <h2 className="font-display text-xl text-brand-dark mb-2">
                {key.replaceAll("_", " ")} — first {result.examples[key]?.length ?? 0} of {result.totals[key]}
              </h2>
              <div className="space-y-1.5">
                {(result.examples[key] || []).map((e) => (
                  <p key={e.id} className="font-body text-sm text-brand-dark/60">
                    {e.name} <span className="text-brand-dark/40">({e.retailer} · {e.status} · {e.reasons.join(", ")})</span>
                  </p>
                ))}
              </div>
            </div>
          ))}

          {(result.notes || []).map((n, i) => (
            <p key={i} className="font-body text-xs text-brand-dark/50 mb-1">— {n}</p>
          ))}
        </>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="bg-brand-cream-card rounded-2xl shadow-sm px-4 py-3">
      <p className="font-body text-xs uppercase tracking-wide text-brand-dark/40">{label}</p>
      <p className="font-display text-2xl text-brand-dark">{value}</p>
    </div>
  );
}
