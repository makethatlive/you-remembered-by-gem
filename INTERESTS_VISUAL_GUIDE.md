# Structured Interests - Visual Guide

**Date:** September 9, 2026  
**Status:** Complete Implementation

This document shows exactly how the new structured interests section looks and behaves in the onboarding form.

---

## Complete Interest Structure

```
Their interests (optional)
Helper: Select all that apply. Categories with a ▸ will reveal a short 
follow-up question to help narrow down the best gift ideas.

┌─────────────────────────────────────────────────────┐
│                                                     │
│  ▶ Food & Drink                                     │
│  ▶ Lifestyle & Wellbeing                            │
│  ▶ Sport & Fitness                                  │
│  ▶ Creative & Culture                               │
│  ▶ Home, Style & Objects                            │
│  ▶ Tech, Games & Curiosity                          │
│  ▶ Family & Pets                                    │
│                                                     │
│  ─────────────────────────────────────────────────  │
│  ☐ Other                                            │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Expanded Categories

### 1. Food & Drink

```
▼ Food & Drink

  ☐ Cooking & food
  
  ☐ Wine & Drinks ▸
  
  ☐ Coffee & tea
```

**When "Wine & Drinks" is selected:**

```
▼ Food & Drink

  ☐ Cooking & food
  
  ☑ Wine & Drinks ▸
    │ Which of these applies?
    │ ☐ Wine
    │ ☐ Beer
    │ ☐ Cocktails
    │ ☐ Whisky
    │ ☐ Gin
    │ ☐ Rum
    │ ☐ Tequila
    │ ☐ No particular preference
  
  ☐ Coffee & tea
```

---

### 2. Lifestyle & Wellbeing

```
▼ Lifestyle & Wellbeing

  ☐ Travel & adventure
  ☐ Wellness & self-care
  ☐ Beauty & skincare
  ☐ Sustainability & eco living
  ☐ Spirituality
```

---

### 3. Sport & Fitness

```
▼ Sport & Fitness

  ☐ Running
  ☐ Yoga & Pilates
  ☐ Swimming
  ☐ Football
  ☐ Rugby
  ☐ Cricket
  ☐ Motorsports
  ☐ Tennis
  ☐ Golf
  ☐ Cycling
  ☐ Outdoor pursuits
```

---

### 4. Creative & Culture

```
▼ Creative & Culture

  ☐ Reading & books
  ☐ Art & culture
  
  ☐ Music ▸
  
  ☐ Theatre & performing arts
  ☐ Photography
  ☐ Crafts & making things
  ☐ Film & TV
  ☐ Podcasts & audiobooks
```

**When "Music" is selected:**

```
▼ Creative & Culture

  ☐ Reading & books
  ☐ Art & culture
  
  ☑ Music ▸
    │ Which of these applies?
    │ ☐ Listening
    │ ☐ Playing an instrument
    │ ☐ Vinyl collecting
    │ ☐ Concerts & live music
  
  ☐ Theatre & performing arts
  ☐ Photography
  ☐ Crafts & making things
  ☐ Film & TV
  ☐ Podcasts & audiobooks
```

---

### 5. Home, Style & Objects

```
▼ Home, Style & Objects

  ☐ Fashion & accessories
  ☐ Watches
  ☐ Jewellery
  ☐ Home & interiors
  ☐ Gardening
  ☐ DIY & tools
```

---

### 6. Tech, Games & Curiosity

```
▼ Tech, Games & Curiosity

  ☐ Tech & gadgets
  
  ☐ Gaming (video games) ▸
  
  ☐ Board games & puzzles
  ☐ Science & nature
  ☐ History & politics
```

**When "Gaming (video games)" is selected:**

```
▼ Tech, Games & Curiosity

  ☐ Tech & gadgets
  
  ☑ Gaming (video games) ▸
    │ Which of these applies?
    │ ☐ Console
    │ ☐ PC
    │ ☐ Mobile
    │ ☐ Retro/collector
  
  ☐ Board games & puzzles
  ☐ Science & nature
  ☐ History & politics
```

---

### 7. Family & Pets

```
▼ Family & Pets

  ☐ Children & family activities
  
  ☐ Pets ▸
