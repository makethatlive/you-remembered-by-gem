// Category bridge — round-3 R6. Maps trendShared.ts trend categories (product FORM:
// earrings, candle, wine ...) onto R1's canonical taxonomy keys (recipient interests /
// gift types), so a product's detected category can match a recipient's stated or
// derived interest DETERMINISTICALLY instead of via free-string haystack luck.
// Plain module — no Deno.serve, imports NOTHING, duplicates NOTHING.
//
// EDITING RULES:
// - Keys MUST be verbatim members of TREND_CATEGORY_KEYWORDS (base44/shared/
//   trendShared.ts). A category may map to several entries; unmapped categories are
//   fine (they simply grant no structural score).
// - Values MUST be verbatim `key` values of CANONICAL_INTERESTS / CANONICAL_GIFT_TYPES
//   (base44/shared/taxonomyShared.ts — R1). ui:false canonical interests (e.g.
//   "Jewellery") are legitimate values: deriveProfile can emit them as
//   canonical_interests even though subscribers cannot tick them.
// - After ANY edit to this file, trendShared.ts's buckets, or R1's taxonomy keys,
//   re-run R6 static check S2 (round3/R6-recengine.md §10).

// Structural bridge: trend category -> canonical interests.
export const CATEGORY_TO_INTEREST: Record<string, string[]> = {
  earrings: ["Fashion & accessories", "Jewellery"],
  necklace: ["Fashion & accessories", "Jewellery"],
  bracelet: ["Fashion & accessories", "Jewellery"],
  ring: ["Fashion & accessories", "Jewellery"],
  bag: ["Fashion & accessories"],
  candle: ["Home & interiors", "Wellness & self-care"],
  perfume: ["Beauty & skincare"],
  skincare: ["Beauty & skincare", "Wellness & self-care"],
  wine: ["Wine & drinks"],
  chocolate: ["Cooking & food"],
  kitchen: ["Cooking & food"],
  coffee_tea: ["Coffee & tea"],
  book: ["Reading & books"],
  stationery: ["Crafts & making things"],
  homeware: ["Home & interiors"],
  experience: ["Travel & adventure"],
  tech: ["Tech & gadgets"],
  game: ["Gaming", "Children & family activities"],
  plant: ["Gardening"],
};

// Structural bridge: trend category -> canonical gift types.
export const CATEGORY_TO_GIFT_TYPE: Record<string, string[]> = {
  earrings: ["Something to wear or carry"],
  necklace: ["Something to wear or carry"],
  bracelet: ["Something to wear or carry"],
  ring: ["Something to wear or carry"],
  bag: ["Something to wear or carry"],
  candle: ["Beautiful objects for the home", "Pampering and self-care"],
  perfume: ["Pampering and self-care"],
  skincare: ["Pampering and self-care"],
  wine: ["Things to eat or drink"],
  chocolate: ["Things to eat or drink"],
  coffee_tea: ["Things to eat or drink"],
  kitchen: ["Practical but high quality"],
  book: ["Books or creative content"],
  stationery: ["Books or creative content"],
  homeware: ["Beautiful objects for the home"],
  experience: ["Experiences"],
  game: ["Toys, games, or activities"],
  plant: ["Beautiful objects for the home"],
};
