# Complete Onboarding Flow Analysis - From Scratch

## 🎯 Executive Summary

The onboarding flow consists of:
1. **User signs up** → Stripe payment → Account creation → Welcome email (immediate)
2. **Onboarding form appears** → User adds people → Dashboard
3. **Onboarding email sent** → 30 minutes after signup (automated)

This document traces every step from the moment a user lands on the signup page through to when they see the onboarding form, plus when and how the onboarding email is triggered.

---

## 📊 Complete User Journey Flowchart

```
┌────────────────────────────────────────────────────────────────┐
│  VISITOR LANDS ON SIGNUP PAGE                                  │
│  Location: /signup (not shown in codebase)                     │
└────────────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────────┐
│  USER FILLS OUT SIGNUP FORM                                    │
│  - Name                                                         │
│  - Email                                                        │
│  - Password                                                     │
│  - How did you hear about us?                                  │
└────────────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────────┐
│  STEP 1: STRIPE CHECKOUT                                       │
│  Function: stripeCheckout (base44/functions/stripeCheckout)    │
│                                                                 │
│  What happens:                                                 │
│  1. Creates SignupAttempt record (email + name)                │
│  2. Creates Stripe customer                                    │
│  3. Creates Stripe checkout session                            │
│  4. Redirects user to Stripe payment page                      │
└────────────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────────┐
│  USER COMPLETES PAYMENT ON STRIPE                              │
│  - Enters card details                                         │
│  - Stripe processes payment                                    │
└────────────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────────┐
│  STEP 2: STRIPE WEBHOOK (checkout.session.completed)           │
│  Function: stripeWebhook (base44/functions/stripeWebhook)      │
│                                                                 │
│  What happens:                                                 │
│  1. Receives webhook from Stripe                               │
│  2. Creates/Updates Subscriber record:                         │
│     - email (from SignupAttempt or session)                    │
│     - name (from SignupAttempt or session)                     │
│     - stripe_customer_id                                       │
│     - stripe_subscription_id                                   │
│     - subscription_status: "active"                            │
│     - subscribed_since: today's date                           │
│  3. Record is owned by SERVICE ROLE (not user yet)             │
│                                                                 │
│  ⚠️ CRITICAL: This Subscriber record exists but user           │
│     cannot see it yet (they haven't logged in)                 │
└────────────────────────────────────────────────────────────────┘
                            ↓
                            ↓ [Webhook also triggers Base44 automation]
                            ↓
┌────────────────────────────────────────────────────────────────┐
│  📧 AUTOMATION TRIGGER: Subscriber "create" event               │
│                                                                 │
│  Base44 automation (configured in Base44 platform):            │
│  - Trigger: "On Subscriber create"                             │
│  - Action: Call sendWelcomeEmail function                      │
│                                                                 │
│  Function: sendWelcomeEmail                                    │
│  (base44/functions/sendWelcomeEmail/entry.ts)                  │
│                                                                 │
│  What happens:                                                 │
│  1. Receives Subscriber entity_id from automation              │
│  2. Checks EmailLog - has welcome been sent to this email?     │
│  3. If not: Sends "Welcome to You Remembered..." email         │
│  4. Creates EmailLog record:                                   │
│     - subscriber_id                                            │
│     - email_type: "welcome"                                    │
│     - sent_at: now                                             │
│     - status: "sent"                                           │
│                                                                 │
│  ✅ EMAIL #1: WELCOME EMAIL SENT IMMEDIATELY                   │
└────────────────────────────────────────────────────────────────┘
                            ↓
                            ↓ [Meanwhile, Stripe redirects user back]
                            ↓
┌────────────────────────────────────────────────────────────────┐
│  USER REDIRECTED TO: /create-account?checkout=success          │
│  Component: CreateAccount.jsx                                  │
└────────────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────────┐
│  STEP 3: CREATE ACCOUNT PAGE CHECKS ELIGIBILITY               │
│  Component: CreateAccount.jsx                                  │
│                                                                 │
│  What happens on page load:                                    │
│  1. Reads email from URL (?email=...)                          │
│  2. Calls checkSignupEligibility function                      │
│     (checks if Subscriber exists with active subscription)     │
│  3. If eligible: Shows account creation form                   │
│  4. If not: Shows "payment not confirmed" error                │
└────────────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────────┐
│  USER FILLS OUT ACCOUNT CREATION FORM                          │
│  - Name (pre-filled from signup)                               │
│  - Email (pre-filled from URL)                                 │
│  - Password (pre-filled if saved)                              │
│  - Confirm password                                            │
└────────────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────────┐
│  STEP 4: USER SUBMITS FORM                                     │
│                                                                 │
│  What happens:                                                 │
│  1. Calls base44.auth.register()                               │
│     - Creates auth user account                                │
│     - Sends OTP code to email                                  │
│  2. Saves draft to localStorage:                               │
│     - name, email, password                                    │
│  3. Shows OTP verification screen                              │
└────────────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────────┐
│  USER CHECKS EMAIL FOR OTP CODE                                │
│  - Receives 6-digit verification code                          │
│  - Enters code on screen                                       │
└────────────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────────┐
│  STEP 5: USER SUBMITS OTP CODE                                 │
│                                                                 │
│  What happens:                                                 │
│  1. Calls base44.auth.verifyOtp()                              │
│     - Verifies code                                            │
│     - Returns access_token                                     │
│  2. Sets token: base44.auth.setToken()                         │
│  3. Calls completePaidSignup function                          │
│  4. Clears localStorage draft                                  │
│  5. Redirects to: /                                            │
└────────────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────────┐
│  STEP 6: completePaidSignup FUNCTION                           │
│  Function: completePaidSignup                                  │
│  (base44/functions/completePaidSignup/entry.ts)                │
│                                                                 │
│  What happens:                                                 │
│  1. Gets current user from auth token                          │
│  2. Finds Subscriber records with user's email                 │
│  3. Finds the "paid" Subscriber (active/trialling/past_due)    │
│  4. Creates NEW user-owned Subscriber record:                  │
│     - email                                                    │
│     - name (from SignupAttempt or user)                        │
│     - stripe_customer_id (copied from webhook record)          │
│     - stripe_subscription_id (copied from webhook record)      │
│     - subscription_status                                      │
│     - created_by_id: USER ID (key difference!)                 │
│  5. Migrates recipients from webhook record to new record      │
│  6. Marks webhook record as "cancelled" (retired)              │
│  7. Deletes SignupAttempt records for this email               │
│                                                                 │
│  Result: User now owns their Subscriber record                 │
└────────────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────────┐
│  USER REDIRECTED TO: / (Home page)                             │
│  Component: Home.jsx                                           │
└────────────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────────┐
│  STEP 7: HOME PAGE LOADS - ROUTING DECISION                    │
│  Component: Home.jsx (useEffect)                               │
│                                                                 │
│  What happens:                                                 │
│  1. ensureSubscriber() runs:                                   │
│     a. Finds user-owned Subscriber record                      │
│        (created by completePaidSignup)                         │
│     b. If no record: calls completePaidSignup again            │
│        (best-effort retry)                                     │
│     c. If still no record: creates one                         │
│                                                                 │
│  2. Checks user role:                                          │
│     - If admin: Show AdminView (never onboarding)              │
│     - If subscriber: Continue to step 3                        │
│                                                                 │
│  3. Checks for recipients:                                     │
│     a. Gets all Recipient records for subscriber_id            │
│     b. If recipients exist: Show SubscriberView (dashboard)    │
│     c. If NO recipients: Redirect to /onboarding               │
│                                                                 │
│  ⚠️ KEY DECISION POINT: Has this user added people yet?        │
└────────────────────────────────────────────────────────────────┘
                            ↓
                            ↓ [If NO recipients...]
                            ↓
┌────────────────────────────────────────────────────────────────┐
│  🎯 ONBOARDING FORM APPEARS                                     │
│  Route: /onboarding                                            │
│  Component: Onboarding.jsx                                     │
│                                                                 │
│  This is the "onboarding form" the client asked about!         │
└────────────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────────┐
│  STEP 8: ONBOARDING FLOW - "ABOUT YOU" STEP                    │
│  Component: AboutYouStep                                       │
│                                                                 │
│  Form fields:                                                  │
│  - First name (What should we call you?)                       │
│  - How did you hear about us? (dropdown)                       │
│                                                                 │
│  What happens on submit:                                       │
│  1. Validates form                                             │
│  2. Calls ensureSubscriber() again (safety check)              │
│  3. Updates Subscriber record:                                 │
│     - first_name                                               │
│     - how_heard                                                │
│  4. Moves to next step: "person"                               │
└────────────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────────┐
│  STEP 9: ONBOARDING FLOW - "ADD PERSON" STEP                   │
│  Component: PersonForm                                         │
│                                                                 │
│  Form fields (comprehensive):                                  │
│  - Name                                                        │
│  - Relationship (dropdown: Partner, Parent, etc.)              │
│  - Gender                                                      │
│  - Age range (or child age bracket if Under 11)                │
│  - Occasions (multi-select with dates + budgets per occasion)  │
│    - Birthday, Christmas, Anniversary, Valentine's Day, Other  │
│    - Each occasion has: day, month, min budget, max budget     │
│  - Interests (multi-select)                                    │
│  - Personality traits (up to 3)                                │
│  - Gift types they love                                        │
│  - Free-text fields:                                           │
│    - Hobbies and interests                                     │
│    - Things you know                                           │
│    - Milestones                                                │
│    - Who they are                                              │
│    - Notes                                                     │
│    - Things to avoid                                           │
│                                                                 │
│  What happens on submit:                                       │
│  1. Validates all fields                                       │
│  2. Calls ensureSubscriber() (gets subscriber_id)              │
│  3. Creates Recipient record:                                  │
│     - subscriber_id (links to Subscriber)                      │
│     - All form data (name, relationship, etc.)                 │
│     - birthday: "--MM-DD" (yearless format)                    │
│     - occasion: primary occasion label                         │
│     - occasion_day, occasion_month: from primary occasion      │
│     - occasions: array of all occasions                        │
│     - age_band: derived from age_range/child_age_bracket       │
│  4. Moves to "added" step                                      │
└────────────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────────┐
│  STEP 10: "PERSON ADDED" CONFIRMATION                          │
│  Component: Added                                              │
│                                                                 │
│  Shows:                                                        │
│  - "Brilliant — [Name] is added."                              │
│  - Option to add another person (up to 10 total)               │
│  - "I'm done for now" button                                   │
│                                                                 │
│  User choices:                                                 │
│  - Add another → Goes back to PersonForm                       │
│  - Done → Moves to "done" step                                 │
└────────────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────────┐
│  STEP 11: "ALL SET!" SCREEN                                    │
│  Component: Done                                               │
│                                                                 │
│  Shows:                                                        │
│  - "You're all set!"                                           │
│  - "Gem now has [N] people to look after."                     │
│  - "You'll hear from her ahead of each occasion..."            │
│  - "Go to my dashboard" button                                 │
│                                                                 │
│  User clicks button:                                           │
│  - Navigates to: /                                             │
│  - Home.jsx runs again                                         │
│  - Now HAS recipients → Shows SubscriberView (dashboard)       │
└────────────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────────┐
│  USER NOW SEES DASHBOARD                                       │
│  Component: SubscriberView                                     │
│                                                                 │
│  Onboarding complete! ✅                                        │
└────────────────────────────────────────────────────────────────┘


┌────────────────────────────────────────────────────────────────┐
│  📧 MEANWHILE: 30 MINUTES AFTER SIGNUP...                      │
└────────────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────────┐
│  📧 SCHEDULED FUNCTION RUNS                                     │
│  Function: sendOnboardingEmail                                 │
│  (base44/functions/sendOnboardingEmail/entry.ts)               │
│  Schedule: Every 10 minutes                                    │
│                                                                 │
│  What happens:                                                 │
│  1. Gets all Subscriber records                                │
│  2. Filters to those created 30+ minutes ago                   │
│  3. Filters to those created <24 hours ago                     │
│  4. For each eligible subscriber:                              │
│     a. Check EmailLog - already sent onboarding_reminder?      │
│     b. If not: Send email                                      │
│     c. Create EmailLog record:                                 │
│        - subscriber_id                                         │
│        - email_type: "onboarding_reminder"                     │
│        - sent_at: now                                          │
│        - status: "sent"                                        │
│                                                                 │
│  ✅ EMAIL #2: ONBOARDING EMAIL SENT                            │
│     Subject: "Now, tell me about the people..."                │
│     Content: "You're all set up — now the fun part."          │
│     CTA: "Add your people →"                                   │
│                                                                 │
│  ⚠️ NOTE: This happens REGARDLESS of whether user              │
│     has completed onboarding form or not                       │
│     (but only sends once ever per subscriber)                  │
└────────────────────────────────────────────────────────────────┘
```

