# Product Categorization Task - With Full Context

## 🎯 Task Overview
Review and categorize 5,428 products using:
- ✅ Product name
- ✅ **Full description** (now included!)
- ✅ Product URL (domain for context)
- ✅ Retailer name & URL
- ✅ Existing tags (interest_tags, gift_type_tags, search_keywords)

## 📊 Data Provided

Each product includes:
```json
{
  "product_id": "abc123",
  "name": "Bottle Opener with Cork Screw",
  "product_url": "https://example.com/bottle-opener",
  "description": "FULL PRODUCT DESCRIPTION HERE - Use this!",
  "retailer": "Kitchen Shop",
  "retailer_url": "https://kitchenshop.com",
  "interest_tags": ["Cooking & food"],
  "gift_type_tags": ["Practical but high quality"],
  "search_keywords": ["kitchen", "bar", "opener"],
  "current_category": "Fashion & accessories",
  "price": "25.99",
  "gender": "UNISEX"
}
```

## 🔑 Key Instructions

### 1. **Read the Description Carefully!**
The `description` field is your PRIMARY source for understanding what the product actually is.

**Example:**
```
Name: "KEW Terracotta Dish Planter Set"
Description: "Beautiful terracotta planters for indoor or outdoor gardening. 
Perfect for herbs, succulents, or small plants. Includes drainage holes."

Analysis: Description mentions "gardening", "plants", "herbs" → GARDENING product!
Correct: "Home, Style & Objects > Gardening"
NOT: "Lifestyle & Wellbeing > Wellness & self-care"
```

### 2. **Use Product URL Domain as Context**
```
URL: https://hedonism.co.uk/product/dom-perignon-2013
Domain: hedonism.co.uk → Known wine retailer
Product: "Dom Perignon 2013" → Champagne

Correct: "Food & Drink > Wine & Drinks > Wine"
NOT: "Fashion & accessories"
```

### 3. **Leverage Existing Tags**
```
interest_tags: ["Cooking & food"]
gift_type_tags: ["Things to eat or drink"]
search_keywords: ["kitchen", "utensil"]

→ Strong signal this is a COOKING product!
```

### 4. **Check Retailer Context**
```
Retailer: "Whisky Exchange"
Retailer URL: thewhiskyexchange.com
Product: Any whisky/spirits → Definitely drinks category
```

---

## ✅ Valid Categories (3-Level Structure)

### Food & Drink
- **Cooking & food**
  - Kitchen utensils, cookware, food hampers, recipe books
  - **Examples:** Bottle opener, cheese board, knife set, utensil jar, cookware
  - **Keywords:** cook, kitchen, food, utensil, pan, pot, cookware
  
- **Wine & Drinks**
  - Wine
  - Beer  
  - Cocktails
  - Whisky
  - Gin
  - Rum
  - Tequila
  - No particular preference
  - **Examples:** Wine bottles, beer sets, cocktail kits, bar tools
  - **Keywords:** wine, beer, cocktail, whisky, gin, spirits, bar
  
- **Coffee & tea**
  - Coffee makers, tea sets, coffee beans, tea accessories
  - **Keywords:** coffee, tea, espresso, brew

### Lifestyle & Wellbeing
- **Travel & adventure** (luggage, travel accessories)
- **Wellness & self-care** (spa products, massage, relaxation - NOT planters!)
- **Beauty & skincare** (cosmetics, skincare products, grooming)
- **Sustainability & eco living** (eco-friendly, reusable, sustainable products)
- **Spirituality** (meditation, crystals, tarot, incense)

### Sport & Fitness
- Running
- Yoga & Pilates
- Swimming
- Football, Rugby, Cricket
- Motorsports, Tennis, Golf
- Cycling
- Outdoor pursuits (hiking, camping gear)

### Creative & Culture
- **Reading & books**
- **Art & culture**
- **Music**
  - Listening (speakers, audio equipment)
  - Playing an instrument (guitars, drums, accessories)
  - Vinyl collecting (records, storage, players)
  - Concerts & live music (tickets, merchandise)
- **Theatre & performing arts**
- **Photography** (cameras, lenses, albums, frames)
- **Crafts & making things** (knitting, pottery, DIY craft kits)
- **Film & TV**
- **Podcasts & audiobooks**

### Home, Style & Objects
- **Fashion & accessories** 
  - Scarves, bags, wallets, sunglasses
  - **NOT kitchen items, NOT garden tools!**
  - **Keywords:** fashion, scarf, bag, wallet, accessory, clothing
  
- **Watches**
  
- **Jewellery** 
  - Necklaces, earrings, bracelets, rings
  - **NOTE:** "Seed pearl" = pearl jewelry, NOT gardening!
  - **Keywords:** jewellery, jewelry, necklace, earring, bracelet, ring
  
- **Home & interiors** 
  - Vases, cushions, candles, blankets, decor, furniture
  - **Keywords:** home, interior, decor, vase, candle, cushion
  
- **Gardening** ⭐
  - Planters, pots, garden tools, seeds, plants, garden accessories
  - **Examples:** Terracotta planters, garden forks, trowels, watering cans
  - **Keywords:** garden, plant, planter, pot (for plants), fork, spade, trowel, seed (for plants)
  
- **DIY & tools**
  - Tools, toolkits, hardware
  - **Keywords:** diy, tool, drill, hammer, toolkit

### Tech, Games & Curiosity
- **Tech & gadgets** (electronics, smart devices, chargers)
- **Gaming (video games)** - Console, PC, Mobile, Retro/collector
- **Board games & puzzles**
- **Science & nature** (telescopes, microscopes, nature kits)
- **History & politics** (history books, political content)

