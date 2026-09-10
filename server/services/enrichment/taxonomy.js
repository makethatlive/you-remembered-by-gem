/**
 * Canonical taxonomy for interest categories, gift types, audience, and age suitability
 * This is the SINGLE SOURCE OF TRUTH for product classification
 */

export const TAXONOMY_VERSION = "3.0.0";

// Interest categories - matched against product text for tagging
export const CANONICAL_INTERESTS = [
  { key: "Cooking & food", ui: true,
    keywords: ["cook", "cooking", "chef", "kitchen", "food", "recipe", "bake", "gourmet", "dining", "hamper"] },
  { key: "Wine & drinks", ui: true,
    keywords: ["wine", "champagne", "prosecco", "sommelier"] },
  { key: "Spirits & cocktails", ui: true,
    keywords: ["whisky", "whiskey", "gin", "vodka", "rum", "cocktail", "spirit"] },
  { key: "Coffee & tea", ui: true,
    keywords: ["coffee", "tea", "espresso", "cafetiere"] },
  { key: "Travel & adventure", ui: true,
    keywords: ["travel", "adventure", "weekend", "luggage", "passport", "trip", "experience"] },
  { key: "Wellness & self-care", ui: true,
    keywords: ["wellness", "spa", "relax", "self care", "massage"] },
  { key: "Fitness & sport", ui: true,
    keywords: ["fitness", "sport", "golf", "running", "gym", "training", "cycling"] },
  { key: "Reading & books", ui: true,
    keywords: ["book", "reading", "literary", "novel"] },
  { key: "Art & culture", ui: true,
    keywords: ["art", "gallery", "museum", "culture", "print"] },
  { key: "Music", ui: true,
    keywords: ["music", "vinyl", "record", "speaker", "concert"] },
  { key: "Fashion & accessories", ui: true,
    keywords: ["fashion", "accessory", "wallet", "scarf", "bag", "jewellery", "jewelry"] },
  { key: "Home & interiors", ui: true,
    keywords: ["home", "interior", "decor", "vase", "blanket", "cushion", "lamp", "candle"] },
  { key: "Gardening", ui: true,
    keywords: ["garden", "plant", "botanical", "flower", "grow"] },
  { key: "Tech & gadgets", ui: true,
    keywords: ["tech", "gadget", "smart", "wireless", "electronic", "charger", "speaker", "headphone"] },
  { key: "Sustainability & eco living", ui: true,
    keywords: ["sustainable", "sustainability", "eco friendly", "recycled", "reusable", "compostable", "plastic free"] },
  { key: "Beauty & skincare", ui: true,
    keywords: ["beauty", "skincare", "cleanser", "shampoo", "conditioner", "grooming", "shave", "beard", "fragrance"] },
  { key: "Theatre & performing arts", ui: true,
    keywords: ["theatre", "theater", "ballet", "opera", "musical", "west end", "pantomime"] },
  { key: "Crafts & making things", ui: true,
    keywords: ["craft", "crochet", "knitting", "knit", "pottery", "sewing", "embroidery", "make your own", "ceramics", "diy kit"] },
  { key: "Photography", ui: true,
    keywords: ["photography", "photographer", "camera", "lens", "polaroid", "instax", "photo album", "photo frame"] },
  { key: "Outdoor pursuits", ui: true,
    keywords: ["outdoor", "hiking", "camping", "walking", "adventure"] },
  { key: "Gaming", ui: true,
    keywords: ["gaming", "game", "console", "puzzle", "video game"] },
  { key: "Film & TV", ui: true,
    keywords: ["film", "cinema", "movie", "television", " tv ", "screen"] },
  { key: "Cycling", ui: true,
    keywords: ["cycling", "cyclist", "bicycle", "bike"] },
  { key: "Children & family activities", ui: true,
    keywords: ["family game", "family day out", "for the family", "board game", "family activity", "days out", "picnic"] },
  { key: "Jewellery", ui: false,
    keywords: ["jewellery", "jewelry", "earring", "necklace", "bracelet", "pendant", "bangle", "brooch", "charm"] },
  { key: "Watches", ui: false,
    keywords: ["watches", "wristwatch", "timepiece", "chronograph", "watch strap"] },
  { key: "Spirituality", ui: false,
    keywords: ["spiritual", "spirituality", "tarot", "meditation", "astrology", "zodiac", "crystal healing", "incense", "chakra"] },
  { key: "Science & nature", ui: false,
    keywords: ["science", "astronomy", "telescope", "microscope", "wildlife", "botany", "birdwatching", "bird feeder"] },
];

// Gift types - matched against product text for tagging
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

// Keyword dictionaries for matching
export const INTEREST_KEYWORDS = Object.fromEntries(
  CANONICAL_INTERESTS.map((e) => [e.key, e.keywords])
);

export const GIFT_TYPE_KEYWORDS = Object.fromEntries(
  CANONICAL_GIFT_TYPES.map((e) => [e.key, e.keywords])
);

// Product age bands (what we store on products)
export const PRODUCT_AGE_BANDS = ["Under 5", "5-10", "11-17", "18+"];

// Gender values
export const GENDER_VALUES = ["men", "women", "unisex"];

// Category normalization for canonical matching
function normalise(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/&[a-z]+;/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Build lookup map for category aliases
const CATEGORY_LOOKUP = (() => {
  const m = new Map();
  const aliases = {
    "Cooking & food": ["food", "cooking", "food and drink"],
    "Wine & drinks": ["drinks", "wine and drink"],
    "Spirits & cocktails": ["spirits", "cocktails"],
    "Coffee & tea": ["tea and coffee", "coffee and tea"],
    "Travel & adventure": ["travel"],
    "Wellness & self-care": ["wellbeing", "well being", "self care"],
    "Fitness & sport": ["sports", "sport and fitness"],
    "Reading & books": ["books", "reading"],
    "Art & culture": ["art", "culture"],
    "Fashion & accessories": ["fashion", "accessories"],
    "Home & interiors": ["home living", "homeware", "home and interiors"],
    "Gardening": ["garden"],
    "Tech & gadgets": ["tech", "gadgets", "technology"],
    "Sustainability & eco living": ["eco living", "sustainability", "eco"],
    "Beauty & skincare": ["beauty", "skincare"],
    "Theatre & performing arts": ["theatre", "performing arts"],
    "Crafts & making things": ["crafts", "crafting", "making things"],
    "Outdoor pursuits": ["outdoors", "outdoor"],
    "Gaming": ["games", "video games"],
    "Film & TV": ["film and tv", "tv and film", "movies"],
    "Cars & motoring": ["cars", "motoring"],
    "Children & family activities": ["family activities", "family"],
    "Jewellery": ["jewelry"],
    "Watches": ["watch"],
    "Spirituality": ["spiritual"],
    "Science & nature": ["science and nature", "nature"],
  };
  
  for (const interest of CANONICAL_INTERESTS) {
    m.set(normalise(interest.key), interest.key);
    const categoryAliases = aliases[interest.key] || [];
    for (const alias of categoryAliases) {
      m.set(normalise(alias), interest.key);
    }
  }
  return m;
})();

// Get canonical category from raw string
export function canonicalCategory(raw) {
  const n = normalise(raw);
  if (!n) return null;
  return CATEGORY_LOOKUP.get(n) || null;
}

// Get all canonical category keys
export const CANONICAL_CATEGORIES = CANONICAL_INTERESTS.map(i => i.key);