---

## 🔍 Deep Dive: Where Onboarding Form Appears

### The Routing Logic

The onboarding form appears at **route `/onboarding`** and is controlled by **Home.jsx**.

#### When Does User See Onboarding Form?

**Condition**: User must meet ALL of these criteria:

1. ✅ User is authenticated (logged in)
2. ✅ User has a Subscriber record
3. ✅ User is NOT an admin (role !== "admin")
4. ❌ User has ZERO recipients

**Code Location**: `src/pages/Home.jsx` lines 69-76

```javascript
// Home.jsx (simplified)
if (user.role !== "admin" && subscriber?.id) {
  const recipients = await base44.entities.Recipient.filter({ 
    subscriber_id: subscriber.id 
  });
  
  let hasRecipients = recipients.length > 0;
  
  if (!hasRecipients) {
    navigate("/onboarding", { replace: true });  // ← REDIRECT TO ONBOARDING
    return;
  }
}
```

### When Does User Skip Onboarding?

User goes straight to dashboard if:
- They are an admin (always skip onboarding)
- They already have at least 1 Recipient record

### Can User Return to Onboarding Later?

**Yes!** The onboarding page is always accessible at `/onboarding`. But:
- Home.jsx only AUTO-REDIRECTS when they have zero recipients
- If user navigates to `/onboarding` manually after adding people, it will still work
- They can add more people (up to 10 total)

