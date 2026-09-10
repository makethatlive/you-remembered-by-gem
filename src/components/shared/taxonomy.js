// Frontend mirror of the canonical taxonomy.
// SYNC RULE: the sync block below (between the two marker comment lines) must be
// byte-identical to base44/shared/taxonomyShared.ts (the frontend cannot import
// base44/shared — @/ maps to src/ only). Any change: bump TAXONOMY_VERSION and
// edit BOTH files in the SAME commit. Verify with the diff command in
// round3/R1-taxonomy.md §R1.2. The marker names are deliberately NOT written out
// in this header so the line-anchored sed/grep checks only ever see the real
// marker lines.

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

// ===== Frontend-only derivations below this line =====

// Structured interests with categories, subcategories, and follow-up questions
// Based on August 2026 client specification
export const STRUCTURED_INTERESTS = {
  "Food & Drink": {
    items: [
      { key: "Cooking & food", hasFollowUp: false },
      { 
        key: "Wine & Drinks", 
        hasFollowUp: true,
        followUpOptions: ["Wine", "Beer", "Cocktails", "Whisky", "Gin", "Rum", "Tequila", "No particular preference"]
      },
      { key: "Coffee & tea", hasFollowUp: false },
    ]
  },
  "Lifestyle & Wellbeing": {
    items: [
      { key: "Travel & adventure", hasFollowUp: false },
      { key: "Wellness & self-care", hasFollowUp: false },
      { key: "Beauty & skincare", hasFollowUp: false },
      { key: "Sustainability & eco living", hasFollowUp: false },
      { key: "Spirituality", hasFollowUp: false },
    ]
  },
  "Sport & Fitness": {
    items: [
      { key: "Running", hasFollowUp: false },
      { key: "Yoga & Pilates", hasFollowUp: false },
      { key: "Swimming", hasFollowUp: false },
      { key: "Football", hasFollowUp: false },
      { key: "Rugby", hasFollowUp: false },
      { key: "Cricket", hasFollowUp: false },
      { key: "Motorsports", hasFollowUp: false },
      { key: "Tennis", hasFollowUp: false },
      { key: "Golf", hasFollowUp: false },
      { key: "Cycling", hasFollowUp: false },
      { key: "Outdoor pursuits", hasFollowUp: false },
    ]
  },
  "Creative & Culture": {
    items: [
      { key: "Reading & books", hasFollowUp: false },
      { key: "Art & culture", hasFollowUp: false },
      { 
        key: "Music", 
        hasFollowUp: true,
        followUpOptions: ["Listening", "Playing an instrument", "Vinyl collecting", "Concerts & live music"]
      },
      { key: "Theatre & performing arts", hasFollowUp: false },
      { key: "Photography", hasFollowUp: false },
      { key: "Crafts & making things", hasFollowUp: false },
      { key: "Film & TV", hasFollowUp: false },
      { key: "Podcasts & audiobooks", hasFollowUp: false },
    ]
  },
  "Home, Style & Objects": {
    items: [
      { key: "Fashion & accessories", hasFollowUp: false },
      { key: "Watches", hasFollowUp: false },
      { key: "Jewellery", hasFollowUp: false },
      { key: "Home & interiors", hasFollowUp: false },
      { key: "Gardening", hasFollowUp: false },
      { key: "DIY & tools", hasFollowUp: false },
    ]
  },
  "Tech, Games & Curiosity": {
    items: [
      { key: "Tech & gadgets", hasFollowUp: false },
      { 
        key: "Gaming (video games)", 
        hasFollowUp: true,
        followUpOptions: ["Console", "PC", "Mobile", "Retro/collector"]
      },
      { key: "Board games & puzzles", hasFollowUp: false },
      { key: "Science & nature", hasFollowUp: false },
      { key: "History & politics", hasFollowUp: false },
    ]
  },
  "Family & Pets": {
    items: [
      { key: "Children & family activities", hasFollowUp: false },
      { 
        key: "Pets", 
        hasFollowUp: true,
        followUpOptions: ["Dog", "Cat", "Other pet"]
      },
    ]
  },
};

// Flat list for backward compatibility (all interests extracted from structured format)
export const INTEREST_OPTIONS = Object.values(STRUCTURED_INTERESTS)
  .flatMap(category => category.items.map(item => item.key))
  .concat(["Other"]);

// Subscriber-facing checkbox lists ("Other" is UI furniture, appended here).
export const GIFT_TYPE_OPTIONS = [
  ...CANONICAL_GIFT_TYPES.filter((e) => e.ui).map((e) => e.key),
  "Other",
];
