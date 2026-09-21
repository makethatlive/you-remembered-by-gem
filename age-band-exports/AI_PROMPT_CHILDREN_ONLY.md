# AI Prompt for Children Age Band Correction

**Task:** Review CHILDREN products only and assign appropriate age bands.

---

## Age Band Format (Children Specific)

Use these EXACT values (case-sensitive, hyphenated):

| Age Band | Age Range | Description |
|----------|-----------|-------------|
| `1-2` | 1-2 years | Toddlers |
| `3-4` | 3-4 years | Preschoolers |
| `5-6` | 5-6 years | Early primary school |
| `7-8` | 7-8 years | Primary school |
| `9-11` | 9-11 years | Upper primary school |
| `12-17` | 12-17 years | Teenagers |

**Important:** Use hyphen format (`1-2`) NOT underscore (`1_2`) or comma (`1,2`)

---

## Rules for Children Products

### 1. **Multiple Age Bands Usually Apply**
Children grow fast! Most products work for 2-3 age ranges:

✅ **Good Examples:**
- "Building Blocks" → `["3-4", "5-6", "7-8"]` (suitable 3-8 years)
- "Picture Book" → `["1-2", "3-4"]` (toddlers & preschoolers)
- "LEGO Set" → `["7-8", "9-11", "12-17"]` (complex builds for older kids)

❌ **Bad Examples:**
- "Building Blocks" → `["3-4"]` only (too restrictive!)
- "Picture Book" → `["1-2", "3-4", "5-6", "7-8"]` (too broad - pictures too simple for 7-8)

### 2. **Age Guidance from Product Name/Description**

**Look for keywords:**
- "baby", "infant" → `1-2`
- "toddler" → `1-2` or `3-4`
- "preschool" → `3-4`, `5-6`
- "ages 3+", "3 years and up" → Start at `3-4`
- "ages 5-8" → `5-6`, `7-8`
- "ages 8+" → `7-8`, `9-11`, maybe `12-17`
- "teen", "youth" → `12-17`

**If manufacturer age is specified, respect it:**
- "LEGO 4+" → `3-4`, `5-6`, `7-8`, `9-11`
- "Ages 2-5" → `1-2`, `3-4`, `5-6`
- "8 years and up" → `7-8`, `9-11`, `12-17`

### 3. **Safety Considerations**

**Small parts warning = NO babies/toddlers:**
- "Contains small parts" → Exclude `1-2`, start at `3-4`
- Choking hazard → Exclude `1-2`

**Examples:**
- Small LEGO bricks → `["5-6", "7-8", "9-11"]` (not for under-5)
- Large soft blocks → `["1-2", "3-4", "5-6"]` (safe for toddlers)

### 4. **Complexity Determines Age Range**

**Simple = Younger ages:**
- Soft toys, rattles, simple puzzles → `1-2`, `3-4`
- Basic books, large blocks → `1-2`, `3-4`, `5-6`

**Medium = Middle ages:**
- Board games, craft kits, simple LEGO → `5-6`, `7-8`, `9-11`
- Sports equipment (bike, scooter) → `5-6`, `7-8`, `9-11`

**Complex = Older kids:**
- Advanced LEGO, science kits, model building → `9-11`, `12-17`
- Tech toys, coding kits → `9-11`, `12-17`
- Young adult books → `12-17`

### 5. **Don't Be Too Restrictive!**

Children's products often work across multiple ages:

✅ **Good (Inclusive):**
- "Kids Backpack" → `["5-6", "7-8", "9-11"]` (primary school age)
- "Teddy Bear" → `["1-2", "3-4", "5-6"]` (young children love them)
- "Football" → `["7-8", "9-11", "12-17"]` (older kids & teens)

❌ **Bad (Too Narrow):**
- "Kids Backpack" → `["5-6"]` only (why exclude 7-8 year olds?)
- "Teddy Bear" → `["1-2"]` only (3-4 year olds love teddies too!)

---

## Output Format

For each product, fill these fields:

```json
{
  "id": "prod_12345",
  "name": "LEGO Classic Building Set",
  "corrected_child_age_bands": ["5-6", "7-8", "9-11"],
  "correction_reasoning": "Classic LEGO suitable for ages 5-11. Manufacturer recommends 4+, includes some small parts so excluded younger ages. Complex enough to engage up to age 11."
}
```

**Required:**
- `corrected_child_age_bands`: Array with 1-6 age bands (usually 2-3)
- `correction_reasoning`: 1-2 sentences explaining your choices

---

## Examples

### Example 1: Soft Toy (Simple, Safe)
```json
{
  "id": "prod_001",
  "name": "Soft Plush Teddy Bear",
  "description": "Cuddly soft teddy bear for young children",
  "corrected_child_age_bands": ["1-2", "3-4", "5-6"],
  "correction_reasoning": "Soft toy safe for toddlers (no small parts). Appeals to children 1-6 years who love cuddly toys. Too babyish for 7+."
}
```