---

## 📧 Deep Dive: Onboarding Email Timing

### How the Email is Triggered

**Function**: `sendOnboardingEmail` (`base44/functions/sendOnboardingEmail/entry.ts`)

**Trigger Type**: Scheduled (NOT automation)

**Schedule**: Runs every 10 minutes

### The Email Logic (Step by Step)

```typescript
// Simplified flow from sendOnboardingEmail/entry.ts

// 1. Calculate time windows
const now = Date.now();
const cutoff30min = now - (30 * 60 * 1000);  // 30 minutes ago
const cutoff24h = now - (24 * 60 * 60 * 1000);  // 24 hours ago

// 2. Get all subscribers
const subscribers = await Subscriber.list("-created_date", 5000);

// 3. For each subscriber
for (const subscriber of subscribers) {
  const createdAt = new Date(subscriber.created_date);
  
  // 4. Check: Was this subscriber created between 30min and 24hr ago?
  if (createdAt > cutoff30min || createdAt < cutoff24h) {
    continue;  // Skip - too recent or too old
  }
  
  // 5. Check EmailLog: Already sent?
  const prior = await EmailLog.filter({
    subscriber_id: subscriber.id,
    email_type: "onboarding_reminder"
  });
  
  if (prior.length > 0) {
    continue;  // Skip - already sent
  }
  
  // 6. Send email
  await sendBrandedEmail(
    subscriber.email,
    "Now, tell me about the people who matter most to you 🎁",
    "Now for the fun part",
    innerHtml
  );
  
  // 7. Log it
  await EmailLog.create({
    subscriber_id: subscriber.id,
    email_type: "onboarding_reminder",
    sent_at: new Date().toISOString(),
    status: "sent"
  });
}
```