### Family & Pets
- **Children & family activities** (family games, activities, toys)
- **Pets** - Dog, Cat, Other pet

---

## 🚨 Common Categorization Mistakes to Fix

### ❌ Kitchen/Bar Tools → Fashion & accessories
**WRONG:**
```
"Bottle Opener" → "Fashion & accessories" ❌
"Utensil Jar" → "Fashion & accessories" ❌
"Cork Screw" → "Fashion & accessories" ❌
```

**CORRECT:**
```
"Bottle Opener" → "Food & Drink > Cooking & food" ✅
"Utensil Jar" → "Food & Drink > Cooking & food" ✅  
"Cork Screw" → "Food & Drink > Cooking & food" ✅
```

**Why:** These are kitchen/bar tools for food/drink, NOT fashion items!

---

### ❌ Garden Planters → Wellness & self-care
**WRONG:**
```
"KEW Terracotta Planter" → "Wellness & self-care" ❌
"Plant Pot" → "Wellness & self-care" ❌
```

**CORRECT:**
```
"KEW Terracotta Planter" → "Home, Style & Objects > Gardening" ✅
"Plant Pot" → "Home, Style & Objects > Gardening" ✅
```

**Why:** Planters are for gardening (plants), NOT spa/wellness!

---

### ❌ Children's Toys → Gardening
**WRONG:**
```
"Fairy Garden Toy Set" → "Gardening" ❌
"Little Dutch Garden Tea Set" → "Gardening" ❌
```

**CORRECT:**
```
"Fairy Garden Toy Set" → "Family & Pets > Children & family activities" ✅
"Little Dutch Garden Tea Set" → "Family & Pets > Children & family activities" ✅
```

**Why:** "Garden" in toy name doesn't mean gardening product!

---

### ❌ Jewelry → Gardening  
**WRONG:**
```
"Seed Pearl Necklace" → "Gardening" ❌
"Grass Seeds Earrings" → "Gardening" ❌
```

**CORRECT:**
```
"Seed Pearl Necklace" → "Home, Style & Objects > Jewellery" ✅
"Grass Seeds Earrings" → "Home, Style & Objects > Jewellery" ✅
```

**Why:** "Seed" = type of pearl in jewelry, NOT plant seeds!

---

## 📋 Categorization Process

### Step 1: Read Description
```
Look for keywords in description:
- "kitchen", "cooking", "food" → Cooking & food
- "garden", "plant", "herbs" → Gardening
- "jewelry", "necklace", "bracelet" → Jewellery
- "toy", "children", "play" → Children & family
```

### Step 2: Check Product Name
```
"Bottle Opener" → Kitchen tool
"Terracotta Planter" → Garden pot
"Seed Pearl Necklace" → Jewelry
```

### Step 3: Verify with Tags
```
interest_tags: ["Cooking & food"] → Confirms cooking category
gift_type_tags: ["Things to eat or drink"] → Food/drink category
```

### Step 4: Check Retailer Context
```
Retailer: "Whisky Exchange" → Wine & drinks category
Retailer: "Garden Centre" → Gardening category
```

### Step 5: Assign Category
```
Format: "Category 1 > Category 2 > Category 3" (if applicable)

Examples:
- "Food & Drink > Cooking & food"
- "Food & Drink > Wine & Drinks > Whisky"
- "Home, Style & Objects > Gardening"
- "Home, Style & Objects > Jewellery"
```

---

## 📤 Output Format

Return JSON array:

```json
[
  {
    "product_id": "abc123",
    "row_number": 1,
    "name": "Stainless Steel Bottle Opener",
    "current_category": "Fashion & accessories",
    "corrected_category": "Food & Drink > Cooking & food",
    "confidence": "high",
    "reasoning": "Description mentions 'kitchen tool' and 'bar accessory'. Product is for opening bottles (kitchen/bar use). interest_tags confirm 'Cooking & food'. Clearly belongs in Food & Drink > Cooking & food, not Fashion."
  },
  {
    "product_id": "xyz789",
    "row_number": 2,
    "name": "KEW Terracotta Dish Planter Set",
    "current_category": "Lifestyle & Wellbeing > Wellness & self-care",
    "corrected_category": "Home, Style & Objects > Gardening",
    "confidence": "high",
    "reasoning": "Description explicitly mentions 'gardening', 'plants', 'herbs', 'drainage holes'. This is clearly a planter for gardening purposes, not wellness/spa. Correct category is Gardening."
  }
]
```

---

## 🎯 Quality Checklist

Before returning, verify:

- [ ] Did I read the full description for each product?
- [ ] Did I check interest_tags and gift_type_tags?
- [ ] Are kitchen/bar tools in "Cooking & food" (NOT Fashion)?
- [ ] Are planters/garden tools in "Gardening" (NOT Wellness)?
- [ ] Are toys in "Children & family" (even if name has "garden")?
- [ ] Is jewelry in "Jewellery" (even if mentions "seed")?
- [ ] Does category format match exactly (with > separators)?
- [ ] Is my reasoning specific and references description content?

---

## ⚠️ Confidence Levels

- **high** = Description + name + tags clearly indicate category
- **medium** = Reasonable inference but some ambiguity
- **low** = Insufficient information or doesn't fit any category well

---

## 🔑 Key Success Factors

1. **READ THE DESCRIPTION!** It's your best source of truth
2. **Context matters:** "Garden" in toy name ≠ gardening product
3. **Function over name:** What it's USED for determines category
4. **Use all available data:** Name + description + tags + retailer
5. **Be specific in reasoning:** Reference actual description content

---

## 📦 Total Products: 5,428

Process all products and return complete JSON array with corrected categories.

**Remember: The description field now contains FULL product details - use it!** ✅
