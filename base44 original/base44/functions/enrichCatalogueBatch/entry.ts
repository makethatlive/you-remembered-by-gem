import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { INTEREST_KEYWORDS as INTEREST_RULES, GIFT_TYPE_KEYWORDS as GIFT_TYPE_RULES, canonicalCategory } from "../../shared/taxonomyShared.ts";
// R3: deriveAgeBands is imported ONLY to recompute the scraper's deterministic band
// stamp for the age-bands provenance test — shared-module relative import, .ts
// extension, same pattern as scrapeCatalogueBatch/entry.ts:2-6.
// R4: CHILD_PATTERNS is the same child-evidence vocabulary deriveAgeBands uses, so
// the safety rules below agree with the scraper rather than inventing a rival test.
import { deriveAgeBands, CHILD_PATTERNS } from "../../shared/scrapeShared.ts";

// ===== R3 (R4-enrich): classification constants =====
// Redeploy marker 2026-08-01: the live build had drifted behind this source and was
// still running the v1 body (no classification track), so Enrich reported success
// while stamping nothing. Do not remove — it exists to pin the deployed version.
// Bumped to 3 (2026-08-01, Kate approved): the gender/age-band ownership test below was
// widened, so every already-stamped row must be reclassified for the fix to reach it.
// Bumped to 5 (2026-08-02): the child-safety age rules below are new, and a row already
// stamped at v4 is never revisited — including the exact wallpaper/candle rows the
// rules exist to correct. Without this bump the fix cannot reach them.
const CLASSIFY_VERSION = 5;
const CLASSIFY_PER_RUN = 15; // exactly one InvokeLLM call per invocation
const CANONICAL_CATEGORIES = Object.keys(INTEREST_RULES); // the R1 canonical taxonomy
const PRODUCT_AGE_BANDS = ["Under 5", "5-10", "11-17", "18+"]; // Product enum ONLY — never the Recipient 7-band vocabulary
const GENDER_VALUES = ["men", "women", "unisex"]; // all three map correctly through generateGiftList's normaliseGender
// Round-3 provenance classes. curated_product = Gem's hand-picked rows (import, Add
// Product, approval swaps); legacy_unknown = provenance unproven — the prime directive
// says treat unproven as human. Only the two scraper classes are provably machine-written.
const HUMANISH_SOURCES = new Set(["curated_product", "legacy_unknown"]);
const MACHINE_SOURCES = new Set(["curated_retailer", "shopify_upload"]);
const LOW_CONFIDENCE_FLAG = "classification_low_confidence";

// ===== R4 (2026-08-02): child-safety age rules =====
// Three deterministic layers applied AFTER the model's verdict. They exist because
// the model cannot be relied on for this: on the exact rows Kate reported
// (wallpaper, candles) it declines to answer at all — 0.5 confidence, verdict
// refused — which leaves the retailer-inherited "11-17" in place. So these rules
// run whether or not the verdict was applied; that is what reaches those rows.
// They only ever REMOVE bands from a list that already exists. They never create a
// band list, never widen one, and never touch any other field.
const KID_BANDS = ["Under 5", "5-10", "11-17"];
const UNDER_11_BANDS = ["Under 5", "5-10"];

// Layer 1a — categories where no child is a plausible recipient.
const ADULT_ONLY_CATEGORIES = new Set([
  "Wine & drinks", "Spirits & cocktails", "Coffee & tea", "Home & interiors",
  "Gardening", "Cars & motoring", "Wellness & self-care", "Beauty & skincare",
  "Spirituality",
]);
// Layer 1b — plausible for teenagers, not for young children.
const TEEN_ONLY_CATEGORIES = new Set([
  "Jewellery", "Watches", "Fashion & accessories", "Photography",
]);
// Layer 3 — the categories that genuinely ARE about children.
const CHILD_CATEGORIES = new Set([
  "Children & family activities", "Toys, games, or activities",
]);

