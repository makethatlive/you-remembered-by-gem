# Onboarding Form - Quick Reference

## When Does the Onboarding Form Appear?

### Simple Answer
The onboarding form appears at `/onboarding` when:
- ✅ User is logged in
- ✅ User is NOT an admin
- ❌ User has ZERO recipients added

### Where in the Code
**File**: `src/pages/Home.jsx` (lines 69-76)

```javascript
if (user.role !== "admin" && subscriber?.id) {
  const recipients = await base44.entities.Recipient.filter({ 
    subscriber_id: subscriber.id 
  });
  
  if (recipients.length === 0) {
    navigate("/onboarding", { replace: true });  // ← THIS IS WHERE!
  }
}
```

---

## User Journey to Onboarding Form

```
Sign up → Pay → Create account → Verify email → Redirected to /
                                                          ↓
                                             Home.jsx checks recipients
                                                          ↓
                                                   Zero recipients?
                                                          ↓
                                            Redirect to /onboarding
                                                          ↓
                                            🎯 FORM APPEARS
```

---

## What's in the Onboarding Form?

### Step 1: About You
**Component**: `AboutYouStep.jsx`

Fields:
- First name ("What should we call you?")
- How did you hear about us? (dropdown)

**Saves to**: Subscriber record (first_name, how_heard)

### Step 2: Add a Person
**Component**: `PersonForm.jsx`

Fields (comprehensive!):
- **Basic Info**:
  - Name
  - Relationship (Partner, Parent, Sibling, Friend, etc.)
  - Gender
  - Age range (or child age bracket if Under 11)

- **Occasions** (can add multiple):
  - Birthday, Christmas, Anniversary, Valentine's Day, Other
  - Each occasion has:
    - Day (1-31)
    - Month (1-12)
    - Min budget (£)
    - Max budget (£)

- **Their Personality**:
  - Interests (multi-select from predefined list)
  - Personality traits (select up to 3)
  - Gift types they love (multi-select)

- **Free-Text Details**:
  - Hobbies and interests
  - Things you know about them
  - Any upcoming milestones
  - Who they are (description)
  - Things to avoid (gifts/categories)
  - Notes

**Saves to**: Recipient record (linked to Subscriber via subscriber_id)

### Step 3: Person Added
Shows confirmation and options:
- Add another person (up to 10 total)
- I'm done for now

### Step 4: All Set!
Final confirmation:
- "You're all set!"
- "Gem now has [N] people to look after"
- Button: "Go to my dashboard"

---

## What Happens After Onboarding?

1. User clicks "Go to my dashboard"
2. Navigates back to `/`
3. Home.jsx checks recipients again
4. NOW finds recipients → Shows dashboard (SubscriberView)
5. Never redirects to onboarding again (unless they delete all recipients)

---

## Onboarding Email Timeline

### Email vs. Form - NOT THE SAME THING!

| Thing | When | Purpose |
|-------|------|---------|
| **Onboarding Form** | Immediately after login (if no recipients) | Collect recipient data |
| **Onboarding Email** | 30 minutes after Subscriber created | Nudge to add people |

### The Email Doesn't Know About the Form

**Important**: The onboarding email sends 30 minutes after signup REGARDLESS of:
- ❌ Whether user completed the form
- ❌ Whether user added any recipients
- ❌ Whether user visited the dashboard

**Why?** The email function only checks:
- ✅ Subscriber created 30+ minutes ago
- ✅ Subscriber created <24 hours ago  
- ✅ Never sent onboarding_reminder before

**Result**: User might receive the "add your people" email even after they've already added people!

---

## Can User Skip Onboarding?

### Auto-Skip Scenarios
- User is an admin → Never sees onboarding
- User already has recipients → Goes to dashboard

### Manual Access
- User can navigate to `/onboarding` anytime
- Form still works even after adding people
- Can add more people (up to 10 total)

---

## Database Records Created

### During Onboarding

1. **Subscriber record** (updated in Step 1):
   ```json
   {
     "first_name": "Sarah",
     "how_heard": "Instagram"
   }
   ```

