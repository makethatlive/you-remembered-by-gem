# Email Implementation Analysis & Required Changes

## Current State Analysis

### Existing Email Functions

1. **sendWelcomeEmail** (`base44/functions/sendWelcomeEmail/entry.ts`)
   - ✅ Triggered on Subscriber creation (automation)
   - ✅ Sends immediately on sign-up
   - ✅ Deduplication via EmailLog (email_type: "welcome")
   - ✅ Content matches client requirements closely
   - **Status**: Needs minor content updates

2. **sendOnboardingEmail** (`base44/functions/sendOnboardingEmail/entry.ts`)
   - ✅ Scheduled every 10 minutes
   - ✅ Sends 30 minutes after signup
   - ✅ Only sends within 24-hour window
   - ✅ Deduplication via EmailLog (email_type: "onboarding_reminder")
   - **Status**: This is the "Onboarding Form" email - content needs update to match client spec

3. **dailyBirthdayCheck** (`base44/functions/dailyBirthdayCheck/entry.ts`)
   - ✅ Handles 6-week reminder (42 days before occasion)
   - ✅ Handles post-occasion follow-up (2 days after)
   - ✅ Deduplication by recipient + email_type + occasion_year
   - **Status**: Needs updates for new email content

4. **sendApprovalEmail** (`base44/functions/sendApprovalEmail/entry.ts`)
   - ✅ Sends gift ideas email after Gem approves a list
   - ✅ Handles different list types (curated/last_minute/experience_digital)
   - ✅ Deduplication via EmailLog (gift_list_id + status: "sent")
   - **Status**: This is the "Gift Ideas Email" - needs content updates

### EmailLog Types in Database

Current enum values:
- "welcome"
- "onboarding_reminder"
- "6_week_reminder"
- "30_day" (gift ideas - curated)
- "14_day" (gift ideas - last minute)
- "7_day" (gift ideas - experience/digital)
- "post_occasion"
- "post_birthday_feedback"

**MISSING**: "2_week_reminder" - needs to be added

---

## Client Requirements vs. Current Implementation

### Email Sequence Comparison

| # | Client Email Name | Timing | Current Implementation | Status |
|---|-------------------|---------|----------------------|---------|
| 1 | Welcome Email | Immediate on sign-up | ✅ sendWelcomeEmail | Needs content update |
| 2 | Onboarding Form | With welcome email | ✅ sendOnboardingEmail (30 min after) | Needs content update |
| 3 | 6-Week Reminder | 6 weeks before | ✅ dailyBirthdayCheck (42 days) | Needs content update |
| 4 | Gift Ideas Email | 4 weeks before | ✅ sendApprovalEmail (manual trigger) | Needs content update |
| 5 | 2-Week Reminder | 2 weeks before | ❌ MISSING | **MUST CREATE** |
| 6 | Post-Occasion Follow Up | 2-3 days after | ✅ dailyBirthdayCheck (2 days) | Needs content update |

---

## Required Changes

### 1. Update EmailLog Entity
**File**: `base44/entities/EmailLog.jsonc`

Add "2_week_reminder" to the email_type enum:

```jsonc
"email_type": {
  "type": "string",
  "enum": [
    "welcome",
    "onboarding_reminder",
    "6_week_reminder",
    "2_week_reminder",  // ← ADD THIS
    "30_day",
    "14_day",
    "7_day",
    "post_occasion",
    "post_birthday_feedback"
  ],
  "description": "Email type"
}
```

### 2. Update sendWelcomeEmail Content
**File**: `base44/functions/sendWelcomeEmail/entry.ts`

**Changes needed**:
- Update subject line to match exactly: "Welcome to You Remembered, by Gem — let's get started ✨"
- Update body content to match client spec (already very close)
- Update note section: "Profile updates, budgets, and adding new people are all quick to do any time in your account — just log in and edit directly. But if anything isn't working, or something doesn't feel right, email me directly and I'll come straight back to you."

### 3. Update sendOnboardingEmail (Onboarding Form Email)
**File**: `base44/functions/sendOnboardingEmail/entry.ts`

**Issue**: Current implementation sends 30 minutes after signup. Client spec says "Sent with welcome email"

**Options**:
A. Keep current 30-minute delay (reasonable onboarding pattern)
B. Integrate into sendWelcomeEmail as a single email
C. Change timing to immediate (like welcome)

**Recommendation**: Keep 30-minute delay - it's a better UX pattern, gives user time to explore before the "add people" nudge.

**Content changes needed**: Match client's "Onboarding Form" copy exactly

### 4. Update dailyBirthdayCheck - 6-Week Reminder
**File**: `base44/functions/dailyBirthdayCheck/entry.ts`

**Changes needed**:
- Update content to match client spec exactly
- Current implementation already correct at 42 days (6 weeks)
- Update the profile summary table to match client format
- Update CTA button text: "Update [Name]'s profile →"

### 5. **CREATE NEW**: 2-Week Reminder Function
**New directory**: `base44/functions/send2WeekReminder/`
**New file**: `base44/functions/send2WeekReminder/entry.ts`