// Layer 2 — adult-content signals that override the category entirely. This is the
// film/music/gaming hole: "Film & TV", "Music" and "Gaming" are kid-PLAUSIBLE
// categories, so without this nothing stops an 18-rated film or an explicit album
// landing on a child's list. Certificate tokens require their label and are
// word-boundary anchored: a bare /\b18\b/ would match "18cm" and "18-piece set",
// the same substring trap PF-2 fixed for "/news" in round 3. "blade" is
// deliberately NOT a token (razor blades, blade grinders — "Nitro Blade" is a
// coffee grinder in Gem's own list); UK-restricted knives are matched by name.
const ADULT_CONTENT_PATTERNS = [
  /\b(?:bbfc|pegi|esrb|cert(?:ificate)?|rated|rating)\s*:?\s*(?:15|16|18)\b/i,
  /\b(?:15|18)\s*\+/,
  /\br[- ]?rated\b/i,
  /\bover[- ]?18s?\b/i,
  /\bparental advisory\b/i,
  /\bexplicit (?:lyrics|content|version)\b/i,
  /\b(?:horror|slasher|gore|true crime)\b/i,
  /\b(?:erotic|erotica|adults? only|nsfw|sex toy|lingerie)\b/i,
  /\b(?:casino|gambling|poker set|betting|roulette)\b/i,
  /\b(?:vape|vaping|e-?liquid|tobacco|cigar|cigarette|nicotine)\b/i,
  /\b(?:knife|knives|machete)\b/i,
];

function productText(product) {
  return `${product?.name || ""} ${product?.description || ""} ${product?.category || ""} ${product?.product_url || ""}`;
}

function hasAdultContent(product) {
  const text = productText(product);
  return ADULT_CONTENT_PATTERNS.some((pattern) => pattern.test(text));
}

// Layer 3's evidence test: something must actively say "this is for children".
// Subject matter a child might enjoy is NOT evidence — that is the whole point.
function hasChildEvidence(product, category, retailer) {
  if (CHILD_CATEGORIES.has(category)) return true;
  const retailerCategory = retailer?.category || "";
  if (retailerCategory === "Kids" || retailerCategory === "Unisex + Kids") return true;
  return CHILD_PATTERNS.some((pattern) => pattern.test(productText(product)));
}

// Returns the safety-adjusted band list. Subtractive only; callers must not invoke
// it on an empty list (an absent band list is left absent, never invented).
function applyAgeSafetyRules(bands, { product, category, retailer, gemOwned }) {
  let out = Array.isArray(bands) ? [...bands] : [];

  // Layer 2 runs on EVERY row, Gem's curated ones included. A legally adult
  // product must never reach a child's list, whoever entered it — the same
  // monotonic-safety exception to the prime directive that the age_restricted
  // false -> true escalation already makes. Layers 1 and 3 are curation
  // judgement rather than safety, so Gem's own rows keep full protection there.
  if (hasAdultContent(product)) out = out.filter((band) => !KID_BANDS.includes(band));

  if (!gemOwned) {
    if (ADULT_ONLY_CATEGORIES.has(category)) {
      out = out.filter((band) => !KID_BANDS.includes(band));
    } else if (TEEN_ONLY_CATEGORIES.has(category)) {
      out = out.filter((band) => !UNDER_11_BANDS.includes(band));
    }
    // Under-11 is opt-in on evidence, never a guess. A random Film & TV or Music
    // row with no child signal therefore tops out at 11-17.
    if (!hasChildEvidence(product, category, retailer)) {
      out = out.filter((band) => !UNDER_11_BANDS.includes(band));
    }
  }

  // Emptying the list would make the product invisible to every recipient; 18+ is
  // the correct terminal value for something that just failed every child test.
  return out.length ? out : ["18+"];
}

function decode(value) {
  return (value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function metaDescription(html) {
  const patterns = [
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i,
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decode(match[1]).slice(0, 800);
  }
  return "";
}

async function fetchDescription(url) {
  if (!url) return "";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; YouRememberedBot/1.0)" },
    });
    if (!response.ok) return "";
    return metaDescription((await response.text()).slice(0, 150000));
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