2. **Recipient record** (created in Step 2):
   ```json
   {
     "subscriber_id": "sub_abc123",
     "name": "Mom",
     "relationship": "Parent",
     "birthday": "--02-15",
     "occasion": "Birthday",
     "occasion_day": 15,
     "occasion_month": 2,
     "occasions": [
       {
         "type": "Birthday",
         "day": 15,
         "month": 2,
         "budget_min": 50,
         "budget_max": 100
       },
       {
         "type": "Christmas",
         "day": 25,
         "month": 12,
         "budget_min": 80,
         "budget_max": 150
       }
     ],
     "gender": "Female",
     "age_range": "56-65",
     "age_band": "51-70",
     "budget_min": 50,
     "budget_max": 100,
     "interests": ["Cooking & food", "Reading", "Wellness"],
     "personality": ["Thoughtful", "Creative", "Practical"],
     "gift_types": ["Experiences", "Self-care items"],
     "hobbies_and_interests": "Loves cooking Italian food...",
     "things_you_know": "Just moved into a new flat...",
     "who_they_are": "Creative homebody who loves beautiful things"
   }
   ```

---

## Testing Onboarding Flow

### How to Force Onboarding Form to Appear

1. **New signup**: Complete payment → create account → will auto-redirect
2. **Existing user**: Delete all their Recipient records → visit `/` → will auto-redirect
3. **Manual**: Navigate directly to `/onboarding` (works anytime)

### What to Verify

- [ ] Form appears after login (if no recipients)
- [ ] AboutYouStep shows first
- [ ] First name saves to Subscriber
- [ ] PersonForm shows after about step
- [ ] Can add all recipient details
- [ ] Recipient saves to database with correct subscriber_id
- [ ] "Person added" screen shows
- [ ] Can add multiple people
- [ ] "Done" screen shows final count
- [ ] Clicking "Go to dashboard" shows SubscriberView
- [ ] Onboarding email sends 30 min after Subscriber creation

---

## Common Issues & Solutions

### Issue: User sees blank screen instead of onboarding
**Cause**: Subscriber record doesn't exist
**Solution**: Home.jsx has fallback - it creates one. Check ensureSubscriber() logic.

### Issue: User loops back to onboarding after adding people
**Cause**: Recipient not properly linked to Subscriber
**Solution**: Check subscriber_id on Recipient record matches Subscriber.id

### Issue: Onboarding email never sends
**Cause**: 
- Subscriber.created_date too old (>24 hours)
- EmailLog already has onboarding_reminder record
- sendOnboardingEmail function not running
**Solution**: Check EmailLog, verify schedule, check Subscriber.created_date

### Issue: User receives onboarding email twice
**Cause**: Multiple Subscriber records with different IDs
**Solution**: completePaidSignup should consolidate. Check for cancelled records.

### Issue: Form data not saving
**Cause**: 
- Network error
- Validation error
- Subscriber record doesn't have proper created_by_id
**Solution**: Check browser console for errors, verify auth token

---

## Quick Code Locations

| Component | Purpose | File |
|-----------|---------|------|
| Routing logic | Decides when to show onboarding | `src/pages/Home.jsx` |
| Onboarding page | Main onboarding container | `src/pages/Onboarding.jsx` |
| About step | First name + how heard | `src/components/onboarding/AboutYouStep.jsx` |
| Person form | Add recipient details | `src/components/onboarding/PersonForm.jsx` |
| Welcome email | Sent immediately | `base44/functions/sendWelcomeEmail/entry.ts` |
| Onboarding email | Sent after 30 min | `base44/functions/sendOnboardingEmail/entry.ts` |

---

## Summary Diagram

```
User Journey:
Sign up → Pay → Account → Login → Home.jsx → Recipients? 
                                        ↓               ↓
                                       No              Yes
                                        ↓               ↓
                                   /onboarding      Dashboard
                                        ↓
                              About You (Step 1)
                                        ↓
                             Add Person (Step 2)
                                        ↓
                             Person Added (Step 3)
                                        ↓
                               All Set! (Step 4)
                                        ↓
                                   Dashboard


Email Timeline:
T+0s:   Welcome email sent (immediate)
T+30m:  Onboarding email sent (scheduled)
        (regardless of whether form completed)
```

---

That's everything about when, where, and how the onboarding form appears!
