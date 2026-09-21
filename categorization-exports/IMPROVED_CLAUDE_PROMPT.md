# Advanced Product Categorization with URL Scraping

## 🎯 Task Overview
Categorize 5,428 products by:
1. **Reading product name, description**
2. **Opening product URL and scraping page content** ⭐ NEW
3. **Analyzing actual product details from website**
4. **Assigning correct 3-level category**

## 📋 Why Scrape URLs?
Many products have misleading names or missing descriptions. By scraping the actual product page, you can:
- See full product description
- Identify actual product type (not just name)
- Understand product context better
- Make more accurate categorization

## 🔍 Scraping Instructions

For each product:

1. **Open the `product_url`**
2. **Extract key information:**
   - Product title/heading
   - Product description/details
   - Product category breadcrumb (if shown)
   - Key features
   - What the product actually is

3. **Use scraped content** to determine correct category

### Example:

**Product:** "KEW Terracotta Dish Planter Set"
**URL:** https://example.com/kew-planter

**Scrape Result:**
```
Title: KEW Terracotta Dish Planter Set
Description: "Beautiful terracotta planters for indoor or outdoor gardening. 
Perfect for herbs, succulents, or small plants. Includes drainage holes."
Category: Garden > Planters & Pots
```

**Analysis:** This is clearly a GARDENING product (planter for plants)
**Correct Category:** `Home, Style & Objects > Gardening`
**NOT:** `Lifestyle & Wellbeing > Wellness & self-care` ❌

---

## ✅ Valid Categories (3-Level Structure)

### Food & Drink
- **Cooking & food**
  - Kitchen utensils, cookware, food hampers, recipe books
  - Examples: Bottle opener, cheese board, knife set
- **Wine & Drinks** (with sub-types)
  - Wine
  - Beer
  - Cocktails
  - Whisky
  - Gin
  - Rum
  - Tequila
  - No particular preference
- **Coffee & tea**
  - Coffee makers, tea sets, coffee beans, tea accessories

### Lifestyle & Wellbeing
- **Travel & adventure**
- **Wellness & self-care** (spa, relaxation, massage - NOT planters!)
- **Beauty & skincare** (cosmetics, skincare products)
- **Sustainability & eco living**
- **Spirituality** (meditation, crystals, tarot)

### Sport & Fitness
- Running
- Yoga & Pilates
- Swimming
- Football
- Rugby
- Cricket
- Motorsports
- Tennis
- Golf
- Cycling
- Outdoor pursuits (hiking, camping)

### Creative & Culture
- **Reading & books**
- **Art & culture**
- **Music** (with sub-types)
  - Listening (speakers, vinyl players)
  - Playing an instrument (guitars, keyboards)
  - Vinyl collecting (records, storage)
  - Concerts & live music (tickets, merchandise)
- **Theatre & performing arts**
- **Photography**
- **Crafts & making things** (knitting, pottery, DIY kits)
- **Film & TV**
- **Podcasts & audiobooks**

### Home, Style & Objects
- **Fashion & accessories** (scarves, bags, wallets - NOT kitchen items!)
- **Watches**
- **Jewellery** (necklaces, earrings, bracelets)
- **Home & interiors** (vases, cushions, candles, decor)
- **Gardening** ⭐ (planters, tools, seeds, garden accessories)
- **DIY & tools** (drills, hammers, toolkits)

### Tech, Games & Curiosity
- **Tech & gadgets**
- **Gaming (video games)** with sub-types
  - Console
  - PC
  - Mobile
  - Retro/collector
- **Board games & puzzles**
- **Science & nature**
- **History & politics**

### Family & Pets
- **Children & family activities**
- **Pets** with sub-types
  - Dog
  - Cat
  - Other pet

---

## 🚨 Common Mistakes to Avoid

### ❌ WRONG Examples:

1. **Bottle Opener** → "Fashion & accessories" ❌
   - **Scrape shows:** Kitchen/bar tool for opening bottles
   - **Correct:** `Food & Drink > Cooking & food` ✅

2. **KEW Terracotta Planter** → "Wellness & self-care" ❌
   - **Scrape shows:** Garden planter for plants
   - **Correct:** `Home, Style & Objects > Gardening` ✅

3. **Utensil Jar** → "Fashion & accessories" ❌
   - **Scrape shows:** Kitchen storage for cooking utensils
   - **Correct:** `Food & Drink > Cooking & food` ✅

4. **Seed Pearl Necklace** → "Gardening" ❌
   - **Scrape shows:** Jewelry with pearl beads (not plant seeds!)
   - **Correct:** `Home, Style & Objects > Jewellery` ✅

5. **Fairy Garden Toys** → "Gardening" ❌
   - **Scrape shows:** Children's toy playset with fairy theme
   - **Correct:** `Family & Pets > Children & family activities` ✅

---

## 📤 Output Format

Return JSON array with:

