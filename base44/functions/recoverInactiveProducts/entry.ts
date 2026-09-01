import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Admin-only catalogue recovery. Reviews inactive products and moves plausible ones
// back to needs_review (never active). Confirmed-gone and junk products stay inactive.
// No emails are sent.

const NON_PRODUCT_URL_PATTERNS = [
  "sell-my", "sell-your", "/sell", "sell/", "trade-in", "trade_in",
  "valuation", "valuations", "we-buy", "cash-for",
  "/blog", "blog/", "/journal", "journal/", "/news", "news/",
  "/guide", "guides/", "/magazine", "/stories", "/article", "articles/",
  "/about", "about-us", "/contact", "contact-us", "/faq", "/help",
  "/account", "/login", "/register", "/basket", "/cart", "/checkout",
  "/search", "/wishlist", "gift-card", "gift-cards", "/careers",
  "/press", "/terms", "/privacy", "/returns", "/delivery-information",
];

function looksNonProduct(u) {
  const low = (u || "").toLowerCase();
  return NON_PRODUCT_URL_PATTERNS.some((frag) => low.includes(frag));
}

// Junk detection: quality flags, junk titles, editorial titles, non-product URLs.
function isJunkProduct(product) {
  const flags = Array.isArray(product.data_quality_flags) ? product.data_quality_flags : [];
  if (flags.includes("junk_title") || flags.includes("editorial_not_product")) return true;
  const name = (product.name || "").trim();
  if (!name || name.length < 4) return true;
  if (/^(choose|shop now|view product|learn more|skip to|reviews?)\b/i.test(name)) return true;
  if (/\btop \d+\b.*\b(tips|mistakes|faux pas|ways)\b/i.test(name)) return true;
  if (looksNonProduct(product.product_url || product.affiliate_url || "")) return true;
  return false;
}

// Check a product URL. Returns "gone" (confirmed 404/410), "unknown" (timeouts,
// 403, 429, temporary server errors, other inconclusive responses) or "alive".
async function checkUrl(url) {
  if (!url) return "unknown";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; YouRememberedBot/1.0)" },
    });
    // Discard the body — only the status matters. Unread bodies stall the worker's
    // concurrent-request pool and can cancel other in-flight checks on large runs.
    try { await res.body?.cancel(); } catch { /* already consumed/closed */ }
    if (res.status === 404 || res.status === 410) return "gone";
    if (res.ok) return "alive";
    return "unknown"; // 403, 429, 5xx and other inconclusive statuses — not confirmed dead
  } catch {
    return "unknown"; // timeout / network error — not confirmed dead
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden: Admin access required" }, { status: 403 });

    const svc = base44.asServiceRole;
    const inactive = await svc.entities.Product.filter({ status: "inactive" }, "created_date", 5000);

    let recoveredToReview = 0;
    let confirmedGone = 0;
    let excludedAsJunk = 0;
    const toReview = [];

    // Process in concurrent batches of 20 so one slow retailer can't stall the run.
    const BATCH = 20;
    for (let i = 0; i < inactive.length; i += BATCH) {
      const slice = inactive.slice(i, i + BATCH);
      await Promise.all(slice.map(async (product) => {
        if (isJunkProduct(product)) {
          excludedAsJunk++;
          return; // stays inactive
        }
        const result = await checkUrl(product.product_url || product.affiliate_url);
        if (result === "gone") {
          confirmedGone++;
          return; // stays inactive
        }
        // alive or unknown — plausible, not confirmed gone → needs_review (never active)
        toReview.push({ id: product.id, status: "needs_review" });
        recoveredToReview++;
      }));
    }

    // Apply updates in bulk (max 500 per call).
    for (let i = 0; i < toReview.length; i += 500) {
      await svc.entities.Product.bulkUpdate(toReview.slice(i, i + 500));
    }

    return Response.json({
      checked: inactive.length,
      recovered_to_review: recoveredToReview,
      confirmed_gone: confirmedGone,
      excluded_as_junk: excludedAsJunk,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});