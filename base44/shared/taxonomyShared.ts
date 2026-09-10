// Canonical taxonomy — SINGLE SOURCE OF TRUTH for interest categories, gift types,
// audience (gender-relevance), age suitability and restriction tags.
// Round 3, package R1-taxonomy.
//
// SYNC RULE: the sync block below (between the two marker comment lines) must be
// byte-identical to the same block in src/components/shared/taxonomy.js (the
// frontend cannot import base44/shared). Any change: bump TAXONOMY_VERSION and
// edit BOTH files in the SAME commit. Verify with the diff command in
// round3/R1-taxonomy.md §R1.2. The marker names are deliberately NOT written out
// in this header so the line-anchored sed/grep checks only ever see the real
// marker lines.
//
// Plain module — no Deno.serve, no npm imports (mirrors trendShared.ts's pattern).
// NOTE: trendShared.ts's TREND_CATEGORY_KEYWORDS is a DIFFERENT axis (product form,
// used for dedupe/diversity/trend buckets) and deliberately stays separate.

// TAXONOMY-SYNC-START v3.0.0
export const TAXONOMY_VERSION = "3.0.0";

// Interest categories. `ui: true` entries appear (in this order) as subscriber-facing
// checkboxes; `ui: false` entries are Kate's curated-sheet categories — fully
// machine-matchable but not (yet) offered in onboarding. "Other" is UI furniture
// appended by the frontend, never a category.
// `keywords`: lowercase; matched by each consumer's own matcher. Multi-word or
// space-padded tokens (" tv ") are deliberate word-boundary guards.
// `aliases`: alternative spellings, matched after normText-style normalisation
// (lowercase, punctuation stripped, whitespace collapsed).
export const CANONICAL_INTERESTS = [
  { key: "Cooking & food", ui: true,
    keywords: ["cook", "cooking", "chef", "kitchen", "food", "recipe", "bake", "gourmet", "dining", "hamper"],
    aliases: ["food", "cooking", "food and drink"] },
  { key: "Wine & drinks", ui: true,
    keywords: ["wine", "champagne", "prosecco", "sommelier"],
    aliases: ["drinks", "wine and drink"] },
  { key: "Spirits & cocktails", ui: true,
    keywords: ["whisky", "whiskey", "gin", "vodka", "rum", "cocktail", "spirit"],
    aliases: ["spirits", "cocktails"] },
  { key: "Coffee & tea", ui: true,
    keywords: ["coffee", "tea", "espresso", "cafetiere"],
    aliases: ["tea and coffee", "coffee and tea"] },
  { key: "Travel & adventure", ui: true,
    keywords: ["travel", "adventure", "weekend", "luggage", "passport", "trip", "experience"],
    aliases: ["travel"] },
  { key: "Wellness & self-care", ui: true,
    keywords: ["wellness", "spa", "relax", "self care", "massage"],
    aliases: ["wellbeing", "well being", "self care"] },
  { key: "Fitness & sport", ui: true,
    keywords: ["fitness", "sport", "golf", "running", "gym", "training", "cycling"],
    aliases: ["sports", "sport and fitness"] },
  { key: "Reading & books", ui: true,
    keywords: ["book", "reading", "literary", "novel"],
    aliases: ["books", "reading"] },
  { key: "Art & culture", ui: true,
    keywords: ["art", "gallery", "museum", "culture", "print"],
    aliases: ["art", "culture"] },
  { key: "Music", ui: true,
    keywords: ["music", "vinyl", "record", "speaker", "concert"],
    aliases: [] },
  { key: "Fashion & accessories", ui: true,
    keywords: ["fashion", "accessory", "wallet", "scarf", "bag", "jewellery", "jewelry"],
    aliases: ["fashion", "accessories"] },
  { key: "Home & interiors", ui: true,
    keywords: ["home", "interior", "decor", "vase", "blanket", "cushion", "lamp", "candle"],
    aliases: ["home living", "homeware", "home and interiors"] },
  { key: "Gardening", ui: true,
    keywords: ["garden", "plant", "botanical", "flower", "grow"],
    aliases: ["garden"] },
  { key: "Tech & gadgets", ui: true,
    keywords: ["tech", "gadget", "smart", "wireless", "electronic", "charger", "speaker", "headphone"],
    aliases: ["tech", "gadgets", "technology"] },
  { key: "Sustainability & eco living", ui: true,
    keywords: ["sustainable", "sustainability", "eco friendly", "recycled", "reusable", "compostable", "plastic free"],
    aliases: ["eco living", "sustainability", "eco"] },
  { key: "Beauty & skincare", ui: true,
    keywords: ["beauty", "skincare", "cleanser", "shampoo", "conditioner", "grooming", "shave", "beard", "fragrance"],
    aliases: ["beauty", "skincare"] },
  { key: "Theatre & performing arts", ui: true,
    keywords: ["theatre", "theater", "ballet", "opera", "musical", "west end", "pantomime"],
    aliases: ["theatre", "performing arts"] },
  { key: "Crafts & making things", ui: true,
    keywords: ["craft", "crochet", "knitting", "knit", "pottery", "sewing", "embroidery", "make your own", "ceramics", "diy kit"],
    aliases: ["crafts", "crafting", "making things"] },
  { key: "Photography", ui: true,
    keywords: ["photography", "photographer", "camera", "lens", "polaroid", "instax", "photo album", "photo frame"],
    aliases: [] },
  { key: "Outdoor pursuits", ui: true,
    keywords: ["outdoor", "hiking", "camping", "walking", "adventure"],
    aliases: ["outdoors", "outdoor"] },
  { key: "Gaming", ui: true,
    keywords: ["gaming", "game", "console", "puzzle", "video game"],
    aliases: ["games", "video games"] },
  { key: "Film & TV", ui: true,
    keywords: ["film", "cinema", "movie", "television", " tv ", "screen"],
    aliases: ["film and tv", "tv and film", "movies"] },
  { key: "Cycling", ui: true,
    keywords: ["cycling", "cyclist", "bicycle", "bike"],
    aliases: [] },
  { key: "Children & family activities", ui: true,
    keywords: ["family game", "family day out", "for the family", "board game", "family activity", "days out", "picnic"],
    aliases: ["family activities", "family"] },
  { key: "Jewellery", ui: false,
    keywords: ["jewellery", "jewelry", "earring", "necklace", "bracelet", "pendant", "bangle", "brooch", "charm"],
    aliases: ["jewelry"] },
  { key: "Watches", ui: false,
    keywords: ["watches", "wristwatch", "timepiece", "chronograph", "watch strap"],
    aliases: ["watch"] },
  { key: "Spirituality", ui: false,
    keywords: ["spiritual", "spirituality", "tarot", "meditation", "astrology", "zodiac", "crystal healing", "incense", "chakra"],
    aliases: ["spiritual"] },
  { key: "Science & nature", ui: false,
    keywords: ["science", "astronomy", "telescope", "microscope", "wildlife", "botany", "birdwatching", "bird feeder"],
    aliases: ["science and nature", "nature"] },
];

