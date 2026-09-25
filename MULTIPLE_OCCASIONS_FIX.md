# Multiple Occasions Support - Implementation Plan

**Date:** September 25, 2026  
**Status:** 🚧 In Progress

## Problem

Currently, the system only checks `recipient.birthday` field for gift list generation, completely ignoring the `occasions` JSON array. This means:

❌ If a recipient has multiple occasions (Birthday + Anniversary + Eid), only Birthday is tracked  
❌ Variable dates (Eid, Diwali, Lunar New Year) have no central management  
❌ Admin cannot update yearly variable occasion dates

## Requirements

### 1. Multiple Occasions Per Recipient
Each recipient can have multiple occasions with different dates and budgets:
- Birthday: June 15, £50-£150
- Anniversary: August 20, £100-£300
- Eid: April 10, £30-£80
- Christmas: Dec 25, £50-£150

### 2. Smart Gift Generation Timing
-  **< 6 weeks away**: Generate immediately on registration
- **\>= 6 weeks away**: Generate exactly 6 weeks before

### 3. Admin-Managed Variable Dates
Admin sets yearly dates for occasions like:
- Eid (changes ~11 days per year, lunar calendar)
- Diwali
- Lunar New Year
- Rosh Hashanah
- Hanukkah

### 4. Fixed vs Variable Occasions

**Personal Fixed (user-entered):**
- Birthday
- Anniversary  
- Other (custom)

**Calendar Fixed (no admin needed):**
- Christmas (Dec 25)
- Valentine's Day (Feb 14)
- Mother's Day (varies by country, but UK uses 4th Sunday of Lent)
- Father's Day (3rd Sunday of June in UK)
- Easter (varies, but calculable)

**Variable (admin-managed):**
- Eid al-Fitr
- Eid al-Adha
- Diwali
- Lunar New Year
- Rosh Hashanah
- Hanukkah

## Solution Architecture

### Database Changes

#### ✅ 1. New Table: `global_occasion_dates`

```sql
CREATE TABLE "global_occasion_dates" (
  "id" TEXT PRIMARY KEY,
  "occasion_type" TEXT NOT NULL,      -- "Eid", "Diwali", etc.
  "year" INTEGER NOT NULL,
  "month" INTEGER NOT NULL,           -- 1-12
  "day" INTEGER NOT NULL,             -- 1-31
  "notes" TEXT,                       -- "Eid al-Fitr 2027"
  "created_at" TIMESTAMP DEFAULT NOW(),
  "updated_at" TIMESTAMP,
  UNIQUE(occasion_type, year)
);
```

**Example Data:**
```json
[
  { "occasion_type": "Eid", "year": 2026, "month": 4, "day": 10 },
  { "occasion_type": "Eid", "year": 2027, "month": 3, "day": 30 },
  { "occasion_type": "Diwali", "year": 2026, "month": 11, "day": 1 },
  { "occasion_type": "Lunar New Year", "year": 2027, "month": 1, "day": 29 }
]
```

#### ✅ 2. Migration Applied

```bash
prisma/migrations/20260925_add_global_occasion_dates/migration.sql
```

### Code Changes Needed

#### 1. Admin Panel - Occasion Calendar UI

**File:** `src/components/admin/OccasionCalendar.jsx` (NEW)

Features:
- List all variable occasions from `options.jsx`
- Show current year + next year dates
- Edit/Add dates for each occasion
- Bulk import feature (copy-paste from external calendar)

**UI Wireframe:**
```
┌─────────────────────────────────────────┐
│  Occasion Calendar                      │
│                                         │
│  Eid                                    │
│    2026: April 10    [Edit]            │
│    2027: March 30    [Edit]            │
│    2028: [Add Date]                     │
│                                         │
│  Diwali                                 │
│    2026: November 1  [Edit]            │
│    2027: [Add Date]                     │
│                                         │
│  [+ Add New Occasion Type]              │
└─────────────────────────────────────────┘
```

#### 2. Update `dailyBirthdayCheck` Function

**File:** `base44/functions/dailyBirthdayCheck/entry.ts`

**Current Logic:**
```typescript
const until = daysUntilNext(recipient.birthday);  // Only ONE date!
if (until === 42) { /* send reminder */ }
```

