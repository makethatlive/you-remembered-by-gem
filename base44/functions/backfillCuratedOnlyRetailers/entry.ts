import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Admin-only one-off backfill (round-2 aftercare, added by W5 to close a D3
// publish-timing gap). Pre-publish, Retailer.curated_only is silently dropped on write
// (PRE-PUBLISH REALITY, OPUS-PREVIEW-TEST-PLAN.md Section 0), so every retailer the
// round-2 curated import auto-created during pre-publish Phase D testing (D16) has
// curated_only requested true but stored false/absent. Run ONCE, AFTER Retailer
// publishes (PUBLISH-RUNBOOK.md Step 3b) — run it any earlier and every write here is
// silently dropped too.
//
// Target selection avoids depending on a hand-copied name list: a retailer qualifies
// when it has at least one product AND every one of its products carries source_type
// "curated_product" — exactly the shape only the curated import produces, since the
// scraper never stamps that source_type. Already-true retailers are left alone.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden: Admin access required" }, { status: 403 });

    const svc = base44.asServiceRole;
    const retailers = await svc.entities.Retailer.list("name", 5000);
    const products = await svc.entities.Product.list("-added_date", 5000);

    const byRetailer = new Map();
    for (const p of products) {
      if (!p.retailer_id) continue;
      const c = byRetailer.get(p.retailer_id) || { total: 0, curated: 0 };
      c.total++;
      if (p.source_type === "curated_product") c.curated++;
      byRetailer.set(p.retailer_id, c);
    }

    const alreadySet = [];
    const candidates = [];
    for (const r of retailers) {
      if (r.curated_only === true) { alreadySet.push(r.name); continue; }
      const c = byRetailer.get(r.id);
      if (c && c.total > 0 && c.curated === c.total) candidates.push(r);
    }

    let backfilled = 0;
    const failedNames = [];
    for (const r of candidates) {
      try {
        await svc.entities.Retailer.update(r.id, { curated_only: true });
        backfilled++;
      } catch (_err) {
        failedNames.push(r.name);
      }
    }

    return Response.json({
      retailers_scanned: retailers.length,
      already_curated_only: alreadySet.length,
      backfilled,
      backfilled_names: candidates.filter((r) => !failedNames.includes(r.name)).map((r) => r.name),
      failed_names: failedNames,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