// Gift types. Order = subscriber-facing checkbox order. "Other" appended by UI only.
export const CANONICAL_GIFT_TYPES = [
  { key: "Experiences", ui: true,
    keywords: ["experience", "day out", "afternoon tea", "class", "tour", "ticket", "break", "workshop"] },
  { key: "Things to eat or drink", ui: true,
    keywords: ["food", "drink", "chocolate", "tea", "coffee", "wine", "champagne", "whisky", "hamper", "tasting", "dining"] },
  { key: "Beautiful objects for the home", ui: true,
    keywords: ["home", "interior", "decor", "vase", "candle", "blanket", "art", "glassware"] },
  { key: "Something to wear or carry", ui: true,
    keywords: ["scarf", "gloves", "socks", "jumper", "tote", "bag", "wallet", "purse", "backpack", "jewellery", "jewelry", "earrings", "necklace", "bracelet", "handbag"] },
  { key: "Books or creative content", ui: true,
    keywords: ["book", "novel", "journal", "notebook", "sketchbook", "vinyl", "audiobook", "stationery"] },
  { key: "Personalised or bespoke items", ui: true,
    keywords: ["personalised", "personalized", "bespoke", "custom", "engraved", "monogram"] },
  { key: "Subscriptions or memberships", ui: true,
    keywords: ["subscription", "membership", "club", "monthly"] },
  { key: "Pampering and self-care", ui: true,
    keywords: ["spa day", "spa set", "pamper", "bath", "bathrobe", "skincare", "massage", "aromatherapy", "face mask", "robe", "self care"] },
  { key: "Practical but high quality", ui: true,
    keywords: ["practical", "everyday", "premium", "quality", "leather", "crafted", "durable"] },
  { key: "Quirky and unexpected", ui: true,
    keywords: ["quirky", "unusual", "unexpected", "novelty", "curious", "unique"] },
  { key: "Toys, games, or activities", ui: true,
    keywords: ["toys", "board game", "puzzle", "lego", "jigsaw", "craft kit", "activity set"] },
];
// TAXONOMY-SYNC-END

// ===== Backend-only exports below this line (NOT mirrored to the frontend) =====

// Keyword dictionaries in the exact shape today's consumers expect
// (Record<categoryName, keywords[]>).
export const INTEREST_KEYWORDS: Record<string, string[]> =
  Object.fromEntries(CANONICAL_INTERESTS.map((e) => [e.key, e.keywords]));
export const GIFT_TYPE_KEYWORDS: Record<string, string[]> =
  Object.fromEntries(CANONICAL_GIFT_TYPES.map((e) => [e.key, e.keywords]));