```json
[
  {
    "product_id": "abc123",
    "row_number": 1,
    "name": "Bottle Opener with Cork Screw",
    "product_url": "https://example.com/bottle-opener",
    "scraped_content": "Professional bottle opener and corkscrew. Perfect for wine bottles, beer bottles, and champagne. Essential bar tool.",
    "current_category": "Fashion & accessories",
    "corrected_category": "Food & Drink > Cooking & food",
    "confidence": "high",
    "reasoning": "Scraped page shows this is a kitchen/bar tool for opening bottles. Keywords: bottle opener, corkscrew, bar tool. Clearly belongs in Cooking & food, not Fashion."
  },
  {
    "product_id": "xyz789",
    "row_number": 2,
    "name": "KEW Terracotta Planter Set",
    "product_url": "https://example.com/planter",
    "scraped_content": "Beautiful terracotta planters for indoor or outdoor gardening. Perfect for herbs, succulents, or small plants. Includes drainage holes.",
    "current_category": "Lifestyle & Wellbeing > Wellness & self-care",
    "corrected_category": "Home, Style & Objects > Gardening",
    "confidence": "high",
    "reasoning": "Scraped page confirms these are garden planters for plants. Keywords: planter, gardening, plants, herbs. Clearly gardening category."
  }
]
```

---

## 🎯 Categorization Logic

### Step 1: Scrape URL
```
Open product_url → Extract content → Understand actual product
```

### Step 2: Identify Product Type
```
From scraped content, determine:
- Is it kitchen/bar related? → Cooking & food
- Is it for plants/garden? → Gardening
- Is it jewelry/accessories? → Jewellery or Fashion & accessories
- Is it for children? → Children & family activities
```

### Step 3: Match to Category
```
Use keywords from scraped content to match with category keywords:

Cooking & food keywords: cook, kitchen, food, utensil, bottle opener, pan, pot
Gardening keywords: garden, plant, planter, seed, pot, fork, spade, trowel
Jewellery keywords: jewellery, jewelry, necklace, earring, bracelet, pendant
```

### Step 4: Assign 3-Level Path
```
Format: "Category 1 > Category 2 > Category 3" (if applicable)
Example: "Food & Drink > Wine & Drinks > Whisky"
```

---

## 🔑 Key Taxonomy Keywords

Use these to match products after scraping:

### Food & Drink > Cooking & food
- **Keywords:** cook, cooking, chef, kitchen, food, recipe, bake, gourmet, dining, hamper, maker, pan, pot, **utensil**, **bottle opener**, **cork screw**, knife, cutting board, cheese board

### Home, Style & Objects > Gardening
- **Keywords:** garden, **plant**, botanical, flower, grow, **seed** (if related to plants!), **pot** (if for plants!), **planter**, fork (garden), **spade**, **trowel**, outdoor (if gardening context)

### Home, Style & Objects > Jewellery
- **Keywords:** jewellery, jewelry, earring, necklace, bracelet, pendant, bangle, brooch, charm, **pearl** (if jewelry context!)

### Home, Style & Objects > Fashion & accessories
- **Keywords:** fashion, accessory, wallet, scarf, **bag**, handbag, purse (NOT kitchen items!)

---

## ⚠️ Special Cases

### Products with "Garden" in Name
- **"Fairy Garden" toy** → Children's toy ✅
- **"Garden Fork"** → Gardening tool ✅
- **"Secret Garden" book** → Reading & books ✅
- **"Garden Party" dress** → Fashion ✅

**Rule:** Scrape URL to see actual context!

### Products with "Seed" in Name
- **"Seed Pearl Necklace"** → Jewellery ✅ (seed = type of pearl)
- **"Flower Seeds"** → Gardening ✅ (actual plant seeds)
- **"Raspberry Seed Oil"** → Beauty & skincare ✅ (skincare ingredient)

**Rule:** Scrape to understand what "seed" means in context!

### Kitchen vs Fashion
- **Bottle opener** → Cooking & food ✅ (kitchen tool)
- **Utensil jar** → Cooking & food ✅ (kitchen storage)
- **Wine bag** → Fashion & accessories ✅ (carrying bag)
- **Wallet** → Fashion & accessories ✅

**Rule:** Function determines category!

---

## 📊 Confidence Levels

- **High:** Scraped content clearly shows product type and category match
- **Medium:** Product type clear but category has some ambiguity
- **Low:** Unable to scrape, or product doesn't fit any category well

---

## 🎯 Quality Checklist

Before returning results, verify:

- [ ] Did I scrape the URL for each product?
- [ ] Did I use scraped content to determine category?
- [ ] Is the category from the valid list above?
- [ ] Does the 3-level format match exactly?
- [ ] Does my reasoning reference scraped content?
- [ ] Are kitchen/bar tools in "Cooking & food" (not Fashion)?
- [ ] Are planters in "Gardening" (not Wellness)?
- [ ] Are toys in "Children & family" (not Gardening)?

---

## 📦 Total Products: 5,428

Process all products with URL scraping and return complete JSON array.

---

## 💡 Pro Tips

1. **Always scrape the URL** - Don't guess from name alone
2. **Read product descriptions** - They reveal true product type
3. **Check breadcrumbs** - Retailer's own category can help
4. **Use context clues** - "Garden" in toy name ≠ gardening product
5. **Function over form** - Categorize by use, not appearance
6. **When in doubt** - Mark as "low" confidence for human review

---

## ✅ Ready to Start!

1. Load products JSON file
2. For each product:
   - Open product_url
   - Scrape content
   - Analyze and categorize
3. Return complete JSON with all fields
4. Include `scraped_content` field showing what you found

**Remember: Accurate categorization depends on SCRAPING the URL!** 🔍
