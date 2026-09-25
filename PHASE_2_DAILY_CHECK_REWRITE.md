# Phase 2: Daily Birthday Check Rewrite Plan

## Current Problem

The `dailyBirthdayCheck` function only checks `recipient.birthday` field:
- Ignores `recipient.occasions` array completely
- Can't handle multiple occasions per recipient
- Hardcoded to single occasion per recipient

## Required Changes

### 1. Loop Through ALL Occasions

**Current:**
```typescript
const until = daysUntilNext(recipient.birthday);
if (until === 42) { /* send 6-week email */ }
```

**New:**
```typescript
const occasions = await getAllRecipientOccasions(recipient, currentYear);

for (const occasion of occasions) {
  const until = daysUntil(occasion.date);
  
  if (until === 42) { 
    await send6WeekEmail(recipient, occasion);
  }
  if (until === 14) {
    await send2WeekEmail(recipient, occasion);
  }
  if (daysSince(occasion.date) === 2) {
    await sendPostOccasionEmail(recipient, occasion);
  }
}
```

### 2. Update Email Logging

**Current:**
```typescript
await logSend(recipient, "6_week_reminder", occYear, status);
```

**New:**
```typescript
await logEmailSend({
  subscriberId: recipient.subscriber_id,
  recipientId: recipient.id,
  emailType: "6_week_reminder",
  occasionType: occasion.type,
  occasionYear: occasion.date.getFullYear(),
  occasionDate: occasion.date,
  status: status
});
```

### 3. Check Per-Occasion Email History

**Current:**
```typescript
const alreadySent = async (recipientId, emailType, year) => {
  const logs = await svc.entities.EmailLog.filter({ 
    recipient_id: recipientId, 
    email_type: emailType 
  });
  return logs.some((l) => l.occasion_year === year);
};
```

**New:**
```typescript
const alreadySent = await hasEmailBeenSent(
  recipient.id, 
  occasion.type, 
  "6_week_reminder", 
  occasion.date.getFullYear()
);
```

## Implementation Strategy

Due to the complexity of rewriting the Base44 function, I recommend:

### Option A: Create Express Endpoint (Recommended)

Create `/api/admin/run-occasion-check` that:
- Uses our new occasion-resolver utility
- Loops through all recipients
- Loops through all occasions per recipient
- Sends appropriate emails
- Can be called manually OR scheduled

**Pros:**
- Can test immediately without deploying Base44 function
- Full control over logic
- Easy to debug
- Can run manually from admin panel

**Cons:**
- Need to call it somehow (cron job, admin button, etc.)

### Option B: Rewrite Base44 Function

Update the existing `dailyBirthdayCheck` Base44 function.

**Pros:**
- Already scheduled to run daily
- Integrated with existing system

**Cons:**
- More complex to test
- Base44 deployment required
- Harder to debug

## Recommendation

**Start with Option A** - Create Express endpoint first.

Once tested and working, we can:
1. Keep Express endpoint for manual testing
2. Optionally port logic to Base44 function later

## Next Steps

1. Create `/api/admin/run-occasion-check` endpoint
2. Add "Run Occasion Check" button in admin UI
3. Test manually with real recipients
4. Schedule with cron job when confident

---

**Status:** Ready to implement Option A
