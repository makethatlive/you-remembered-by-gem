import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { detectTrendCategory, priceBand, TASTE_REJECTION_REASONS, bucketScore } from "../../shared/trendShared.ts";

// Admin-triggered aggregation of GiftItem feedback into the TrendStats singleton.
// Deliberately zero AI calls, zero emails, no cron and no polling — Gem clicks
// "Refresh trend stats" and this recomputes the single stat_key "global" row.

// Accumulate one item's signals into a bucket map keyed by category / retailer / price band.
function addTo(map, key, loved, purchased, rejected) {
  if (!key) return; // unrecognised bucket — never blocks the other buckets
  const current = map.get(key) || { loved: 0, purchased: 0, rejected: 0 };
  current.loved += loved;
  current.purchased += purchased;
  current.rejected += rejected;
  map.set(key, current);
}

// Map -> stats-item array, sorted by total signal volume, optionally capped.
function toStats(map, cap) {
  const rows = [...map.entries()].map(([key, v]) => ({
    key,
    loved: v.loved,
    purchased: v.purchased,
    rejected: v.rejected,
    score: Math.round(bucketScore(v.loved + v.purchased, v.rejected) * 1000) / 1000,
  }));
  rows.sort(
    (a, b) => (b.loved + b.purchased + b.rejected) - (a.loved + a.purchased + a.rejected)
  );
  return cap ? rows.slice(0, cap) : rows;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Admin-only. A failed auth check always rejects outright; it never falls back
    // to an "allowed" state. No internal-secret path — this is a manual admin action.
    const user = await base44.auth.me().catch(() => null);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.role !== "admin") {
      return Response.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const svc = base44.asServiceRole;

    const items = await svc.entities.GiftItem.list("-created_date", 5000);

    const agg = { category: new Map(), retailer: new Map(), band: new Map() };
    const reasonCounts = new Map();
    const lovedTitles = [];
    const rejectedTitles = [];

    // Newest first, so the recent-titles lists stay genuinely recent.
    for (const item of items) {
      const loved = item.feedback === "loved_it" ? 1 : 0;
      const purchased = item.subscriber_action === "purchased" ? 1 : 0;
      const rejected =
        (item.feedback === "bad_suggestion" || TASTE_REJECTION_REASONS.includes(item.admin_feedback_reason))
          ? 1
          : 0;

      // Every removal reason is counted here, including bad_link_or_data — this list is
      // Gem's process view, not the taste signal.
      if (item.admin_feedback_reason) {
        reasonCounts.set(item.admin_feedback_reason, (reasonCounts.get(item.admin_feedback_reason) || 0) + 1);
      }

      if (loved + purchased > 0 && lovedTitles.length < 10) lovedTitles.push(item.title);
      if (rejected && rejectedTitles.length < 10) rejectedTitles.push(item.title);

      // No signal at all — nothing to learn from, so it never dilutes a bucket.
      if (loved + purchased + rejected === 0) continue;

      addTo(agg.category, detectTrendCategory(item.title, item.description), loved, purchased, rejected);
      addTo(agg.retailer, (item.retailer_name || "").trim(), loved, purchased, rejected);
      addTo(agg.band, priceBand(item.price), loved, purchased, rejected);
    }

    const category_stats = toStats(agg.category, 30);
    const retailer_stats = toStats(agg.retailer, 50);
    const price_band_stats = toStats(agg.band, 0); // max 5 bands — no cap needed

    const rejection_reason_counts = [...reasonCounts.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count);

    const computed_at = new Date().toISOString();
    const payload = {
      stat_key: "global",
      computed_at,
      items_analysed: items.length,
      category_stats,
      retailer_stats,
      price_band_stats,
      rejection_reason_counts,
      recent_loved_titles: lovedTitles,
      recent_rejected_titles: rejectedTitles,
    };

    // Singleton upsert — re-invoking must update the same row, never duplicate it.
    const existing = await svc.entities.TrendStats.filter({ stat_key: "global" });
    if (existing && existing.length > 0) {
      await svc.entities.TrendStats.update(existing[0].id, payload);
    } else {
      await svc.entities.TrendStats.create(payload);
    }

    return Response.json({
      status: "ok",
      items_analysed: items.length,
      categories: category_stats.length,
      retailers: retailer_stats.length,
      computed_at,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
