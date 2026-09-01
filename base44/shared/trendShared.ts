// Shared trend-learning helpers used by computeTrendStats and generateGiftList.
// Plain module — no Deno.serve, no imports from any function directory.

// Category keywords used for trend bucketing. The first nine entries mirror
// generateGiftList's CATEGORY_KEYWORDS verbatim; the rest widen coverage so more
// of the catalogue lands in a bucket rather than being ignored.
export const TREND_CATEGORY_KEYWORDS: Record<string, string[]> = {
  earrings: ["earring", "earrings"],
  necklace: ["necklace", "pendant"],
  bracelet: ["bracelet", "bangle"],
  ring: ["ring"],
  candle: ["candle"],
  perfume: ["perfume", "fragrance", "cologne", "eau de"],
  wine: ["wine", "champagne", "prosecco"],
  chocolate: ["chocolate"],
  book: ["book"],
  skincare: ["skincare", "moisturiser", "serum", "cleanser", "beauty"],
  homeware: ["vase", "cushion", "blanket", "throw", "lamp", "decor"],
  kitchen: ["kitchen", "cook", "chef", "baking", "pan"],
  experience: ["experience", "voucher", "day out", "afternoon tea", "class", "workshop", "tour"],
  tech: ["gadget", "wireless", "speaker", "charger", "smart"],
  stationery: ["notebook", "journal", "pen", "stationery"],
  bag: ["bag", "tote", "wallet", "purse"],
  game: ["game", "puzzle", "jigsaw"],
  plant: ["plant", "botanical", "flower", "bouquet"],
  coffee_tea: ["coffee", "tea", "espresso"],
};

export function detectTrendCategory(title, description) {
  const text = `${title || ""} ${description || ""}`.toLowerCase();
  for (const [cat, keywords] of Object.entries(TREND_CATEGORY_KEYWORDS)) {
    if (keywords.some((k) => text.includes(k))) return cat;
  }
  return null; // unrecognised category — never blocks another item
}

export function priceBand(price) {
  if (!Number.isFinite(price)) return null; // missing/unparseable price is never bucketed
  if (price < 15) return "under_15";
  if (price < 30) return "15_30";
  if (price < 50) return "30_50";
  if (price < 100) return "50_100";
  return "100_plus";
}

// Removal reasons that describe TASTE (what the gift is like). Deliberately excludes
// duplicate, bad_link_or_data and other — those are data/process problems, not taste.
// Used ONLY for trend counts.
export const TASTE_REJECTION_REASONS = ["wrong_age", "wrong_audience", "not_relevant", "too_generic", "poor_quality"];

// Everything except bad_link_or_data. Used for hard exclusions + prompt history so Gem's
// 'other'/'duplicate' removals keep excluding, while broken-link removals stop poisoning
// taste — the broken product is already reported_broken and filtered out of the pool.
export const EXCLUDED_FEEDBACK_REASONS = ["wrong_age", "wrong_audience", "not_relevant", "too_generic", "poor_quality", "duplicate", "other"];

// Laplace-smoothed net approval in (-1, 1): one lone signal only moves it about ±0.2,
// so a single grumpy (or delighted) subscriber cannot swing a bucket.
export function bucketScore(pos, neg) {
  return (pos - neg) / (pos + neg + 4);
}
