# Product Categorization Task

## Task Overview
Review 5428 products and assign correct 3-level categories based on product name, URL, and description.

## Product Data
See: products-for-categorization.json or products-for-categorization.csv

## Instructions

1. **Review each product** (name, URL, description, retailer)
2. **Assign correct category** using 3-level format: "Category 1 > Category 2 > Category 3"
3. **Return results** in JSON format shown below

## Category Format

Use this exact format:
- 1 level: "Food & Drink"
- 2 levels: "Food & Drink > Wine & Drinks"
- 3 levels: "Food & Drink > Wine & Drinks > Whisky"


## Valid Categories (3-Level Structure)

### Food & Drink
- Cooking & food
- Wine & Drinks
  - Wine
  - Beer
  - Cocktails
  - Whisky
  - Gin
  - Rum
  - Tequila
  - No particular preference
- Coffee & tea

### Lifestyle & Wellbeing
- Travel & adventure
- Wellness & self-care
- Beauty & skincare
- Sustainability & eco living
- Spirituality

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
- Outdoor pursuits

### Creative & Culture
- Reading & books
- Art & culture
- Music
  - Listening
  - Playing an instrument
  - Vinyl collecting
  - Concerts & live music
- Theatre & performing arts
- Photography
- Crafts & making things
- Film & TV
- Podcasts & audiobooks

### Home, Style & Objects
- Fashion & accessories
- Watches
- Jewellery
- Home & interiors
- Gardening
- DIY & tools
- Tech & gadgets

### Children & Family
- Children & family activities
- Toys, games & activities


## Example Issues to Fix

**Current:** "Fashion & accessories"
**Product:** Dom Perignon 2013 (Champagne)
**URL:** https://hedonism.co.uk/product/dom-perignon-2013
**Correct:** "Food & Drink > Wine & Drinks > Wine"

**Current:** "UNISEX_ADULT" (not a category!)
**Product:** Coffee maker
**Correct:** "Food & Drink > Coffee & tea"

## Output Format

Return JSON array with this structure:

```json
[
  {
    "product_id": "abc123",
    "row_number": 1,
    "name": "Dom Perignon 2013",
    "current_category": "Fashion & accessories",
    "corrected_category": "Food & Drink > Wine & Drinks > Wine",
    "confidence": "high",
    "reasoning": "Champagne product from wine retailer"
  },
  {
    "product_id": "xyz789",
    "row_number": 2,
    "name": "Coffee Maker",
    "current_category": "UNISEX_ADULT",
    "corrected_category": "Food & Drink > Coffee & tea",
    "confidence": "high",
    "reasoning": "Kitchen appliance for making coffee"
  }
]
```

## Confidence Levels
- **high**: Clear category from name/URL/description
- **medium**: Reasonable guess based on context
- **low**: Unclear, needs human review

## Notes
- If product doesn't fit any category, use "corrected_category": null
- If current category is already correct, keep it
- Use exact spelling from valid categories list
- Focus on main product function, not brand or style

## Total Products: 5428

Process all products and return complete JSON array.
