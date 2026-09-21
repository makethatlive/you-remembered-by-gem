# AI Prompt for Age Band Correction

**Task:** Review Gem's curated products and assign appropriate age bands based on product name, description, and context.

---

## Age Band Definitions

Use these exact values (case-sensitive):

| Age Band | Age Range | Description |
|----------|-----------|-------------|
| `UNDER_5` | 0-4 years | Babies and toddlers |
| `FIVE_TO_10` | 5-10 years | Young children |
| `ELEVEN_TO_17` | 11-17 years | Teenagers and young teens |
| `EIGHTEEN_TO_30` | 18-30 years | Young adults |
| `THIRTY_ONE_TO_50` | 31-50 years | Middle-aged adults |
| `FIFTY_ONE_TO_70` | 51-70 years | Mature adults |
| `SEVENTY_PLUS` | 71+ years | Senior adults |

---

## Rules for Assignment

### 1. **Multiple Age Bands Are Allowed**
- Most products should have 2-4 age bands (not just one)
- Example: "Coffee Maker" → `["EIGHTEEN_TO_30", "THIRTY_ONE_TO_50", "FIFTY_ONE_TO_70"]`
- Example: "LEGO Set" → `["FIVE_TO_10", "ELEVEN_TO_17", "EIGHTEEN_TO_30"]` (adults love LEGO too!)

### 2. **Children's Products (Keywords)**
If product name/description includes:
- "baby", "toddler", "nursery" → `UNDER_5`
- "kids", "children", "toy", "game" (for young kids) → `FIVE_TO_10`
- "teen", "youth", "young adult" → `ELEVEN_TO_17`

**Important:** Kids' products can span multiple bands if suitable for different ages.

### 3. **Age-Restricted Products**
These should ONLY include adult bands (18+):
- Alcohol (wine, whisky, beer, spirits) → `["EIGHTEEN_TO_30", "THIRTY_ONE_TO_50", "FIFTY_ONE_TO_70", "SEVENTY_PLUS"]`
- Grooming products with alcohol → Same as above
- Mature content → Adults only

### 4. **Universal Products**
Some products are suitable for ALL adult ages:
- Coffee/tea sets → All adult bands (18+)
- Home decor → All adult bands (18+)
- Books (general) → Depends on content, but usually all adults
- Tech gadgets → Usually `EIGHTEEN_TO_30` through `FIFTY_ONE_TO_70` (unless senior-friendly)

### 5. **Senior-Appropriate Considerations**
Include `SEVENTY_PLUS` if:
- Easy to use (not tech-heavy)
- Comfort-focused (blankets, slippers, cushions)
- Classic/traditional items (tea sets, gardening tools)
- Memory/nostalgia items

Exclude `SEVENTY_PLUS` if:
- Highly technical gadgets
- Trendy/youth-oriented
- Physically demanding sports equipment

### 6. **Reasoning Quality**
For each product, provide brief reasoning (1-2 sentences):
- Good: "Coffee maker suitable for adults who drink coffee. Excluded under-18 and SEVENTY_PLUS due to technical features."
- Bad: "This is for adults."

---

## Output Format

For each product, update these fields:

```json
{
  "id": "prod_12345",
  "name": "Premium Coffee Maker",
  "corrected_age_bands": ["EIGHTEEN_TO_30", "THIRTY_ONE_TO_50", "FIFTY_ONE_TO_70"],
  "correction_reasoning": "Suitable for coffee-drinking adults. Excluded SEVENTY_PLUS due to digital controls that may be complex for seniors. Excluded children as not relevant."
}
```

---

## Examples

### Example 1: Universal Adult Product
```json
{
  "id": "prod_001",
  "name": "Luxury Candle Set",
  "current_age_bands": [],
  "corrected_age_bands": ["EIGHTEEN_TO_30", "THIRTY_ONE_TO_50", "FIFTY_ONE_TO_70", "SEVENTY_PLUS"],
  "correction_reasoning": "Home decor suitable for all adults. Simple to use, universally appreciated gift."
}
```

### Example 2: Children's Product
```json
{
  "id": "prod_002",
  "name": "Wooden Building Blocks for Kids",
  "current_age_bands": [],
  "corrected_age_bands": ["FIVE_TO_10"],
  "correction_reasoning": "Designed for young children. Age 5-10 is appropriate for building blocks complexity. Too advanced for UNDER_5, too simple for teens."
}
```

### Example 3: Age-Restricted (Alcohol)
```json
{
  "id": "prod_003",
  "name": "Single Malt Whisky Gift Set",
  "current_age_bands": [],
  "corrected_age_bands": ["EIGHTEEN_TO_30", "THIRTY_ONE_TO_50", "FIFTY_ONE_TO_70", "SEVENTY_PLUS"],
  "correction_reasoning": "Alcohol product, 18+ only. Suitable for all adult age groups who drink whisky."
}
```

### Example 4: Tech Product (Excludes Seniors)
```json
{
  "id": "prod_004",
  "name": "Smart Wireless Earbuds",
  "current_age_bands": [],
  "corrected_age_bands": ["EIGHTEEN_TO_30", "THIRTY_ONE_TO_50"],
  "correction_reasoning": "Tech gadget requiring smartphone pairing and app setup. Best suited for younger, tech-savvy adults. Excluded FIFTY_ONE_TO_70 and SEVENTY_PLUS due to technical complexity."
}
```

### Example 5: Multi-Age Toy (Kids + Adults)
```json
{
  "id": "prod_005",
  "name": "LEGO Architecture Set - London Skyline",
  "current_age_bands": [],
  "corrected_age_bands": ["ELEVEN_TO_17", "EIGHTEEN_TO_30", "THIRTY_ONE_TO_50"],
  "correction_reasoning": "Advanced LEGO set suitable for older kids and adults. Age 11+ per manufacturer recommendation. Popular with adult collectors and hobbyists."
}
```

---

## Common Mistakes to Avoid

❌ **Don't:**
- Assign only ONE age band to universal products
- Exclude seniors from simple, traditional products (tea sets, gardening tools)
- Include children in alcohol/age-restricted products
- Be too restrictive (most products suit multiple age groups)

✅ **Do:**
- Think about WHO would actually buy/use this product
- Include multiple age bands when appropriate
- Consider gift context (who gives this to whom)
- Use reasoning to explain inclusions AND exclusions

---

## Batch Processing Tips

1. Process in order (don't skip items)
2. Maintain consistency (similar products = similar age bands)
3. Flag uncertain products with reasoning: "Unclear from description, assumed..."
4. Keep reasoning concise but informative

---

## Ready to Start?

1. Load the exported JSON file
2. For each product, analyze name + description + category
3. Assign appropriate age bands using rules above
4. Write brief reasoning
5. Output updated JSON with `corrected_age_bands` and `correction_reasoning` filled

**Total Products:** ~600  
**Estimated Time:** 15-30 minutes (depending on AI speed)

Good luck! 🚀
