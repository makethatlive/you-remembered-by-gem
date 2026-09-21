# AI Prompt: Product Age Band Reclassification

## Your Task

You are reclassifying products with **standardized age bands** that match our onboarding form options.

### Current Format (TO REPLACE):
Products currently use rigid enum values:
- `UNDER_5` → replace with appropriate range(s) from allowed list below
- `FIVE_TO_10` → replace with appropriate range(s) from allowed list below
- `ELEVEN_TO_17` → replace with appropriate range(s) from allowed list below
- `EIGHTEEN_TO_30` → replace with appropriate range(s) from allowed list below
- `THIRTY_ONE_TO_50` → replace with appropriate range(s) from allowed list below
- `FIFTY_ONE_PLUS` → replace with appropriate range(s) from allowed list below

### New Format (TARGET):
Use **ONLY these exact age ranges** (from our onboarding form):

**Children/Youth (Ages 1-17):**
- `"1-2"` - Babies/toddlers (1-2 years old)
- `"3-4"` - Preschoolers (3-4 years old)
- `"5-6"` - Early school age (5-6 years old)
- `"7-8"` - School age (7-8 years old)
- `"9-11"` - Pre-teens (9-11 years old)
- `"12-17"` - Teenagers (12-17 years old)

**Adults (Ages 18+):**
- `"18-25"` - Young adults
- `"26-35"` - Young professionals
- `"36-45"` - Mid-career adults
- `"46-55"` - Established adults
- `"56-65"` - Pre-retirement adults
- `"66-75"` - Active retirees
- `"75+"` - Senior adults

**IMPORTANT RULES**:
1. ✅ **ONLY use the exact age ranges listed above** - no custom ranges allowed
2. ✅ Products can have **multiple age bands** if suitable for different ages
3. ✅ Choose ranges that best match the product's actual target audience
4. ✅ Children's products should use children ranges (1-17)
5. ✅ Adult products should use adult ranges (18+)
6. ✅ Universal products can span multiple ranges

---

## Instructions

For each product in the provided JSON file:

1. **Read the product details**: name, description, category, current_age_bands
2. **Determine appropriate age ranges** based on:
   - Product complexity
   - Interest level by age
   - Safety/maturity requirements
   - Marketing target audience
3. **Fill the `new_age_bands` field** with an array of flexible age ranges
4. **Fill the `reasoning` field** with 1-2 sentences explaining your choice

---

## Examples

### Example 1: Children's Book
```json
{
  "id": "abc123",
  "name": "Spot's First Little Library",
  "description": "Board books teaching colours, shapes, words and numbers for little ones",
  "category": "Children > Books",
  "current_age_bands": ["UNDER_5"],
  "new_age_bands": ["1-2", "3-4"],
  "reasoning": "Board books are ideal for toddlers (1-2) and preschoolers (3-4) learning first concepts. Too simple for ages 5+."
}
```

### Example 2: LEGO Set
```json
{
  "id": "xyz789",
  "name": "LEGO Technic Race Car",
  "description": "Advanced building set with 500 pieces, working steering and suspension",
  "category": "Toys > Construction",
  "current_age_bands": ["FIVE_TO_10", "ELEVEN_TO_17"],
  "new_age_bands": ["7-8", "9-11", "12-17"],
  "reasoning": "Complex 500-piece set requires focus and dexterity. Suitable for school-age (7-8), pre-teens (9-11), and teenagers (12-17) interested in mechanics."
}
```

### Example 3: Adult Cookbook
```json
{
  "id": "cook456",
  "name": "The Modern Baker: Essential Bread Techniques",
  "description": "Professional baking guide with 80 recipes from sourdough to pastries",
  "category": "Food & Drink > Cookbooks",
  "current_age_bands": ["EIGHTEEN_TO_30", "THIRTY_ONE_TO_50"],
  "new_age_bands": ["18-25", "26-35", "36-45", "46-55", "56-65", "66-75", "75+"],
  "reasoning": "Professional baking appeals to adults of all ages. Suitable for anyone 18+ interested in advanced cooking techniques."
}
```

### Example 4: Skincare Product
```json
{
  "id": "skin789",
  "name": "Anti-Aging Retinol Night Cream",
  "description": "Advanced retinol formula for mature skin, reduces fine lines and wrinkles",
  "category": "Beauty > Skincare",
  "current_age_bands": ["THIRTY_ONE_TO_50", "FIFTY_ONE_PLUS"],
  "new_age_bands": ["36-45", "46-55", "56-65", "66-75", "75+"],
  "reasoning": "Anti-aging products target mid-life (36-45, 46-55) when fine lines emerge, and older adults (56+) with pronounced aging concerns."
}
```

### Example 5: Video Game
```json
{
  "id": "game999",
  "name": "Mario Kart Racing",
  "description": "Fun racing game suitable for all ages, easy controls, family-friendly",
  "category": "Electronics > Video Games",
  "current_age_bands": ["FIVE_TO_10", "ELEVEN_TO_17", "EIGHTEEN_TO_30"],
  "new_age_bands": ["5-6", "7-8", "9-11", "12-17", "18-25", "26-35"],
  "reasoning": "Family-friendly racing game appeals to young children (5-8), pre-teens/teens (9-17), and young adults (18-35) who enjoy casual gaming."
}
```