### Email Timing Examples

| Subscriber Created | Current Time | Email Sent? | Reason |
|-------------------|--------------|-------------|---------|
| 10:00 AM | 10:25 AM | ❌ No | Too recent (< 30 min) |
| 10:00 AM | 10:35 AM | ✅ Yes | Exactly 35 min ago |
| 10:00 AM | 11:00 AM | ✅ Yes | 1 hour ago (if not sent yet) |
| 10:00 AM | 10:00 AM next day | ✅ Yes | Within 24hr window |
| 10:00 AM | 10:00 AM 2 days later | ❌ No | Too old (> 24 hrs) |

### Why 30 Minutes + 24 Hour Window?

**30 minute delay**:
- Gives user time to complete signup and add first person
- Prevents email from arriving while they're still in account creation
- Better UX - they're not immediately spammed

**24 hour cutoff**:
- Prevents backfilling historic subscribers if function is deployed for first time
- Only targets recent signups
- If email fails to send within first 24 hours, it never sends

### Does Email Know If User Completed Onboarding?

**NO!** The email function:
- ❌ Does NOT check if user has added recipients
- ❌ Does NOT check if user has visited dashboard
- ✅ ONLY checks: 
  - Subscriber created 30min-24hr ago
  - Hasn't sent onboarding_reminder before