// ---- Category canonicalisation (write-time; readers stay normText-tolerant) ----
// Local copy of generateGiftList's normText (entry.ts:69-75 at b6222e6) — kept here
// so this module stays dependency-free.
function normalise(s: unknown): string {
  return String(s || "")
    .toLowerCase()
    .replace(/&[a-z]+;/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const CATEGORY_LOOKUP: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const e of CANONICAL_INTERESTS) {
    m.set(normalise(e.key), e.key);
    for (const a of e.aliases || []) m.set(normalise(a), e.key);
  }
  return m;
})();

// Returns the canonical interest-category key for a raw category string, or null
// when unknown. Callers must NEVER destroy an unknown value — keep the raw string
// and (where a response exists) report it, so Gem's vocabulary is surfaced, not lost.
export function canonicalCategory(raw: unknown): string | null {
  const n = normalise(raw);
  if (!n) return null;
  return CATEGORY_LOOKUP.get(n) || null;
}

// ---- Audience (gender-relevance) ----
// Canonical read tokens: "female" | "male" | "any".
// Moved from generateGiftList/entry.ts:841-848 (b6222e6) with TWO deliberate changes:
// (1) "Non-binary" and "Prefer not to say" now normalise to "any", which is what the
//     generation filter's own comment ("recipient has no specific gender — don't
//     exclude") always intended. Behaviour change flagged in R1-taxonomy.md §R1.10.
// (2) boy(s)/girl(s) now classify as male/female, so sheet Gender cells like "Boys"
//     keep their gender signal instead of falling through unrecognised (§R1.6-E
//     edit 4; also flagged in §R1.10).
export function normaliseAudience(raw: unknown): string {
  const g = String(raw || "").trim().toLowerCase();
  if (!g) return "any";
  if (/(non[\s-]?binary|prefer not)/.test(g)) return "any";
  if (/(women|female|woman|ladies|girl|^f$)/.test(g)) return "female";
  if (/(\bmen\b|male|man|gents|boy|^m$)/.test(g)) return "male";
  if (/(unisex|any|all|kids|child)/.test(g)) return "any";
  return g;
}

// Canonical WRITE values for Product.gender_applies_to. Writers must emit only
// these (or leave the field blank so the retailer-category fallback applies).
export function writeAudience(raw: unknown): string {
  const token = normaliseAudience(raw);
  if (!String(raw || "").trim()) return ""; // blank stays blank — retailer fallback
  if (token === "female") return "Female";
  if (token === "male") return "Male";
  return "Unisex";
}

// ---- Age suitability ----
// Product write vocabulary (Product.suitable_age_bands enum — the ONLY values
// writers may emit) vs Recipient read vocabulary (Recipient.age_band enum).
export const PRODUCT_AGE_BANDS = ["Under 5", "5-10", "11-17", "18+"];
export const RECIPIENT_AGE_BANDS = ["Under 5", "5-10", "11-17", "18-30", "31-50", "51-70", "71+"];
export const UNDER_18_BANDS = new Set(["Under 5", "5-10", "11-17"]);

// Moved verbatim from generateGiftList/entry.ts:891-894 (b6222e6).
export function recipientBandToProductBand(band: unknown): string {
  if (band === "Under 5" || band === "5-10" || band === "11-17") return band;
  return "18+";
}

// Gem's sheet Age vocabulary -> suitable_age_bands. Moved verbatim from
// importCuratedProducts/entry.ts:59-67 (b6222e6).
export const SHEET_AGE_MAP: Record<string, string[]> = {
  "1-2": ["Under 5"],
  "3-4": ["Under 5"],
  "5-6": ["5-10"],
  "7-8": ["5-10"],
  "9-11": ["5-10", "11-17"],
  "12-17": ["11-17"],
  "kids": ["Under 5", "5-10", "11-17"],
};

// ---- Restriction tags ----
// Moved verbatim from generateGiftList/entry.ts:916-926 (b6222e6). Keys are the
// canonical restriction vocabulary; RESTRICTION_KEYS replaces the hand-kept
// DERIVED_AVOID_CATEGORY_KEYS duplicate (entry.ts:438-440) so the avoid filter and
// the derive-avoid whitelist can never drift again.
export const AVOID_SYNONYMS: Record<string, string[]> = {
  alcohol: ["wine", "champagne", "prosecco", "beer", "spirit", "whisky", "whiskey", "gin", "vodka", "rum", "cocktail", "liqueur", "cider", "ale"],
  nuts: ["nut", "peanut", "almond", "cashew", "pistachio", "hazelnut"],
  meat: ["meat", "beef", "pork", "bacon", "sausage", "steak", "ham"],
  dairy: ["dairy", "cheese", "milk", "cream", "yoghurt", "yogurt"],
  fur: ["fur"],
  leather: ["leather"],
  candles: ["candle"],
  chocolate: ["chocolate", "cocoa"],
  perfume: ["perfume", "fragrance", "cologne", "eau de"],
};
export const RESTRICTION_KEYS = Object.keys(AVOID_SYNONYMS);