```

**When "Pets" is selected:**

```
▼ Family & Pets

  ☐ Children & family activities
  
  ☑ Pets ▸
    │ Which of these applies?
    │ ☐ Dog
    │ ☐ Cat
    │ ☐ Other pet
```

---

## Collapsed State with Selections

When a category is collapsed but has selections:

```
▶ Food & Drink (2 selected)
```

Expands to show:

```
▼ Food & Drink (2 selected)

  ☑ Cooking & food
  
  ☑ Wine & Drinks ▸
    │ Which of these applies?
    │ ☑ Wine
    │ ☐ Beer
    │ ☐ Cocktails
    │ ☑ Whisky
    │ ☐ Gin
    │ ☐ Rum
    │ ☐ Tequila
    │ ☐ No particular preference
  
  ☐ Coffee & tea
```

---

## Complete Example: Multiple Selections

User has selected various interests across categories:

```
▶ Food & Drink (2 selected)
▶ Lifestyle & Wellbeing
▶ Sport & Fitness (1 selected)
▶ Creative & Culture (2 selected)
▶ Home, Style & Objects (1 selected)
▶ Tech, Games & Curiosity
▶ Family & Pets (1 selected)

──────────────────────────────────────────
☐ Other
```

**Expanding "Creative & Culture" shows:**

```
▼ Creative & Culture (2 selected)

  ☐ Reading & books
  ☐ Art & culture
  
  ☑ Music ▸
    │ Which of these applies?
    │ ☐ Listening
    │ ☐ Playing an instrument
    │ ☑ Vinyl collecting
    │ ☑ Concerts & live music
  
  ☐ Theatre & performing arts
  
  ☑ Photography
  
  ☐ Crafts & making things
  ☐ Film & TV
  ☐ Podcasts & audiobooks
```

---

## Data Stored

For the above example, the data structure would be:

```javascript
{
  interests: {
    interests: [
      "Cooking & food",
      "Wine & Drinks",
      "Football",
      "Music",
      "Photography",
      "Gardening",
      "Pets"
    ],
    followUps: {
      "Wine & Drinks": ["Wine", "Whisky"],
      "Music": ["Vinyl collecting", "Concerts & live music"],
      "Pets": ["Dog"]
    }
  }
}
```

---

## Color & Style Guide

### Colors
- **Primary text:** Dark brand color (#333 or similar)
- **Category headers:** Bold, dark text
- **Selected items:** Brand teal checkboxes
- **Arrows:** Brand teal (▶ ▼)
- **Follow-up indicators:** Brand teal (▸)
- **Helper text:** Lighter gray (60% opacity)

### Spacing
- **Category spacing:** 1.5rem between categories
- **Item spacing:** 0.625rem (2.5 in Tailwind)
- **Follow-up indent:** 2rem (8 in Tailwind)
- **Follow-up item spacing:** 0.375rem (1.5 in Tailwind)

### Typography
- **Category headers:** font-semibold, text-sm
- **Interest items:** font-body, text-sm
- **Follow-up label:** font-body, text-xs
- **Follow-up options:** font-body, text-xs

---

## Interaction Behaviors

### Click Category Header
- **Collapsed → Expanded:** Show all interests in category
- **Expanded → Collapsed:** Hide interests, show count if any selected

### Check Interest (without ▸)
- **Unchecked → Checked:** Add to interests array
- **Checked → Unchecked:** Remove from interests array

### Check Interest (with ▸)
- **Unchecked → Checked:** 
  1. Add to interests array
  2. Expand follow-up section
- **Checked → Unchecked:**
  1. Remove from interests array
  2. Clear all follow-up selections
  3. Remove from followUps object

### Check Follow-up Option
- **Unchecked → Checked:** Add to followUps[interest] array
- **Checked → Unchecked:** Remove from followUps[interest] array

---

## Accessibility

- ✅ All checkboxes keyboard navigable
- ✅ Category headers are buttons with proper ARIA labels
- ✅ Expanded/collapsed state announced to screen readers
- ✅ Checkboxes have associated labels
- ✅ Hierarchical structure maintained for assistive tech

---

## Mobile Considerations

- Categories stack vertically (already single column)
- Touch targets are adequate (44px minimum)
- Follow-up sections may need extra padding on mobile
- Consider collapsing all categories by default on mobile
- Long category names wrap properly

---

**END OF VISUAL GUIDE**