**Result**: Email sends 30 minutes after signup regardless of whether user:
- Completed the onboarding form
- Added 0, 1, or 10 people
- Visited dashboard or not

**This is intentional!** The email serves as:
- Reminder for users who abandoned signup
- Nudge for users who created account but didn't add anyone
- Friendly follow-up for users who already added people

---

## 🔄 Multiple Subscriber Records Problem

### Why Multiple Records Can Exist

The same email can have multiple Subscriber records due to the signup flow:

**Timeline**:
1. **Stripe webhook** creates Subscriber (owned by service, not user)
2. **User logs in** → completePaidSignup creates NEW Subscriber (owned by user)
3. Result: 2 Subscriber records for same email

### How completePaidSignup Handles This

```typescript
// Simplified from completePaidSignup/entry.ts

// 1. Find all Subscriber records with this email
const allSubscribers = await Subscriber.filter({ email });

// 2. Find the "paid" one (active subscription)
const paidSubscriber = allSubscribers.find(s => 
  ['active', 'trialling', 'past_due'].includes(s.subscription_status)
);

// 3. Find user-owned one
const ownedSubscriber = allSubscribers.find(s => 
  s.created_by_id === user.id
);

// 4. If user-owned exists: UPDATE it
// 5. If not: CREATE new user-owned record

// 6. Migrate recipients from old records to new one
for (const old of staleRecords) {
  const recipients = await Recipient.filter({ subscriber_id: old.id });
  for (const recipient of recipients) {
    await Recipient.update(recipient.id, { 
      subscriber_id: ownedId  // Point to new record
    });
  }
  
  // Mark old record as cancelled
  await Subscriber.update(old.id, { 
    subscription_status: 'cancelled' 
  });
}
```

### Why This Matters for Emails

**Welcome Email**: Checks ALL subscribers with same email to prevent duplicates

```typescript
// From sendWelcomeEmail/entry.ts
const sameEmail = await Subscriber.filter({ email: subscriber.email });
const relatedIds = sameEmail.map(s => s.id);

// Check if ANY of these IDs have received welcome email
for (const relatedId of relatedIds) {
  const prior = await EmailLog.filter({
    subscriber_id: relatedId,
    email_type: "welcome",
    status: "sent"
  });
  if (prior.length > 0) {
    return "already_sent";  // Don't send again
  }
}
```

**Onboarding Email**: Only checks each Subscriber individually (not cross-email)

Result: If webhook creates Subscriber#1 and user creates Subscriber#2 for same email:
- Welcome: Sent only once (checks both records)
- Onboarding: Could theoretically send twice (checks each separately)

**But in practice**: completePaidSignup runs immediately after user logs in, so the "owned" record is created before the 30-minute window passes, and onboarding email only gets sent to the owned record.

---

## 🎯 Key Timestamps & Records

### Subscriber Record Created

**When**: Three possible moments:

1. **During Stripe webhook** (immediately after payment):
   ```json
   {
     "id": "sub_abc123",
     "email": "user@example.com",
     "name": "John Doe",
     "stripe_customer_id": "cus_xyz",
     "stripe_subscription_id": "sub_xyz",
     "subscription_status": "active",
     "subscribed_since": "2026-09-09",
     "created_by_id": null,  // ← Service-owned
     "created_date": "2026-09-09T10:00:00Z"
   }
   ```

2. **During completePaidSignup** (after user logs in):
   ```json
   {
     "id": "sub_def456",
     "email": "user@example.com",
     "name": "John Doe",
     "stripe_customer_id": "cus_xyz",
     "stripe_subscription_id": "sub_xyz",
     "subscription_status": "active",
     "subscribed_since": "2026-09-09",
     "created_by_id": "usr_789",  // ← USER-OWNED!
     "created_date": "2026-09-09T10:05:00Z"  // 5 min after webhook
   }
   ```

