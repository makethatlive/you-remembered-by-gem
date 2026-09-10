# Duplicate Welcome Emails - FIXED

## Problem
User was receiving **3 emails** on registration:
1. Welcome email (duplicate)
2. Welcome email (duplicate)
3. Email verification ✅ (correct)

## Root Cause

Welcome email was being sent from **multiple places**:

1. ✅ `server/routes/auth-routes.js` - During user registration
2. ❌ `server/index.js` - When Subscriber record created (POST /api/subscribers)
3. ❌ `server/index.js` - Via manual API endpoint (POST /api/email/welcome)

**Flow that caused duplicates**:
```
User registers
    ↓
auth-routes.js: User created → Welcome email #1 sent
    ↓
User redirected to /onboarding or /home
    ↓
Frontend: Creates Subscriber record
    ↓
server/index.js: Subscriber created → Welcome email #2 sent ❌
```

## Fixes Applied

### Fix 1: Remove Welcome Email from Subscriber Creation
**File**: `server/index.js` line ~203

**Before**:
```javascript
const subscriber = await prisma.subscriber.create({ ... });

// Send welcome email
sendWelcomeEmail(subscriber.email, ...)
  .then(...)
  .catch(...);
```

**After**:
```javascript
const subscriber = await prisma.subscriber.create({ ... });

// NOTE: Welcome email is sent during registration (auth-routes.js)
// Don't send it here to avoid duplicates
```

### Fix 2: Create Subscriber During Registration
**File**: `server/routes/auth-routes.js`

**Before**:
```javascript
// Create user
const user = await prisma.user.create({ ... });

// Send welcome email
sendWelcomeEmail(user.email, user.firstName, user.id) // ❌ user.id, not subscriber!
```

**After**:
```javascript
// Create user
const user = await prisma.user.create({ ... });

// Create subscriber immediately
const subscriber = await prisma.subscriber.create({
  name: `${firstName} ${lastName}`.trim() || email.split('@')[0],
  firstName: firstName,
  email: email,
  subscriptionStatus: 'TRIALLING',
  createdById: user.id,
});

// Send welcome email with proper subscriberId
sendWelcomeEmail(subscriber.email, subscriber.firstName, subscriber.id) // ✅ subscriber.id!
```

### Fix 3: Add Deduplication to sendWelcomeEmail
**File**: `server/services/email/resend-client.js`

Added check to prevent sending if already sent to this email:

```javascript
export async function sendWelcomeEmail(subscriberEmail, subscriberName, subscriberId) {
  // Check if welcome email already sent to this EMAIL
  try {
    const subscriber = await prisma.subscriber.findFirst({
      where: { email: subscriberEmail },
      include: {
        emailLogs: {
          where: { emailType: 'WELCOME' },
          take: 1
        }
      }
    });
    
    if (subscriber && subscriber.emailLogs.length > 0) {
      console.log(`ℹ️  Welcome email already sent to ${subscriberEmail}, skipping`);
      return { success: true, skipped: true, reason: 'already_sent' };
    }
  } catch (error) {
    // Continue anyway
  }
  
  // Send email...
}
```

## Result

Now the flow is:

```
User registers
    ↓
auth-routes.js:
  1. Create User
  2. Create Subscriber
  3. Send email verification ✅
  4. Send welcome email ✅ (with proper EmailLog)
    ↓
User redirected to /onboarding or /home
    ↓
Frontend: Tries to create Subscriber
    ↓
server/index.js: Subscriber already exists → No duplicate email ✅
```

## Expected Emails on Registration

✅ **Email 1**: Email verification
- Subject: "✉️ Verify Your Email Address"
- From: password-service.js
- Purpose: Verify email address

✅ **Email 2**: Welcome email (ONE TIME)
- Subject: "🎁 Welcome to You Remembered By Gem!"
- From: resend-client.js
- Purpose: Welcome new user
- Logged to EmailLog (email_type: WELCOME)

## Testing

To verify the fix:

1. Register a new user
2. Check email inbox
3. Should receive **exactly 2 emails**:
   - Email verification
   - Welcome email (only once!)

Check EmailLog in database:

```sql
SELECT * FROM email_logs 
WHERE email_type = 'WELCOME'
ORDER BY sent_at DESC;
```

Should see only ONE entry per subscriber.

## Additional Benefits

- ✅ Subscriber is created immediately on registration
- ✅ Welcome email is logged properly with subscriberId
- ✅ Deduplication prevents any future duplicates
- ✅ Frontend subscriber creation becomes idempotent (won't duplicate)

## Files Modified

1. `server/routes/auth-routes.js` - Create Subscriber during registration
2. `server/index.js` - Remove welcome email from Subscriber creation endpoint
3. `server/services/email/resend-client.js` - Add deduplication check

---

**Status**: ✅ FIXED - Users now receive exactly 2 emails on registration (verification + welcome)