**Purpose**: Send reminder 2 weeks (14 days) before occasion if gift ideas email wasn't opened/actioned

**Logic**:
- Run daily as part of dailyBirthdayCheck OR as separate scheduled function
- Check if `daysUntilNext === 14`
- Check EmailLog for recipient + current occasion_year:
  - Must have sent "30_day" (gift ideas email)
  - Must NOT have sent "2_week_reminder" for this year
- Send only if conditions met
- Log as email_type: "2_week_reminder"

**Note**: Client spec says "only if the Gift Ideas email hasn't been opened/actioned" - but we don't currently track email opens. We can either:
- Always send (simpler, safer)
- Track opens via Resend webhooks (complex)
- Skip this check (recommended)

### 6. Update dailyBirthdayCheck - Post-Occasion Follow-Up
**File**: `base44/functions/dailyBirthdayCheck/entry.ts`

**Changes needed**:
- Update content to match client spec
- Current timing is correct (2 days after)
- Update feedback mechanism: Client wants "in-app link" not email reply
- Need to create feedback page in app
- Update CTA: "Share how it went →" linking to app feedback form

### 7. Update sendApprovalEmail (Gift Ideas Email)
**File**: `base44/functions/sendApprovalEmail/entry.ts`

**Changes needed**:
- Update content to match client spec exactly
- Update subject line format
- Update product presentation format
- Add personalized "why this gift" descriptions (already exists as `why_this_gift`)
- Update "Not quite right?" section
- Update contact email to `concierge@yourememberedbygem.com`

---

## Implementation Strategy

### Phase 1: Database Schema (No Code Deploy Required)
1. ✅ Update EmailLog.jsonc enum to include "2_week_reminder"

### Phase 2: Content Updates (Existing Functions)
2. ✅ Update sendWelcomeEmail content
3. ✅ Update sendOnboardingEmail content (keep 30-min timing)
4. ✅ Update dailyBirthdayCheck - 6-week reminder content
5. ✅ Update dailyBirthdayCheck - post-occasion content
6. ✅ Update sendApprovalEmail content

### Phase 3: New Function
7. ✅ Create send2WeekReminder function
8. ✅ Add to dailyBirthdayCheck OR create separate scheduled automation

### Phase 4: Frontend (If Needed)
9. Create in-app feedback form for post-occasion follow-up
10. Create shareable link page for referrals

---

## Key Decisions to Confirm

### 1. Onboarding Email Timing
**Client says**: "Sent with welcome email"
**Current**: 30 minutes after welcome
**Recommendation**: Keep 30-minute delay - better UX
**Decision needed**: Confirm with client?

### 2. 2-Week Reminder Trigger
**Client says**: "only if the Gift Ideas email hasn't been opened/actioned"
**Current capability**: No email open tracking
**Recommendation**: Send to everyone (simpler, catches all missed emails)
**Alternative**: Implement Resend webhook tracking (complex)
**Decision needed**: Always send, or implement tracking?

### 3. Post-Occasion Feedback
**Client says**: "in-app link" for feedback
**Current**: Email reply
**Requirement**: Build feedback form page in app
**Decision needed**: Page design/location?

### 4. 2-Week Reminder Integration
**Option A**: Add to dailyBirthdayCheck (alongside 6-week & post-occasion)
**Option B**: Separate scheduled function
**Recommendation**: Add to dailyBirthdayCheck (consolidates occasion logic)

---

## Testing Checklist

After implementation:
- [ ] Welcome email sends immediately on new subscriber creation
- [ ] Onboarding email sends 30 minutes after signup (only once)
- [ ] 6-week reminder sends exactly 42 days before occasion
- [ ] 2-week reminder sends exactly 14 days before occasion
- [ ] Gift ideas email sends when admin approves list
- [ ] Post-occasion email sends exactly 2 days after occasion
- [ ] All emails deduplicate correctly (no duplicates per year)
- [ ] All content matches client spec exactly
- [ ] All CTAs link to correct destinations
- [ ] Email styling is consistent across all emails

---

## Files to Modify

1. ✅ `base44/entities/EmailLog.jsonc` - Add enum value
2. ✅ `base44/functions/sendWelcomeEmail/entry.ts` - Content updates
3. ✅ `base44/functions/sendOnboardingEmail/entry.ts` - Content updates
4. ✅ `base44/functions/dailyBirthdayCheck/entry.ts` - Content updates for 6-week & post-occasion
5. ✅ `base44/functions/sendApprovalEmail/entry.ts` - Content updates
6. ✅ **NEW** `base44/functions/send2WeekReminder/entry.ts` - New function

---

## Notes

- All emails use branded template with Deep Teal (#164E63) header and Gold (#C9A96E) divider
- All emails use Resend API with sender: "You Remembered, by Gem <concierge@yourememberedbygem.com>"
- All user-controlled text is escaped via `escapeHtml()` function
- Deduplication is critical - uses EmailLog with email_type + occasion_year
- All scheduled functions require admin auth
- Automation-triggered functions (welcome) accept automation envelope OR admin auth