3. **Fallback in Home.jsx** (if both above failed):
   ```json
   {
     "id": "sub_ghi789",
     "email": "user@example.com",
     "name": "John Doe",
     "subscription_status": "trialling",
     "created_by_id": "usr_789",  // ← USER-OWNED
     "created_date": "2026-09-09T10:10:00Z"  // When Home.jsx runs
   }
   ```

### SignupAttempt Record

**Created**: During stripeCheckout (before payment)
**Deleted**: During completePaidSignup (after successful signup)

```json
{
  "id": "attempt_123",
  "email": "user@example.com",
  "name": "John Doe",
  "created_at": "2026-09-09T09:55:00Z"
}
```

**Purpose**: Temporarily stores name/email before payment completes

**Lifetime**: ~5-10 minutes (from checkout start to account creation)

### EmailLog Records

**Created**: When emails are sent

**Welcome email**:
```json
{
  "subscriber_id": "sub_abc123",
  "email_type": "welcome",
  "sent_at": "2026-09-09T10:00:30Z",  // 30 seconds after webhook
  "status": "sent"
}
```

**Onboarding email**:
```json
{
  "subscriber_id": "sub_def456",  // User-owned record
  "email_type": "onboarding_reminder",
  "sent_at": "2026-09-09T10:35:00Z",  // 30 min after user-owned record created
  "status": "sent"
}
```

---

## 🚨 Edge Cases & Gotchas

### Edge Case 1: User Abandons After Payment

**Scenario**:
1. User pays via Stripe → Webhook creates Subscriber
2. Welcome email sent immediately
3. User never creates account (closes browser)

**Result**:
- Subscriber record exists (service-owned)
- Welcome email sent ✅
- Onboarding email will be sent 30 min later ✅
- But user never sees onboarding form (no account)

**Impact**: User receives emails but has no way to log in
**Fix**: They can return and create account using same email later

### Edge Case 2: Webhook Arrives Late

**Scenario**:
1. User pays via Stripe
2. Redirected to /create-account
3. Creates account BEFORE webhook arrives
4. No Subscriber record exists yet

**Result**:
- completePaidSignup fails to find paid Subscriber
- Home.jsx creates fallback Subscriber (trialling status)
- User can still use app, but subscription status wrong

**Fix**: Next webhook update will correct the status

### Edge Case 3: Multiple Browser Tabs

**Scenario**:
1. User completes payment in Tab 1
2. Redirected to /create-account in Tab 1
3. Opens another tab, logs in to existing account

**Result**:
- Multiple completePaidSignup calls (one per tab)
- Function is idempotent (safe to call multiple times)
- Only one user-owned Subscriber created

### Edge Case 4: Email Already Used

**Scenario**:
1. User signs up with email@example.com
2. Pays, creates account
3. Subscription lapses (cancelled)
4. User signs up again with SAME email

**Result**:
- New payment creates new Stripe customer
- Webhook updates existing Subscriber (if not cancelled)
- Or creates new Subscriber if old one was cancelled
- Welcome email: Checks all records with email → doesn't send duplicate
- Onboarding email: Checks each Subscriber separately

**Potential Issue**: Could send 2nd onboarding email if old record wasn't properly marked

---

## 📋 Summary Checklist: What Happens When

### Immediately (< 1 second)
- ✅ Stripe webhook receives payment confirmation
- ✅ Subscriber record created (service-owned)
- ✅ Base44 automation triggers sendWelcomeEmail
- ✅ Welcome email sent

### Within 5 minutes
- ✅ User redirected to /create-account
- ✅ User creates account (register + verify OTP)
- ✅ completePaidSignup creates user-owned Subscriber
- ✅ User redirected to /
- ✅ Home.jsx checks recipients
- ✅ If no recipients: Redirect to /onboarding
- ✅ **Onboarding form appears**

### At 30 minutes
- ✅ sendOnboardingEmail scheduled function runs
- ✅ Finds user-owned Subscriber (created ~30 min ago)
- ✅ **Onboarding email sent**