### Example 2: Building Blocks (Medium Complexity)
```json
{
  "id": "prod_002",
  "name": "Wooden Building Blocks Set - 50 Pieces",
  "description": "Colorful wooden blocks for creative building",
  "corrected_child_age_bands": ["3-4", "5-6", "7-8"],
  "correction_reasoning": "Building blocks suitable for preschool through early primary. Ages 3-8 can build age-appropriate structures. Too advanced for 1-2 (choking risk), too simple for 9+."
}
```

### Example 3: Advanced LEGO (Complex)
```json
{
  "id": "prod_003",
  "name": "LEGO Technic Race Car - 1000 Pieces",
  "description": "Advanced building set with moving parts, ages 10+",
  "corrected_child_age_bands": ["9-11", "12-17"],
  "correction_reasoning": "Manufacturer recommends 10+. Complex 1000-piece build with mechanical elements. Suitable for older children who enjoy detailed construction."
}
```

### Example 4: Picture Book (Simple)
```json
{
  "id": "prod_004",
  "name": "First Words Picture Book",
  "description": "Board book with simple pictures for babies and toddlers",
  "corrected_child_age_bands": ["1-2", "3-4"],
  "correction_reasoning": "Simple picture book for language development. Ages 1-4 are primary target. Content too basic for 5+ who can read independently."
}
```

### Example 5: Sports Equipment
```json
{
  "id": "prod_005",
  "name": "Kids Scooter with Light-Up Wheels",
  "description": "Three-wheel scooter for children, adjustable height",
  "corrected_child_age_bands": ["5-6", "7-8", "9-11"],
  "correction_reasoning": "Scooter suitable for school-age children 5-11. Three wheels provide stability for beginners. Adjustable height accommodates growth. Too advanced for under-5."
}
```

### Example 6: Craft Kit
```json
{
  "id": "prod_006",
  "name": "Paint Your Own Ceramic Figurine Kit",
  "description": "Includes ceramic figurine, paints, and brushes",
  "corrected_child_age_bands": ["7-8", "9-11", "12-17"],
  "correction_reasoning": "Craft kit requiring fine motor skills and patience. Ages 7-17 can complete project successfully. Too complex and messy for younger children."
}
```

### Example 7: Teen Product
```json
{
  "id": "prod_007",
  "name": "Wireless Bluetooth Headphones - Kids Edition",
  "description": "Volume-limited headphones designed for children",
  "corrected_child_age_bands": ["9-11", "12-17"],
  "correction_reasoning": "Tech product suitable for older children and teens who use devices. Ages 9-17 will appreciate wireless freedom. Too advanced for younger kids who don't use devices independently."
}
```

---

## Common Mistakes to Avoid

❌ **Don't:**
- Use only ONE age band for most products (be more inclusive!)
- Ignore manufacturer age recommendations
- Include babies (1-2) for products with small parts
- Use wrong format like `1_2` or `1,2` (must be `1-2`)
- Be too broad (don't give 1-17 to everything)

✅ **Do:**
- Include 2-3 adjacent age bands typically
- Respect safety warnings
- Consider complexity and appeal
- Explain exclusions in reasoning
- Use exact format: `1-2`, `3-4`, `5-6`, `7-8`, `9-11`, `12-17`

---

## Quick Reference

| Product Type | Typical Age Bands |
|--------------|-------------------|
| Soft toys, rattles | `1-2`, `3-4` |
| Picture books | `1-2`, `3-4`, `5-6` |
| Building blocks (large) | `3-4`, `5-6`, `7-8` |
| Simple board games | `5-6`, `7-8`, `9-11` |
| LEGO (standard) | `5-6`, `7-8`, `9-11` |
| Sports equipment | `7-8`, `9-11`, `12-17` |
| Craft kits | `7-8`, `9-11`, `12-17` |
| Advanced LEGO/models | `9-11`, `12-17` |
| Tech gadgets | `9-11`, `12-17` |
| Young adult books | `12-17` |

---

## Ready to Start?

1. Load the children products JSON file
2. For each product:
   - Read name, description, category
   - Determine complexity level
   - Check for safety considerations
   - Assign 2-3 appropriate age bands
   - Write brief reasoning
3. Output updated JSON with corrections

**Format Check:**
```json
"corrected_child_age_bands": ["3-4", "5-6", "7-8"]  ← Correct ✅
"corrected_child_age_bands": ["3_4", "5_6"]        ← Wrong ❌
"corrected_child_age_bands": ["3-4"]               ← Too narrow ❌
```

Good luck! 🎯