**New Logic:**
```typescript
// Get ALL occasions for this recipient
const occasions = await getRecipientOccasions(recipient);

for (const occasion of occasions) {
  const occDate = await resolveOccasionDate(occasion, currentYear);
  const until = daysUntil(occDate);
  
  // Immediate generation if < 42 days
  if (until > 0 && until < 42 && !hasGeneratedThisYear(occasion)) {
    await generateGiftList(recipient, occasion, occDate);
    await send6WeekEmail(recipient, occasion, occDate);
  }
  
  // Standard 6-week reminder
  if (until === 42) {
    await send6WeekEmail(recipient, occasion, occDate);
  }
  
  // 2-week reminder
  if (until === 14) {
    await send2WeekEmail(recipient, occasion, occDate);
  }
  
  // Post-occasion follow-up
  if (daysSince(occDate) === 2) {
    await sendPostOccasionEmail(recipient, occasion);
  }
}
```

#### 3. Occasion Date Resolver

**File:** `base44/functions/shared/occasion-resolver.ts` (NEW)

```typescript
export async function resolveOccasionDate(occasion, year) {
  const { type, day, month } = occasion;
  
  // Personal occasions (Birthday, Anniversary, Other)
  if (PERSONAL_OCCASIONS.includes(type)) {
    return new Date(year, month - 1, day);
  }
  
  // Fixed calendar occasions
  if (FIXED_CALENDAR_OCCASIONS[type]) {
    return FIXED_CALENDAR_OCCASIONS[type](year);
  }
  
  // Variable occasions - lookup in global_occasion_dates
  const globalDate = await svc.entities.GlobalOccasionDate.filter({
    occasion_type: type,
    year: year
  });
  
  if (globalDate.length > 0) {
    return new Date(year, globalDate[0].month - 1, globalDate[0].day);
  }
  
  // Fallback: occasion not configured
  console.warn(`No date configured for ${type} in ${year}`);
  return null;
}
```

#### 4. Base44 Entity Definition

**File:** `base44/entities/GlobalOccasionDate.jsonc` (NEW)

```json
{
  "name": "GlobalOccasionDate",
  "description": "Admin-managed calendar for variable occasions",
  "tableName": "global_occasion_dates",
  "fields": {
    "id": { "type": "string", "primaryKey": true },
    "occasion_type": { "type": "string", "required": true },
    "year": { "type": "integer", "required": true },
    "month": { "type": "integer", "required": true },
    "day": { "type": "integer", "required": true },
    "notes": { "type": "string" },
    "created_at": { "type": "datetime", "default": "now" },
    "updated_at": { "type": "datetime", "autoUpdate": true }
  }
}
```

#### 5. Express API Endpoints

**File:** `server/index.js`

```javascript
// Get all global occasion dates
app.get('/api/admin/occasion-dates', authenticateToken, requireAdmin, async (req, res) => {
  const dates = await prisma.globalOccasionDate.findMany({
    orderBy: [{ occasionType: 'asc' }, { year: 'asc' }]
  });
  res.json(dates);
});

// Create/Update occasion date
app.post('/api/admin/occasion-dates', authenticateToken, requireAdmin, async (req, res) => {
  const { occasionType, year, month, day, notes } = req.body;
  
  const date = await prisma.globalOccasionDate.upsert({
    where: {
      occasionType_year: { occasionType, year }
    },
    create: { occasionType, year, month, day, notes },
    update: { month, day, notes }
  });
  
  res.json(date);
});

// Delete occasion date
app.delete('/api/admin/occasion-dates/:id', authenticateToken, requireAdmin, async (req, res) => {
  await prisma.globalOccasionDate.delete({
    where: { id: req.params.id }
  });
  res.json({ success: true });
});
```

#### 6. Update Onboarding Form Logic

**File:** `src/components/onboarding/OccasionsField.jsx`

NO CHANGES NEEDED - users still enter dates the same way. The system will:
- Use personal dates for Birthday/Anniversary/Other
- **Ignore** user-entered dates for Eid/Diwali/etc.
- Use admin-managed global dates instead

## Email Log Changes

Update `EmailLog` tracking to include occasion type:

```javascript
await svc.entities.EmailLog.create({
  subscriber_id: recipient.subscriber_id,
  recipient_id: recipient.id,
  email_type: "6_week_reminder",
  occasion_type: occasion.type,  // NEW FIELD
  occasion_year: occYear,
  occasion_date: occDate,        // NEW FIELD
  sent_at: new Date().toISOString(),
  status: "sent"
});
```

**Migration needed:**
```sql
ALTER TABLE email_logs 
ADD COLUMN occasion_type TEXT,
ADD COLUMN occasion_date DATE;

CREATE INDEX email_logs_occasion_type_idx ON email_logs(occasion_type);
```

## Testing Scenarios

### Scenario 1: Registration with Multiple Upcoming Occasions

**Setup:**
- Today: October 1, 2026
- Register recipient with:
  - Birthday: November 15, 2026 (6 weeks + 3 days)
  - Anniversary: October 20, 2026 (2 weeks + 5 days)
  - Christmas: December 25, 2026 (12 weeks)

**Expected Behavior:**
1. Anniversary (19 days away): ✅ Generate immediately + send email
2. Birthday (45 days away): ✅ Wait until Sept 4, then send 6-week email
3. Christmas (85 days away): ✅ Wait until Oct 13 (6 weeks before), then send email

### Scenario 2: Variable Occasion (Eid)

**Setup:**
- Recipient has "Eid" selected
- Admin has set: Eid 2027 = March 30
- Today: February 1, 2027

**Expected Behavior:**
1. System looks up GlobalOccasionDate for "Eid" + 2027
2. Finds: March 30, 2027 (57 days away)
3. Sends 6-week reminder on Feb 16 (42 days before)

### Scenario 3: Admin Updates Eid Date

**Setup:**
- Eid 2027 was set to March 30
- Actual sighting: Eid is March 31
- Admin updates date to March 31

**Expected Behavior:**
1. All recipients with "Eid" occasion now use March 31
2. If 6-week emails already sent → no re-send
3. If not yet sent → use new date (March 31)

## Deployment Plan

### Phase 1: Database & Backend ✅
- [x] Create GlobalOccasionDate table
- [x] Run migration
- [ ] Generate Prisma client
- [ ] Create Base44 entity definition
- [ ] Add Express API endpoints
- [ ] Create occasion resolver utility

### Phase 2: Admin UI
- [ ] Create OccasionCalendar component
- [ ] Add "Occasion Calendar" to admin menu
- [ ] Test CRUD operations

### Phase 3: Email Logic
- [ ] Update dailyBirthdayCheck function
- [ ] Test with mock data
- [ ] Add occasion_type to EmailLog
- [ ] Update email templates

### Phase 4: Testing & Rollout
- [ ] Test all 3 scenarios above
- [ ] Seed global occasion dates for 2026-2028
- [ ] Deploy to production
- [ ] Monitor email logs

## Migration Script for Production

```javascript
// scripts/seed-global-occasions.js
const occasions = [
  // Eid al-Fitr (estimated, adjust based on moon sighting)
  { type: "Eid", year: 2026, month: 4, day: 10, notes: "Eid al-Fitr 2026 (estimated)" },
  { type: "Eid", year: 2027, month: 3, day: 30, notes: "Eid al-Fitr 2027 (estimated)" },
  { type: "Eid", year: 2028, month: 3, day: 19, notes: "Eid al-Fitr 2028 (estimated)" },
  
  // Diwali
  { type: "Diwali", year: 2026, month: 11, day: 1, notes: "Diwali 2026" },
  { type: "Diwali", year: 2027, month: 10, day: 21, notes: "Diwali 2027" },
  { type: "Diwali", year: 2028, month: 11, day: 9, notes: "Diwali 2028" },
  
  // Lunar New Year
  { type: "Lunar New Year", year: 2027, month: 1, day: 29, notes: "Year of the Goat" },
  { type: "Lunar New Year", year: 2028, month: 2, day: 17, notes: "Year of the Monkey" },
];

for (const occ of occasions) {
  await prisma.globalOccasionDate.create({ data: occ });
}
```

## Future Enhancements

1. **Calendar API Integration**: Auto-sync from Google Calendar API
2. **SMS Reminders**: Notify admin 2 months before to confirm next year's dates
3. **Bulk Import**: CSV/Excel upload for multiple years
4. **Regional Variations**: Different dates for UK vs other countries

---

**Status:** Database ready, awaiting full implementation
