# Email Customer Journey - Visual Flowchart

## Complete Email Sequence Timeline

```
USER SIGNS UP
    ↓
    ↓ [Immediate]
    ↓
┌─────────────────────────────────────────┐
│  📧 EMAIL 1: WELCOME                    │
│  "Welcome to You Remembered, by Gem"    │
│  ✓ Explains service promise             │
│  ✓ How it works (3 steps)               │
│  ✓ Bonus consultations info             │
│  ✓ CTA: "Add your people"               │
└─────────────────────────────────────────┘
    ↓
    ↓ [30 minutes later]
    ↓
┌─────────────────────────────────────────┐
│  📧 EMAIL 2: ONBOARDING FORM            │
│  "Now, tell me about the people..."     │
│  ✓ Gentle nudge to add recipients       │
│  ✓ CTA: "Add your people"               │
└─────────────────────────────────────────┘
    ↓
    ↓ [User adds recipients with birthdays]
    ↓
    ↓
    ↓ [Time passes...]
    ↓
    ↓
    ↓ [6 WEEKS before occasion]
    ↓
┌─────────────────────────────────────────┐
│  📧 EMAIL 3: 6-WEEK REMINDER            │
│  "It's nearly time for [Name] 🎁"       │
│  ✓ Shows current profile info           │
│  ✓ Asks if anything needs updating      │
│  ✓ CTA: "Update [Name]'s profile"       │
│  ✓ Mentions gift ideas coming in 2 wks  │
└─────────────────────────────────────────┘
    ↓
    ↓ [User optionally updates profile]
    ↓
    ↓ [Gem curates gift list]
    ↓ [Gem approves list]
    ↓
    ↓ [~4 WEEKS before occasion]
    ↓
┌─────────────────────────────────────────┐
│  📧 EMAIL 4: GIFT IDEAS                 │
│  "Five ideas for [Name]'s [occasion]"   │
│  ✓ Shows 5 curated products             │
│  ✓ Each with personalized description   │
│  ✓ Direct links to buy                  │
│  ✓ "A thought before you buy" advice    │
│  ✓ "Not quite right?" help offer        │
└─────────────────────────────────────────┘
    ↓
    ↓ [2 WEEKS before occasion]
    ↓
┌─────────────────────────────────────────┐
│  📧 EMAIL 5: 2-WEEK REMINDER (NEW!)     │
│  "A quick nudge — [Name]'s in 2 weeks"  │
│  ✓ Gentle reminder about gift ideas     │
│  ✓ CTA: "View [Name]'s gift ideas"      │
│  ✓ Delivery timing note                 │
│  ✓ Help offer if nothing fits           │
└─────────────────────────────────────────┘
    ↓
    ↓ [User hopefully bought gift!]
    ↓
    ↓ [OCCASION DATE! 🎉]
    ↓
    ↓ [2 DAYS after occasion]
    ↓
┌─────────────────────────────────────────┐
│  📧 EMAIL 6: POST-OCCASION FOLLOW-UP    │
│  "How did it go? 🎉"                    │
│  ✓ Did the gift land well?              │
│  ✓ CTA: "Share how it went" (feedback)  │
│  ✓ Referral request                     │
│  ✓ CTA: "Share You Remembered"          │
└─────────────────────────────────────────┘
    ↓
    ↓ [User provides feedback]
    ↓ [Maybe refers friends]
    ↓
    ↓ [NEXT YEAR: Cycle repeats from Email 3]
    ↓
    
```

---

## Email Frequency Per Recipient

For each person the subscriber adds:

```
Year 1:
  Week 0: Sign up → Welcome + Onboarding (2 emails)
  Week 1-41: [silence]
  Week 42 (6 weeks before): 6-Week Reminder (1 email)
  Week 44 (4 weeks before): Gift Ideas (1 email)
  Week 46 (2 weeks before): 2-Week Reminder (1 email)
  Week 48: [occasion happens]
  Week 48+2 days: Post-Occasion Follow-Up (1 email)
  
Total first year: 6 emails

Year 2+ (for same recipient):
  6 weeks before: 6-Week Reminder (1 email)
  4 weeks before: Gift Ideas (1 email)
  2 weeks before: 2-Week Reminder (1 email)
  2 days after: Post-Occasion Follow-Up (1 email)
  
Total recurring: 4 emails per recipient per year
```

---

## Email Decision Tree

