# User vs Subscriber: Understanding the Relationship

## Overview

Your application has **two separate but related entities**: **User** and **Subscriber**. This is a common pattern in subscription-based applications where authentication/authorization is separated from business logic.

## The Two Entities

### 1. User (Authentication Layer)
**Purpose**: Handles login, authentication, and authorization (role-based access control)

**Location in Schema**: `model User`

**Fields**:
```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  role      Role     @default(USER)  // ADMIN or USER
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  subscribers Subscriber[]  // A User can create Subscribers
  recipients  Recipient[]   // A User can create Recipients
}
```

**Role**: 
- `ADMIN` - Full access to "Gem's View" (admin dashboard, approvals, products, retailers, etc.)
- `USER` - Access to subscriber-facing app only (My People, Gift Lists, Account)

**Key Points**:
- ✅ Handles **login and authentication**
- ✅ Determines **what the person can see/do** (admin vs subscriber view)
- ✅ Created via **invitation system** (email invite → accept → User account created)
- ✅ One User can "own" multiple Subscribers (through `createdBy` relationship)

---

### 2. Subscriber (Business Layer)
**Purpose**: Represents a paying customer with subscription billing information

**Location in Schema**: `model Subscriber`

**Fields**:
```prisma
model Subscriber {
  id                    String   @id @default(cuid())
  name                  String
  firstName             String?
  email                 String   @unique
  howHeard              String?
  
  // Stripe billing
  stripeCustomerId      String?  @unique
  stripeSubscriptionId  String?  @unique
  subscriptionStatus    SubscriptionStatus  // ACTIVE, CANCELLED, PAST_DUE, TRIALLING
  subscribedSince       DateTime?
  
  // Who created this subscriber
  createdById           String
  createdBy             User     @relation(fields: [createdById], references: [id])
  
  // What they own
  recipients  Recipient[]   // People they buy gifts for
  giftLists   GiftList[]    // Generated gift lists
  emailLogs   EmailLog[]    // Email history
}
```

**Key Points**:
- ✅ Handles **subscription billing** (Stripe integration)
- ✅ Tracks **subscription status** (active, cancelled, trialling, past_due)
- ✅ Owns **Recipients** (the people they buy gifts for)
- ✅ Owns **Gift Lists** (the AI-generated suggestions)
- ✅ **Must be linked to a User** via `createdById`

---

## The Relationship

```
┌─────────────────────┐
│       User          │  Authentication/Authorization
│  (Login Account)    │  
│                     │  
│  • email            │  
│  • role: ADMIN/USER │  
└──────────┬──────────┘
           │
           │ createdBy (1:Many)
           │
           ▼
┌─────────────────────┐
│    Subscriber       │  Business/Subscription
│  (Paying Customer)  │  
│                     │  
│  • email            │  
│  • stripeCustomerId │  
│  • status           │  
│  • createdById ─────┘  
└──────────┬──────────┘
           │
           │ owns (1:Many)
           │
           ▼
┌─────────────────────┐
│     Recipient       │  People they buy gifts for
│    (Their People)   │  
│                     │  
│  • name             │  
│  • birthday         │  
│  • interests        │  
└─────────────────────┘
```

## Real-World Examples

### Example 1: Regular Subscriber
```
User (pph2shoaib@gmail.com, role: USER)
  └─> Subscriber (pph2shoaib@gmail.com, status: ACTIVE, $19.99/month)
        └─> Recipient: Sarah (Wife, Birthday: Aug 18)
        └─> Recipient: Tom (Friend, Birthday: Dec 25)
```

**Flow**:
1. Person receives email invitation with role: USER
2. Accepts invite → **User account created** with role=USER
3. During onboarding → **Subscriber record created** linked to this User
4. Subscriber adds recipients → **Recipient records created** linked to Subscriber

### Example 2: Admin (Gem)
```
User (gem@yourememberedbygem.com, role: ADMIN)
  └─> Subscriber (gem@yourememberedbygem.com, status: ACTIVE)
        └─> Recipient: Test Person
```

**Flow**:
1. Admin invited with role: ADMIN
2. **User account** with role=ADMIN → sees admin dashboard
3. Can also have a **Subscriber account** (to test the subscriber experience)
4. But mainly uses the admin interface to manage all subscribers

### Example 3: Multiple Subscribers (Edge Case)
```
User (agency@example.com, role: ADMIN)
  ├─> Subscriber (client1@example.com, created by agency)
  ├─> Subscriber (client2@example.com, created by agency)
  └─> Subscriber (client3@example.com, created by agency)
```

**Flow**:
- One admin User can create/manage multiple Subscriber accounts
- Useful for testing or bulk import scenarios

---

## Why This Separation?

### From the SRS Document (Section 3.3.1):

> **3.3.1 Subscriber**
> Represents a paying member of the gifting service.
>
> Fields:
> - `subscription_status` — Enum: trialling, active, cancelled, past_due. Drives the dashboard's "Active Subscribers" count.
> - `linked user account` — Reference: Created/linked via the invite flow; determines whether the person can log in and see the subscriber app.
> - `recipients` — Relationship: One-to-many to Recipient.

### From Section 3.3.8:

> **3.3.8 User (Base44-managed)**
> 
> Fields:
> - `email` — Login identifier
> - `role` — admin (full Gem's View access) or user (subscriber app only)
> - `invitation status` — Users are created only by accepting an emailed invitation

### Architectural Benefits:

1. **Separation of Concerns**
   - User = Authentication (login, permissions)
   - Subscriber = Business logic (billing, gifts, recipients)

2. **Flexibility**
   - One User can manage multiple Subscribers (useful for admins)
   - Subscribers can exist without active login (legacy data, billing history)
   - Role changes don't affect billing status

3. **Security**
   - Authentication logic is isolated
   - Billing info is separate from login credentials
   - Role-based access control at the User level

4. **Data Integrity**
   - If a User is deleted → Subscriber is CASCADE deleted (see schema)
   - If Subscriber is deleted → User can still log in (but sees no data)

---

## Current Database State

Based on your CSV import, you currently have:

```
✅ 4 Users (authentication accounts)
✅ 4 Subscribers (paying customers)
✅ 1 Recipient (Sarah Test - linked to a Subscriber)
```

The relationship chain:
```
User (id: 6a82fcc8dd23ed146cdc7a8f, email: pph2shoaib@gmail.com)
  └─> Subscriber (id: 6a82f9ef318f01ae7cd55c69, createdById: 6a82fcc8dd23ed146cdc7a8f)
        └─> Recipient (Sarah Test, subscriberId: 6a82f9ef318f01ae7cd55c69)
```

---

## How They Work Together in Your App

### Login Flow
1. User enters email/password at `/login`
2. System looks up **User** record
3. Checks `role` field:
   - If `ADMIN` → Show admin dashboard
   - If `USER` → Show subscriber app

### Subscriber Dashboard Flow
1. User logs in (authenticated as **User**)
2. App queries: `SELECT * FROM subscribers WHERE created_by_id = {user.id}`
3. Gets the **Subscriber** record
4. Shows: My People, Gift Lists, etc. (linked to this Subscriber)

### Admin Creating a Subscriber
1. Admin clicks "Invite Person"
2. Enters email and selects role (USER)
3. System sends invitation
4. Person accepts → **User created**
5. During onboarding → **Subscriber created** with `createdById = user.id`

---

## Key Differences Summary

| Aspect | User | Subscriber |
|--------|------|------------|
| **Purpose** | Authentication | Business/Subscription |
| **Email** | Login identifier | Billing/contact email |
| **Primary Use** | "Who can log in?" | "Who is paying?" |
| **Role** | ADMIN or USER | N/A (has subscriptionStatus instead) |
| **Created When** | Email invite accepted | Onboarding completed |
| **Owns** | Subscribers, Recipients | Recipients, GiftLists |
| **Billing** | No | Yes (Stripe integration) |
| **Can Delete?** | Yes (cascades to Subscriber) | Yes (User remains) |

---

## Common Questions

### Q: Can a Subscriber exist without a User?
**A**: No. The schema requires `createdById` (foreign key to User). Every Subscriber must be linked to a User.

### Q: Can a User exist without a Subscriber?
**A**: Yes! An admin User (Gem) might not have a Subscriber record initially. They're just managing the system.

### Q: Why does Subscriber have its own `email` field when User already has one?
**A**: 
1. Billing contact might differ from login email (rare but possible)
2. Historical reasons from Base44 migration
3. Flexibility for future features (e.g., gift from multiple users to one subscriber)

### Q: If I delete a User, what happens to their Subscribers?
**A**: All Subscribers created by that User are CASCADE deleted (see `onDelete: Cascade` in schema).

### Q: Can one User have multiple Subscribers?
**A**: Yes! The schema allows `User → Subscriber[]` (one-to-many). Useful for admins or edge cases.

---

## Migration from Base44

In the original Base44 system (per the SRS):
- Base44 managed User accounts automatically
- Subscriber was a separate entity you defined
- The link was implicit through Base44's auth system

In your new PostgreSQL system:
- User table explicitly defined
- Subscriber explicitly links via `createdById`
- More control but requires maintaining the relationship yourself

---

## Implementation Notes

### In Your Code (AuthContext.jsx)
```javascript
const { user } = useAuth();  // This is the User (with role)

// Fetch the subscriber for this user
const subscriber = await base44.entities.Subscriber.filter({ 
  created_by_id: user.id 
});
```

### In Your Server (server/index.js)
```javascript
// Create subscriber endpoint ensures User exists
if (!userId) {
  let user = await prisma.user.findUnique({ where: { email: data.email } });
  if (!user) {
    user = await prisma.user.create({
      data: { email: data.email, role: 'USER' }
    });
  }
  userId = user.id;
}

await prisma.subscriber.create({
  data: { 
    ...subscriberData,
    createdById: userId  // Link to User
  }
});
```

---

## Recommendations

✅ **Current Implementation**: Your schema correctly separates User (auth) from Subscriber (business)

✅ **Keep It**: This is a good architectural pattern

✅ **Document**: Make sure team understands:
- User = login/role
- Subscriber = paying customer/data owner

✅ **Consistency**: Always link Subscriber to User via `createdById`

✅ **Testing**: Test both paths:
- Admin User (role: ADMIN) → sees admin dashboard
- Regular User (role: USER) → sees subscriber app

---

**Status**: Documentation Complete  
**Schema**: Correct and following best practices  
**Last Updated**: 2026-09-02