### Ongoing
- ✅ User can add up to 10 recipients via onboarding form
- ✅ Once recipients exist, dashboard shows instead of onboarding
- ✅ User can return to /onboarding manually anytime

---

## 🎬 Complete Timeline Example

**Real-time walkthrough of user "Sarah" signing up**:

```
10:00:00 - Sarah fills out signup form (name, email, password)
10:00:05 - Clicks "Continue to payment"
10:00:06 - stripeCheckout function creates SignupAttempt
10:00:07 - Redirected to Stripe checkout page
10:00:45 - Sarah enters card details on Stripe
10:01:00 - Payment succeeds
10:01:01 - Stripe sends webhook to stripeWebhook function
10:01:02 - stripeWebhook creates Subscriber (service-owned)
10:01:03 - Base44 automation triggers sendWelcomeEmail
10:01:04 - sendWelcomeEmail checks EmailLog (no prior welcome)
10:01:05 - 📧 Welcome email sent to Sarah
10:01:06 - EmailLog created (email_type: "welcome")
10:01:07 - Stripe redirects Sarah to /create-account?email=sarah@example.com
10:01:10 - CreateAccount page loads
10:01:11 - Calls checkSignupEligibility → Finds paid Subscriber → eligible=true
10:01:12 - Sarah sees account creation form
10:01:45 - Sarah fills out name/email/password/confirm
10:01:50 - Clicks "Create account"
10:01:51 - base44.auth.register() called
10:01:52 - OTP code sent to Sarah's email
10:01:53 - OTP screen appears
10:02:00 - Sarah checks email, gets 6-digit code
10:02:10 - Sarah enters OTP code
10:02:11 - Clicks "Finish account"
10:02:12 - base44.auth.verifyOtp() called → Returns access_token
10:02:13 - completePaidSignup function called
10:02:14 - completePaidSignup finds service-owned Subscriber
10:02:15 - Creates NEW user-owned Subscriber (created_by_id: sarah_user_id)
10:02:16 - Migrates any recipients from old to new
10:02:17 - Marks old Subscriber as "cancelled"
10:02:18 - Deletes SignupAttempt
10:02:19 - Redirects to /
10:02:20 - Home.jsx loads
10:02:21 - ensureSubscriber() finds user-owned Subscriber
10:02:22 - Checks recipients → finds 0 recipients
10:02:23 - 🎯 Redirects to /onboarding
10:02:24 - Onboarding.jsx loads
10:02:25 - 🎯 ONBOARDING FORM APPEARS
10:02:30 - Sarah sees "Tell me a little about you" (AboutYouStep)
10:03:00 - Sarah enters first name and "how heard"
10:03:05 - Clicks "Continue"
10:03:06 - Updates Subscriber with first_name and how_heard
10:03:07 - Shows PersonForm (add first person)
10:05:00 - Sarah fills out details for her Mom
10:05:30 - Clicks "Save"
10:05:31 - Creates Recipient record (subscriber_id = sarah's Subscriber)
10:05:32 - Shows "Brilliant — Mom is added" screen
10:05:40 - Sarah clicks "I'm done for now"
10:05:41 - Shows "You're all set!" screen
10:05:45 - Sarah clicks "Go to my dashboard"
10:05:46 - Navigates to /
10:05:47 - Home.jsx loads again
10:05:48 - Checks recipients → finds 1 recipient (Mom)
10:05:49 - Shows SubscriberView (dashboard) ✅

[Meanwhile, scheduled function running...]

10:30:00 - sendOnboardingEmail function runs (scheduled every 10 min)
10:30:01 - Gets all Subscribers
10:30:02 - Filters to those created between 30min-24hr ago
10:30:03 - Finds Sarah's user-owned Subscriber (created at 10:02:15)
10:30:04 - Checks EmailLog for onboarding_reminder → none found
10:30:05 - 📧 Sends onboarding email to Sarah
10:30:06 - Creates EmailLog (email_type: "onboarding_reminder")
10:30:07 - Sarah receives email: "Now, tell me about the people..."

[But Sarah already completed onboarding at 10:05!]
[Email still sent - system doesn't check if recipients exist]
```

---

This is the complete flow from signup through onboarding form appearance and email delivery!