```
NEW SUBSCRIBER
├─ Has valid email? 
│  ├─ YES → Send Welcome Email ✅
│  │        └─ Log to EmailLog (type: welcome)
│  │        └─ Wait 30 minutes
│  │             └─ Send Onboarding Email ✅
│  │                  └─ Log to EmailLog (type: onboarding_reminder)
│  └─ NO → Skip emails
│
└─ Does subscriber have recipients?
   ├─ NO → Only Welcome/Onboarding emails sent
   │        (waiting for them to add people)
   │
   └─ YES → Enter occasion reminder cycle
            │
            ├─ DAILY CHECK: 42 days before occasion?
            │  ├─ YES → Already sent this year?
            │  │        ├─ NO → Send 6-Week Reminder ✅
            │  │        │        └─ Log to EmailLog (type: 6_week_reminder, year: 2026)
            │  │        └─ YES → Skip (already sent)
            │  └─ NO → Continue checking
            │
            ├─ MANUAL TRIGGER: Gift list approved?
            │  └─ YES → Already sent for this list?
            │           ├─ NO → Send Gift Ideas Email ✅
            │           │        └─ Log to EmailLog (type: 30_day, gift_list_id: X)
            │           └─ YES → Skip (already sent)
            │
            ├─ DAILY CHECK: 14 days before occasion?
            │  ├─ YES → Already sent this year?
            │  │        ├─ NO → Send 2-Week Reminder ✅
            │  │        │        └─ Log to EmailLog (type: 2_week_reminder, year: 2026)
            │  │        └─ YES → Skip (already sent)
            │  └─ NO → Continue checking
            │
            └─ DAILY CHECK: 2 days after occasion?
               ├─ YES → Already sent this year?
               │        ├─ NO → Send Post-Occasion Email ✅
               │        │        └─ Log to EmailLog (type: post_occasion, year: 2026)
               │        └─ YES → Skip (already sent)
               └─ NO → Continue checking
```

---

## Technical Flow: How Emails Are Triggered

### Automation-Triggered (Immediate)

```
1. User completes signup form
   ↓
2. Stripe checkout success
   ↓
3. completePaidSignup creates Subscriber record
   ↓
4. Base44 automation: "On Subscriber create"
   ↓
5. Calls sendWelcomeEmail function
   ↓
6. Checks EmailLog for duplicate
   ↓
7. Sends via Resend API
   ↓
8. Logs to EmailLog (status: sent/failed)
```

### Scheduled-Triggered (Cron)

```
┌─────────────────────────────────────┐
│  EVERY 10 MINUTES                   │
│  sendOnboardingEmail runs           │
│  ↓                                  │
│  1. Get all subscribers             │
│  2. Filter: created 30+ min ago     │
│  3. Filter: created <24 hrs ago     │
│  4. Check EmailLog for duplicates   │
│  5. Send to eligible subscribers    │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  EVERY DAY (scheduled)              │
│  dailyBirthdayCheck runs            │
│  ↓                                  │
│  1. Get all recipients              │
│  2. For each recipient:             │
│     ├─ Calculate days until occasion│
│     ├─ If 42 days: Send 6-week      │
│     ├─ If 14 days: Send 2-week      │
│     └─ If -2 days: Send post-occ    │
│  3. Check EmailLog before each send │
│  4. Log all successful sends        │
└─────────────────────────────────────┘
```

### Manual-Triggered (Admin Action)

```
1. Gem reviews generated gift list in Admin Dashboard
   ↓
2. Clicks "Approve" button
   ↓
3. Frontend calls sendApprovalEmail function
   ↓
4. Checks EmailLog for duplicate (by gift_list_id)
   ↓
5. Sends email via Resend
   ↓
6. Logs to EmailLog
```

---

## Deduplication Logic

### How We Prevent Duplicate Emails

Every email checks `EmailLog` before sending:

```typescript
// Example: 6-week reminder
const alreadySent = await EmailLog.filter({
  recipient_id: "recipient123",
  email_type: "6_week_reminder",
  occasion_year: 2026,  // ← KEY: Per-year dedupe
  status: "sent"        // ← Only successful sends block
});

if (alreadySent.length > 0) {
  return "skip"; // Already sent this year
}

// Safe to send → proceed
```

### Why This Works

1. **occasion_year**: Same email can go out next year
2. **status: "sent"**: Failed sends don't block retries
3. **email_type**: Each email type tracked separately
4. **recipient_id**: Per-recipient tracking (not per-subscriber)

### Special Cases

**Welcome/Onboarding**: Checks across all subscribers with same email address
```typescript
// Prevents duplicate welcome if user has multiple Subscriber records
const sameEmail = await Subscriber.filter({ email: "user@example.com" });
const relatedIds = sameEmail.map(s => s.id);
for (const id of relatedIds) {
  const prior = await EmailLog.filter({ 
    subscriber_id: id, 
    email_type: "welcome",
    status: "sent" 
  });
  if (prior.length > 0) return "already_sent";
}
```