### Example 6: Simple Board Game
```json
{
  "id": "board123",
  "name": "Snakes and Ladders Classic Board Game",
  "description": "Traditional family board game for 2-4 players, simple rules",
  "category": "Toys > Board Games",
  "current_age_bands": ["FIVE_TO_10"],
  "new_age_bands": ["3-4", "5-6", "7-8"],
  "reasoning": "Simple counting game suitable for preschoolers (3-4) learning numbers and young children (5-8). Too basic for ages 9+."
}
```

---

## Age Band Guidelines

### **ALLOWED AGE RANGES ONLY** (Use exactly as shown):

#### Children/Youth (1-17):
```
"1-2"    // Babies/toddlers (safety toys, board books, rattles)
"3-4"    // Preschoolers (simple puzzles, picture books, basic crafts)
"5-6"    // Early school (learning toys, beginner chapter books)
"7-8"    // School age (more complex toys, chapter books, sports)
"9-11"   // Pre-teens (advanced games, hobbies, sports equipment)
"12-17"  // Teenagers (tech, fashion, mature hobbies, young adult books)
```

#### Adults (18+):
```
"18-25"  // Young adults (university age, first job, independent living)
"26-35"  // Young professionals (career building, relationships, first home)
"36-45"  // Mid-career (established career, family, home ownership)
"46-55"  // Mature professionals (peak career, raising teens, planning retirement)
"56-65"  // Pre-retirement (grandparents, hobbies, travel)
"66-75"  // Active retirees (retirement hobbies, grandchildren, comfort)
"75+"    // Senior adults (comfort, nostalgia, accessibility)
```

### Selection Guidelines:

**For Children's Products (1-17):**
- **Safety-focused (0-2)**: Use `"1-2"` only
- **Preschool toys/books**: Use `"3-4"`, maybe `"5-6"` if not too simple
- **Early school products**: Use `"5-6"`, `"7-8"`
- **Complex toys/games**: Use `"7-8"`, `"9-11"`, sometimes `"12-17"`
- **Teen products**: Use `"12-17"` primarily

**For Adult Products (18+):**
- **Universal adult products** (e.g., kitchen tools, classic books): Use all 7 adult ranges
- **Age-specific** (e.g., trendy fashion, retirement planning): Use relevant subset
- **Mature/luxury items**: Start from `"36-45"` or higher
- **Senior-focused** (e.g., mobility aids, large-print books): Focus on `"56-65"`, `"66-75"`, `"75+"`

### Multi-Generational Products:
Some products suit ALL ages in a category:
- **Family board games**: `["5-6", "7-8", "9-11", "12-17", "18-25", "26-35", "36-45"]`
- **Classic novels**: `["12-17", "18-25", "26-35", "36-45", "46-55", "56-65", "66-75", "75+"]`
- **Universal home items**: `["18-25", "26-35", "36-45", "46-55", "56-65", "66-75", "75+"]`

---

## Quality Checklist

Before submitting, verify:

✅ Every product has `new_age_bands` filled (array with 1+ ranges)  
✅ Age ranges use **ONLY the allowed values** from the list above  
✅ **NO custom ranges** - only exact matches: `"1-2"`, `"3-4"`, `"5-6"`, `"7-8"`, `"9-11"`, `"12-17"`, `"18-25"`, `"26-35"`, `"36-45"`, `"46-55"`, `"56-65"`, `"66-75"`, `"75+"`  
✅ Ranges make sense for the product (check name + description)  
✅ `reasoning` explains why these specific ages (1-2 sentences)  
✅ Children's products (1-17) use children ranges, not adult ranges  
✅ Adult products (18+) use adult ranges, not children ranges  

**INVALID Examples** (DO NOT USE):
- ❌ `"1-4"` (not in allowed list - use `["1-2", "3-4"]` instead)
- ❌ `"18-30"` (not in allowed list - use `["18-25", "26-35"]` instead)
- ❌ `"18+"` (not in allowed list - use all adult ranges `["18-25", "26-35", ...]`)
- ❌ `"5-10"` (not in allowed list - use `["5-6", "7-8", "9-11"]` instead)

---

## Output Format

Return the complete JSON array with all products, each having:
- `id` (unchanged)
- `name` (unchanged)
- `description` (unchanged)
- `url` (unchanged)
- `price` (unchanged)
- `category` (unchanged)
- `gender` (unchanged)
- `current_age_bands` (unchanged)
- **`new_age_bands`**: Array of flexible age range strings
- **`reasoning`**: Brief explanation

Save as: `non-gem-pick-products-reclassified.json`

---

## Notes

- **Be precise**: Use ONLY the exact age ranges from the allowed list - no variations
- **Be thoughtful**: Consider product complexity, safety, and target audience
- **Be generous with ranges**: If a product suits multiple ages, include all relevant ranges
- **Use multiple ranges**: Most products suit 2-4 age ranges, some suit more
- **Don't guess**: If truly universal for all adults, include all 7 adult ranges

**Common Mappings from Old Enums**:
- `UNDER_5` → Likely `["1-2", "3-4"]` or just `["3-4"]`
- `FIVE_TO_10` → Use `["5-6", "7-8", "9-11"]` (pick relevant ones)
- `ELEVEN_TO_17` → Use `["9-11", "12-17"]` or just `["12-17"]`
- `EIGHTEEN_TO_30` → Use `["18-25", "26-35"]`
- `THIRTY_ONE_TO_50` → Use `["36-45", "46-55"]`
- `FIFTY_ONE_PLUS` → Use `["56-65", "66-75", "75+"]` (pick relevant ones)

Good luck! 🎯