function matchingTags(text, rules) {
  const lower = ` ${text.toLowerCase()} `;
  return Object.entries(rules)
    .filter(([, keywords]) => keywords.some((keyword) => lower.includes(keyword)))
    .map(([tag]) => tag);
}

function qualityFlags(product, description) {
  const flags = [];
  const combined = `${product.name || ""} ${description} ${product.category || ""} ${product.product_url || ""}`;
  if (!description) flags.push("missing_description");
  if (!product.image_url) flags.push("missing_image");
  if (/^(choose|shop now|view product|learn more|skip to|reviews?)\b/i.test(product.name || "")) flags.push("junk_title");
  if (/\btop \d+\b.*\b(tips|mistakes|faux pas|ways)\b/i.test(product.name || "")) flags.push("editorial_not_product");
  if (/\b(baby|newborn|infant|toddler|nursery|for kids?|children'?s|8\s*[-–]\s*12\s*(yrs?|years?))\b/i.test(combined) && String(product.suitable_age_bands || "").includes("18+")) flags.push("child_tagged_adult");
  return flags;
}

function qualityScore(product, description, interests, giftTypes, flags) {
  let score = 20;
  if (product.product_url) score += 15;
  if (product.image_url) score += 15;
  if (description) score += 20;
  if (product.category) score += 10;
  if (interests.length) score += 10;
  if (giftTypes.length) score += 10;
  score -= flags.length * 20;
  return Math.max(0, Math.min(100, score));
}

// R3: additive union — existing values kept verbatim and FIRST (never removed),
// machine matches appended, deduped, capped. The provenance-safe write for tag
// arrays on possibly-human rows.
function mergeTags(existing, matched, cap) {
  return [...new Set([...(Array.isArray(existing) ? existing : []), ...matched])].slice(0, cap);
}

// R3: order-insensitive band-set equality for the deriveAgeBands provenance test.
function sameBandSet(a, b) {
  const A = new Set(Array.isArray(a) ? a : []);
  const B = new Set(Array.isArray(b) ? b : []);
  return A.size === B.size && [...A].every((x) => B.has(x));
}

// R3: sanitise one LLM verdict. Enum compliance is never trusted — everything is
// whitelisted code-side (house pattern: generateGiftList deriveProfile).
function cleanVerdict(raw, cleanValue) {
  return {
    value: cleanValue(raw?.value),
    confidence: Math.max(0, Math.min(1, Number(raw?.confidence) || 0)),
    evidence: String(raw?.evidence || "").slice(0, 200),
    applied: false,
    skip_reason: "",
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const batchSize = Math.max(1, Math.min(40, Number(body.batch_size) || 25));
    // Optional per-retailer scope (Kate 2026-07-24: per-row Enrich in the Retailers
    // tab). Global mode (no retailer_id) stays byte-identical: active-only.
    // Per-retailer mode adds needs_review — the point is enriching a fresh scrape
    // before Gem reviews it. The SDK filter has no status-IN operator, so the two
    // statuses are fetched separately and merged (the proven pattern:
    // checkAvailabilityBatch fetches active + needs_review the same way).
    const retailerId = typeof body.retailer_id === "string" && body.retailer_id.trim() ? body.retailer_id.trim() : null;
    // R3: classify defaults ON; dry_run is the preview-test mode — one LLM call,
    // verdicts echoed in the response, and NO writes of any kind (no deterministic
    // updates, no probe, no stamps). Never sent by the UI buttons.
    const classify = body.classify !== false;
    const dryRun = body.dry_run === true;
    const svc = base44.asServiceRole;
    const products = retailerId
      ? [
          ...(await svc.entities.Product.filter({ retailer_id: retailerId, status: "active" }, "created_date", 5000)),
          ...(await svc.entities.Product.filter({ retailer_id: retailerId, status: "needs_review" }, "created_date", 5000)),
        ]
      : await svc.entities.Product.filter({ status: "active" }, "created_date", 5000);

    // ===== Track 1: deterministic enrichment (v1, provenance-hardened) =====
    // Once enrichment has genuinely run against a product it carries a
    // catalogue_enriched_at stamp. An empty description, empty tag arrays and a
    // zero quality score are the correct terminal state for a poor product, not a
    // signal to redo the work - re-qualifying on that shape alone would park the
    // same rows at the head of every batch and stall the client loop forever.
    const needsWork = products.filter((product) =>
      !product.catalogue_enriched_at ||
      !Array.isArray(product.interest_tags) || !Array.isArray(product.gift_type_tags) ||
      !Number.isFinite(Number(product.quality_score))
    );
    const detBatch = dryRun ? [] : needsWork.slice(0, batchSize);

    const detUpdates = await Promise.all(detBatch.map(async (product) => {
      const liveDescription = product.description || await fetchDescription(product.product_url || product.affiliate_url);
      const description = liveDescription || "";
      const tagText = `${product.name || ""} ${description} ${product.category || ""} ${(product.search_keywords || []).join(" ")}`;
      const matchedInterests = matchingTags(tagText, INTEREST_RULES);
      const matchedGiftTypes = matchingTags(tagText, GIFT_TYPE_RULES);
      // R3 PRIME DIRECTIVE: rows whose tags may be human-authored (curated_product,
      // legacy_unknown, or missing source_type) are ADDITIVE-ONLY — machine matches
      // are unioned in, existing tags are never removed. This supersedes the round-2
      // zero-match guard (which protected only curated interest_tags) and closes the
      // gift_type_tags / search_keywords wholesale-replace clobber. Provably
      // machine-written rows (curated_retailer, shopify_upload) keep today's
      // replace semantics unchanged.
      const preserve = HUMANISH_SOURCES.has(product.source_type || "legacy_unknown");
      const interests = preserve ? mergeTags(product.interest_tags, matchedInterests, 25) : matchedInterests;
      const giftTypes = preserve ? mergeTags(product.gift_type_tags, matchedGiftTypes, 15) : matchedGiftTypes;
      const generatedKeywords = [...new Set(tagText.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((word) => word.length >= 4))];
      const searchKeywords = preserve ? mergeTags(product.search_keywords, generatedKeywords, 40) : generatedKeywords.slice(0, 40);
      const flags = qualityFlags(product, description);
      const score = qualityScore(product, description, interests, giftTypes, flags);
      // The classification audit flag is not in qualityFlags' vocabulary — preserve
      // it across the wholesale recompute. Appended AFTER qualityScore so it is
      // display-only: machine uncertainty never depresses quality_score, matching
      // the classification track (which adds this flag without rescoring). §2.4.
      if ((product.data_quality_flags || []).includes(LOW_CONFIDENCE_FLAG)) flags.push(LOW_CONFIDENCE_FLAG);
      return {
        id: product.id,
        description: description || undefined,
        interest_tags: interests,
        gift_type_tags: giftTypes,
        search_keywords: searchKeywords,
        quality_score: score,
        data_quality_flags: flags,
        catalogue_enriched_at: new Date().toISOString(),
      };
    }));

    // ===== Track 2: AI classification (R3, Kate item 4) =====
    // Candidacy is stamp-based: one pass per product per CLASSIFY_VERSION. The stamp
    // lives in ai_classifications — a SCHEMA-GATE field that cannot persist until
    // publish, so the probe below disables the whole track pre-publish and this
    // function stays byte-equivalent to v1 (plus the union guards) at zero AI cost.
    let classificationLive = false;
    let classified = 0;
    let classifyRemaining = 0;
    let classificationError = "";
    let dryRunResults = null;
    const classifyPatches = new Map();

    const isStamped = (p) =>
      Number(p?.ai_classifications?.version) >= CLASSIFY_VERSION && !!p?.ai_classifications?.classified_at;
    const candidates = classify ? products.filter((p) => !isStamped(p)) : [];

    if (classify && candidates.length > 0) {
      if (!dryRun) {
        // Write-visibility probe (no AI cost): if ai_classifications does not
        // round-trip, the schema is not published yet — skip the LLM entirely so a
        // pre-publish button press can never burn credits on stamps that silently
        // drop. A leftover {probe_at} has no classified_at, so the row remains a
        // candidate and is overwritten by its real classification later.
        try {
          const probeId = candidates[0].id;
          await svc.entities.Product.update(probeId, { ai_classifications: { probe_at: new Date().toISOString() } });
          const probeRow = await svc.entities.Product.get(probeId);
          classificationLive = !!probeRow?.ai_classifications?.probe_at;
        } catch {
          classificationLive = false;
        }
      }

      if (dryRun || classificationLive) {
        const classBatch = candidates.slice(0, CLASSIFY_PER_RUN);
        // Retailer context sharpens gender/age verdicts and anchors the
        // machine-provenance tests. Bounded: ≤15 gets per invocation.
        const retailerById = new Map();
        for (const rid of [...new Set(classBatch.map((p) => p.retailer_id).filter(Boolean))]) {
          try { retailerById.set(rid, await svc.entities.Retailer.get(rid)); } catch { retailerById.set(rid, null); }
        }

        try {
          const promptProducts = classBatch.map((p, i) => ({
            ref: i,
            name: p.name || "",
            description: String(p.description || "").slice(0, 300),
            category_text: p.category || "",
            retailer: retailerById.get(p.retailer_id)?.name || "",
            retailer_audience: retailerById.get(p.retailer_id)?.category || "",
            price_gbp: p.price,
            url: p.product_url || "",
          }));

          const raw = await svc.integrations.Core.InvokeLLM({
            prompt: `You are classifying products for a curated UK gift catalogue. Use ONLY the product data below; never invent facts.

For EACH product return an entry with its ref and four classifications:
- category: the single best fit, copied character for character from this exact list: ${CANONICAL_CATEGORIES.join(" | ")} — or "" if nothing fits.
- gender: who the product is aimed at, exactly one of: men | women | unisex. When unclear, unisex.
- age_bands: every recipient age band the product suits, chosen only from: Under 5 | 5-10 | 11-17 | 18+. Choose a child band ONLY when the product is expressly made for children — a toy, a children's book, a U/PG/family edition — never merely because a child might find the subject interesting. Age-rated or adult-themed media (15/18 certificate, explicit lyrics, horror) is 18+ only.
- restricted: true ONLY if the product is legally age-restricted in the UK (alcohol, blades, tobacco or vapes, gambling, adult content), otherwise false.

For each of the four also return confidence (a number from 0 to 1) and evidence (a short phrase from the product data that justifies the value; "" if none).

PRODUCTS:
${JSON.stringify(promptProducts, null, 2)}

Return only the JSON object and nothing else.`,
            response_json_schema: {
              type: "object",
              properties: {
                products: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      ref: { type: "number" },
                      category: { type: "object", properties: { value: { type: "string" }, confidence: { type: "number" }, evidence: { type: "string" } } },
                      gender: { type: "object", properties: { value: { type: "string" }, confidence: { type: "number" }, evidence: { type: "string" } } },
                      age_bands: { type: "object", properties: { value: { type: "array", items: { type: "string" } }, confidence: { type: "number" }, evidence: { type: "string" } } },
                      restricted: { type: "object", properties: { value: { type: "boolean" }, confidence: { type: "number" }, evidence: { type: "string" } } },
                    },
                    required: ["ref", "category", "gender", "age_bands", "restricted"],
                  },
                },
              },
              required: ["products"],
            },
          });

          const entries = Array.isArray(raw?.products) ? raw.products : [];
          const results = [];
          for (const entry of entries) {
            const product = classBatch[Number(entry?.ref)];
            if (!product || classifyPatches.has(product.id)) continue;
            const retailer = retailerById.get(product.retailer_id) || null;

            const vCat = cleanVerdict(entry.category, (v) => (CANONICAL_CATEGORIES.includes(v) ? v : ""));
            const vGen = cleanVerdict(entry.gender, (v) => {
              const g = String(v || "").toLowerCase().trim();
              return GENDER_VALUES.includes(g) ? g : "";
            });
            const vBands = cleanVerdict(entry.age_bands, (v) =>
              Array.isArray(v) ? [...new Set(v.filter((b) => PRODUCT_AGE_BANDS.includes(b)))] : []);
            const vRes = cleanVerdict(entry.restricted, (v) => v === true);

            const patch = {};

            // canonical_category — machine-owned NEW field; write only when absent.
            if (!product.canonical_category && vCat.value && vCat.confidence >= 0.6) {
              patch.canonical_category = vCat.value;
              vCat.applied = true;
            } else {
              vCat.skip_reason = product.canonical_category ? "already_set" : (vCat.value ? "low_confidence" : "no_verdict");
            }

            // The category the R4 safety rules judge by: whatever this run just set,
            // else the stored canonical value, else the raw category text run through
            // the taxonomy's own canonicaliser (so "Cooking & Food" and its aliases
            // resolve). Empty string means "no category" — the rules then fall through
            // to Layer 2 and Layer 3, which do not depend on one.
            const effectiveCategory =
              patch.canonical_category || product.canonical_category || canonicalCategory(product.category) || "";

            // gender_applies_to — provenance test: blank is fillable; non-blank is
            // machine boilerplate ONLY when a scraper class row still carries the
            // exact retailer.category stamp scrapers write; anything else is human.
            // 2026-08-01 (Kate approved): gender_applies_to and suitable_age_bands on every
            // non-curated row were inherited from the RETAILER's audience setting, never
            // authored by Gem — which is why women's jewellery sat at "Unisex" and adult
            // products claimed 11-17. Both fields are therefore correctable on anything
            // except Gem's own curated_product rows, which stay fully protected. Every
            // OTHER field keeps the original prime directive (see HUMANISH_SOURCES).
            const gemOwned = product.source_type === "curated_product";
            const genderBlank = !(product.gender_applies_to || "").trim();
            const genderMachine = !gemOwned;
            // 0.7 on both branches: a retailer-inherited value carries no more authority
            // than a blank one, so it is held to the same bar rather than a stricter 0.85.
            if (vGen.value && ((genderBlank && vGen.confidence >= 0.7) || (!genderBlank && genderMachine && vGen.confidence >= 0.7 && vGen.evidence))) {
              patch.gender_applies_to = vGen.value;
              vGen.applied = true;
            } else if (!vGen.value) {
              vGen.skip_reason = "no_verdict";
            } else if (!genderBlank && !genderMachine) {
              vGen.skip_reason = "human_owned";
            } else {
              vGen.skip_reason = "low_confidence";
            }

            // suitable_age_bands — provenance test: empty is fillable; non-empty is
            // machine-derived ONLY when a scraper class row's bands still equal a
            // fresh deriveAgeBands recomputation (deterministic, so recomputable);
            // anything else is human. Product 4-band enum only.
            const bandsEmpty = !Array.isArray(product.suitable_age_bands) || product.suitable_age_bands.length === 0;
            const bandsMachine = !gemOwned;
            if (vBands.value.length && ((bandsEmpty && vBands.confidence >= 0.7) || (!bandsEmpty && bandsMachine && vBands.confidence >= 0.7 && vBands.evidence))) {
              patch.suitable_age_bands = vBands.value;
              vBands.applied = true;
            } else if (!vBands.value.length) {
              vBands.skip_reason = "no_verdict";
            } else if (!bandsEmpty && !bandsMachine) {
              vBands.skip_reason = "human_owned";
            } else {
              vBands.skip_reason = "low_confidence";
            }

            // R4 child-safety rules. Deliberately OUTSIDE the verdict-applied branch:
            // the rows Kate reported are exactly the ones where the verdict was
            // refused, so a rule that only ran on applied verdicts would never reach
            // them. Subtractive only, and skipped entirely when the product has no
            // band list to narrow — an absent list is left absent, never invented.
            const currentBands = patch.suitable_age_bands || product.suitable_age_bands || [];
            if (currentBands.length) {
              const safeBands = applyAgeSafetyRules(currentBands, {
                product,
                category: effectiveCategory,
                retailer,
                gemOwned,
              });
              if (!sameBandSet(safeBands, currentBands)) {
                patch.suitable_age_bands = safeBands;
                // Audit trail: distinguishes a rule-driven narrowing from a model
                // verdict, so a later reader never mistakes one for the other.
                vBands.safety_adjusted = true;
                vBands.safety_from = currentBands;
              }
            }

            // age_restricted — monotonic safety direction only: the machine may
            // raise the restriction (false -> true) with strong evidence, and may
            // NEVER lower it, whoever set it.
            if (vRes.value === true && vRes.confidence >= 0.8 && vRes.evidence && product.age_restricted !== true) {
              patch.age_restricted = true;
              vRes.applied = true;
            } else if (vRes.value === true && product.age_restricted === true) {
              vRes.skip_reason = "already_set";
            } else if (vRes.value === true) {
              vRes.skip_reason = "low_confidence";
            }

            // Surface machine uncertainty to Gem through the existing flags array.
            if ([vCat, vGen, vBands, vRes].some((v) => v.applied && v.confidence < 0.75)) {
              patch.data_quality_flags = [...new Set([...(product.data_quality_flags || []), LOW_CONFIDENCE_FLAG])];
            }

            // The audit record IS the field-level provenance marker (echo test):
            // stored for every classified row, applied or not.
            patch.ai_classifications = {
              version: CLASSIFY_VERSION,
              classified_at: new Date().toISOString(),
              model: "default",
              category: vCat,
              gender: vGen,
              age_bands: vBands,
              restricted: vRes,
            };

            results.push({ id: product.id, name: product.name, patch });
            if (!dryRun) classifyPatches.set(product.id, patch);
          }

          classified = results.length;
          if (dryRun) dryRunResults = results;
          if (classificationLive) classifyRemaining = Math.max(0, candidates.length - classified);
        } catch (error) {
          // Classification is a bonus layer — its failure never voids the
          // deterministic track's results.
          classificationError = error?.message || "classification failed";
        }
      }
    }

    // ===== Merge + write =====
    const updatesById = new Map(detUpdates.map((u) => [u.id, u]));
    for (const [id, patch] of classifyPatches) {
      const detUpdate = updatesById.get(id);
      // Same-run overlap guard (§2.4): the classification patch computed its flag
      // union from the STALE pre-run row; when the deterministic track just
      // recomputed data_quality_flags for the same id from fresh data, det's flags
      // must win — the classification track only contributes LOW_CONFIDENCE_FLAG
      // additively on top of them. Without this, the spread below would resurrect
      // stale flags (e.g. missing_description after a just-fetched description)
      // and leave flags contradicting the det-computed quality_score.
      if (detUpdate && patch.data_quality_flags) {
        patch.data_quality_flags = [...new Set([...(detUpdate.data_quality_flags || []), LOW_CONFIDENCE_FLAG])];
      }
      updatesById.set(id, { ...(detUpdate || { id }), ...patch });
    }
    const updates = [...updatesById.values()];
    if (!dryRun && updates.length) await svc.entities.Product.bulkUpdate(updates);

    return Response.json({
      processed: dryRun ? 0 : updates.length,
      remaining: Math.max(0, needsWork.length - detBatch.length) + (classificationLive ? classifyRemaining : 0),
      classified,
      classification_live: classificationLive,
      classification_error: classificationError || undefined,
      dry_run: dryRun || undefined,
      dry_run_results: dryRunResults || undefined,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});