**Gift Ideas**: Checks by gift_list_id (not year-based)
```typescript
// Gift list is unique, never resend same list
const existing = await EmailLog.filter({ 
  gift_list_id: "list456",
  status: "sent" 
});
if (existing.length > 0) return "already_sent";
```

---

## Error Handling & Retry Logic

### What Happens When Email Fails?

```
1. Email send fails (Resend returns error)
   ↓
2. Status logged as "failed" in EmailLog
   ↓
3. Next day: dailyBirthdayCheck runs again
   ↓
4. Checks EmailLog: finds "failed" record
   ↓
5. "failed" ≠ "sent" so dedupe check passes
   ↓
6. Attempts to send again ✅
   ↓
7. If success: Updates to "sent"
   └─ If fail: Creates new "failed" record
```

### Why Only "sent" Blocks Retries

If we blocked on any EmailLog record (including "failed"), one Resend outage would permanently prevent that user from ever receiving that email. By only blocking on successful sends, we allow automatic retry.

---

## Multi-Recipient Example

**Scenario**: Subscriber adds 3 people

```
Subscriber: Sarah
├─ Recipient 1: Mom (birthday Feb 15)
├─ Recipient 2: Best Friend (birthday June 10)
└─ Recipient 3: Partner (birthday Nov 3)

Email Timeline:
─────────────────────────────────────────────────────
Jan 1    : Sign up → Welcome + Onboarding (2 emails)
Jan 4    : [Added all 3 recipients]

For Mom (Feb 15):
Jan 4    : 6-Week Reminder (42 days before Feb 15)
Jan 18   : Gift Ideas (approved by Gem)
Feb 1    : 2-Week Reminder
Feb 15   : [Birthday! 🎉]
Feb 17   : Post-Occasion Follow-Up

For Best Friend (June 10):
Apr 29   : 6-Week Reminder
May 13   : Gift Ideas (approved by Gem)
May 27   : 2-Week Reminder
June 10  : [Birthday! 🎉]
June 12  : Post-Occasion Follow-Up

For Partner (Nov 3):
Sep 22   : 6-Week Reminder
Oct 6    : Gift Ideas (approved by Gem)
Oct 20   : 2-Week Reminder
Nov 3    : [Birthday! 🎉]
Nov 5    : Post-Occasion Follow-Up

Total emails first year: 2 + (4×3) = 14 emails
─────────────────────────────────────────────────────
```

---

## Monitoring & Analytics

### What to Track

**Email Delivery**:
- Total emails sent per day
- Failed sends (investigate Resend errors)
- Emails by type (which emails send most often?)

**User Engagement**:
- Welcome email open rate
- Gift ideas email click rate
- Post-occasion feedback submission rate
- Referral link clicks

**System Health**:
- EmailLog growth (deduplication working?)
- Scheduled function execution (daily check running?)
- Time between 6-week reminder and gift approval

### Sample Queries

```sql
-- Emails sent today
SELECT email_type, COUNT(*) 
FROM EmailLog 
WHERE DATE(sent_at) = CURRENT_DATE 
GROUP BY email_type;

-- Failed sends (need retry)
SELECT * FROM EmailLog 
WHERE status = 'failed' 
AND sent_at > NOW() - INTERVAL '7 days';

-- Users who never got gift ideas
SELECT DISTINCT subscriber_id 
FROM EmailLog 
WHERE email_type = '6_week_reminder'
AND subscriber_id NOT IN (
  SELECT subscriber_id FROM EmailLog 
  WHERE email_type = '30_day'
);
```

---

## Summary: The Complete Journey

```
📧 Emails 1-2: Onboarding
   └─ Get user signed up and adding recipients

📧 Emails 3-5: Pre-Occasion
   └─ Remind, curate, nudge toward purchasing

📧 Email 6: Post-Occasion
   └─ Collect feedback, request referrals

🔁 Cycle repeats annually per recipient
```

**Total possible emails per subscriber per year**:
- Welcome + Onboarding: 2 (one-time)
- Per recipient: 4 (recurring annually)
- For 10 recipients: 2 + (4 × 10) = **42 emails/year**

But in practice:
- Not all occasions are birthdays
- Some users have fewer recipients
- Average likely: **15-25 emails per subscriber per year**

---

This flowchart shows the complete customer journey from sign-up through their first year with multiple recipients, including all timing, deduplication logic, and technical triggers.
