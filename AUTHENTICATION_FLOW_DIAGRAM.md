# 🔐 Authentication System Flow Diagram

Visual guide to understand how authentication works in your application.

---

## 📊 Complete Authentication Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         USER REGISTRATION FLOW                               │
└─────────────────────────────────────────────────────────────────────────────┘

    Frontend                    Backend                     Database
       │                           │                            │
       │  POST /auth/register      │                            │
       │  { email, password }      │                            │
       ├──────────────────────────>│                            │
       │                           │                            │
       │                           │ 1. Validate input          │
       │                           │ 2. Check if user exists    │
       │                           ├───────────────────────────>│
       │                           │<───────────────────────────┤
       │                           │                            │
       │                           │ 3. Hash password (bcrypt)  │
       │                           │ 4. Create user             │
       │                           ├───────────────────────────>│
       │                           │<───────────────────────────┤
       │                           │                            │
       │                           │ 5. Generate JWT            │
       │                           │ 6. Create session          │
       │                           ├───────────────────────────>│
       │                           │<───────────────────────────┤
       │                           │                            │
       │                           │ 7. Send verification email │
       │                           │ 8. Send welcome email      │
       │                           │                            │
       │  { user, accessToken }    │                            │
       │<──────────────────────────┤                            │
       │                           │                            │
       │ 9. Store token            │                            │
       │ localStorage.set()        │                            │
       │                           │                            │


┌─────────────────────────────────────────────────────────────────────────────┐
│                            USER LOGIN FLOW                                   │
└─────────────────────────────────────────────────────────────────────────────┘

    Frontend                    Backend                     Database
       │                           │                            │
       │  POST /auth/login         │                            │
       │  { email, password }      │                            │
       ├──────────────────────────>│                            │
       │                           │                            │
       │                           │ 1. Find user by email      │
       │                           ├───────────────────────────>│
       │                           │<───────────────────────────┤
       │                           │                            │
       │                           │ 2. Verify password         │
       │                           │    bcrypt.compare()        │
       │                           │                            │
       │                           │ 3. Update lastLoginAt      │
       │                           ├───────────────────────────>│
       │                           │<───────────────────────────┤
       │                           │                            │
       │                           │ 4. Generate JWT (7d exp)   │
       │                           │ 5. Generate refresh token  │
       │                           │ 6. Create session          │
       │                           ├───────────────────────────>│
       │                           │<───────────────────────────┤
       │                           │                            │
       │  { user, tokens }         │                            │
       │<──────────────────────────┤                            │
       │                           │                            │
       │ 7. Store tokens           │                            │
       │ localStorage.set()        │                            │
       │                           │                            │


┌─────────────────────────────────────────────────────────────────────────────┐
│                       PROTECTED API REQUEST FLOW                             │
└─────────────────────────────────────────────────────────────────────────────┘

    Frontend                    Middleware                 Backend               Database
       │                           │                           │                    │
       │  GET /api/subscribers     │                           │                    │
       │  Authorization: Bearer {token}                        │                    │
       ├──────────────────────────>│                           │                    │
       │                           │                           │                    │
       │                           │ 1. Extract token          │                    │
       │                           │ 2. Verify JWT signature   │                    │
       │                           │ 3. Check session          │                    │
       │                           ├──────────────────────────────────────────────>│
       │                           │<──────────────────────────────────────────────┤
       │                           │                           │                    │
       │                           │ 4. Check session expiry   │                    │
       │                           │ 5. Attach user to req     │                    │
       │                           │                           │                    │
       │                           │         req.user          │                    │
       │                           ├──────────────────────────>│                    │
       │                           │                           │                    │
       │                           │                           │ 6. Query data      │
       │                           │                           ├───────────────────>│
       │                           │                           │<───────────────────┤
       │                           │                           │                    │
       │      { data }             │                           │                    │
       │<──────────────────────────┴───────────────────────────┤                    │
       │                                                       │                    │


┌─────────────────────────────────────────────────────────────────────────────┐
│                       PASSWORD RESET FLOW                                    │
└─────────────────────────────────────────────────────────────────────────────┘

    Frontend                    Backend                     Database              Email
       │                           │                            │                    │
       │  POST /auth/forgot-password                           │                    │
       │  { email }                │                            │                    │
       ├──────────────────────────>│                            │                    │
       │                           │                            │                    │
       │                           │ 1. Find user               │                    │
       │                           ├───────────────────────────>│                    │
       │                           │<───────────────────────────┤                    │
       │                           │                            │                    │
       │                           │ 2. Generate reset token    │                    │
       │                           │    (crypto.randomBytes)    │                    │
       │                           │ 3. Hash token (SHA256)     │                    │
       │                           │ 4. Save to DB (1h expiry)  │                    │
       │                           ├───────────────────────────>│                    │
       │                           │<───────────────────────────┤                    │
       │                           │                            │                    │
       │                           │ 5. Send reset email        │                    │
       │                           ├────────────────────────────────────────────────>│
       │                           │                            │                    │
       │  { success: true }        │                            │                    │
       │<──────────────────────────┤                            │                    │
       │                           │                            │    Reset Link      │
       │                           │                            │<───────────────────┤
       │                           │                            │                    │
       │                                                        │                    │
       │  Click Link in Email                                  │                    │
       │  /reset-password?token=xxx                            │                    │
       │                                                        │                    │
       │  POST /auth/reset-password                            │                    │
       │  { token, newPassword }   │                            │                    │
       ├──────────────────────────>│                            │                    │
       │                           │                            │                    │
       │                           │ 1. Hash token              │                    │
       │                           │ 2. Find user by token      │                    │
       │                           ├───────────────────────────>│                    │
       │                           │<───────────────────────────┤                    │
       │                           │                            │                    │
       │                           │ 3. Check token expiry      │                    │
       │                           │ 4. Validate new password   │                    │
       │                           │ 5. Hash new password       │                    │
       │                           │ 6. Update user             │                    │
       │                           │ 7. Clear reset token       │                    │
       │                           │ 8. Revoke all sessions     │                    │
       │                           ├───────────────────────────>│                    │
       │                           │<───────────────────────────┤                    │
       │                           │                            │                    │
       │  { success: true }        │                            │                    │
       │<──────────────────────────┤                            │                    │
       │                           │                            │                    │


┌─────────────────────────────────────────────────────────────────────────────┐
│                         TOKEN REFRESH FLOW                                   │
└─────────────────────────────────────────────────────────────────────────────┘

    Frontend                    Backend                     Database
       │                           │                            │
       │  POST /auth/refresh       │                            │
       │  { refreshToken }         │                            │
       ├──────────────────────────>│                            │
       │                           │                            │
       │                           │ 1. Find session            │
       │                           ├───────────────────────────>│
       │                           │<───────────────────────────┤
       │                           │                            │
       │                           │ 2. Verify session valid    │
       │                           │ 3. Check expiry            │
       │                           │ 4. Generate new JWT        │
       │                           │ 5. Generate new refresh    │
       │                           │ 6. Update session          │
       │                           ├───────────────────────────>│
       │                           │<───────────────────────────┤
       │                           │                            │
       │  { accessToken, refreshToken }                        │
       │<──────────────────────────┤                            │
       │                           │                            │
       │ 7. Update stored tokens   │                            │
       │                           │                            │


┌─────────────────────────────────────────────────────────────────────────────┐
│                            LOGOUT FLOW                                       │
└─────────────────────────────────────────────────────────────────────────────┘

    Frontend                    Backend                     Database
       │                           │                            │
       │  POST /auth/logout        │                            │
       │  Authorization: Bearer {token}                        │
       ├──────────────────────────>│                            │
       │                           │                            │
       │                           │ 1. Authenticate user       │
       │                           │ 2. Delete session          │
       │                           ├───────────────────────────>│
       │                           │<───────────────────────────┤
       │                           │                            │
       │  { success: true }        │                            │
       │<──────────────────────────┤                            │
       │                           │                            │
       │ 3. Clear local tokens     │                            │
       │ localStorage.remove()     │                            │
       │ 4. Redirect to login      │                            │
       │                           │                            │


┌─────────────────────────────────────────────────────────────────────────────┐
│                       EMAIL VERIFICATION FLOW                                │
└─────────────────────────────────────────────────────────────────────────────┘

    Frontend                    Backend                     Database              Email
       │                           │                            │                    │
       │  (After Registration)     │                            │                    │
       │                           │ 1. Generate token          │                    │
       │                           │ 2. Save to user            │                    │
       │                           ├───────────────────────────>│                    │
       │                           │<───────────────────────────┤                    │
       │                           │                            │                    │
       │                           │ 3. Send verification email │                    │
       │                           ├────────────────────────────────────────────────>│
       │                           │                            │                    │
       │                           │                            │  Verification Link │
       │                           │                            │<───────────────────┤
       │                           │                            │                    │
       │  Click Link in Email                                  │                    │
       │  /verify-email?token=xxx                              │                    │
       │                                                        │                    │
       │  GET /auth/verify-email?token=xxx                     │                    │
       ├──────────────────────────>│                            │                    │
       │                           │                            │                    │
       │                           │ 1. Find user by token      │                    │
       │                           ├───────────────────────────>│                    │
       │                           │<───────────────────────────┤                    │
       │                           │                            │                    │
       │                           │ 2. Mark email verified     │                    │
       │                           │ 3. Clear token             │                    │
       │                           ├───────────────────────────>│                    │
       │                           │<───────────────────────────┤                    │
       │                           │                            │                    │
       │  { success: true }        │                            │                    │
       │<──────────────────────────┤                            │                    │
       │                           │                            │                    │
```

---

## 🔒 Security Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                        SECURITY STACK                            │
└─────────────────────────────────────────────────────────────────┘

Layer 1: NETWORK
    ├─ HTTPS/TLS (Railway auto-provisions)
    ├─ CORS with credentials
    └─ Rate limiting (5 attempts / 15 min)

Layer 2: AUTHENTICATION
    ├─ JWT tokens (HMAC-SHA256)
    ├─ 7-day access token expiry
    ├─ 30-day refresh token expiry
    └─ Token signature verification

Layer 3: SESSION MANAGEMENT
    ├─ Database-backed sessions
    ├─ IP address tracking
    ├─ User agent tracking
    ├─ Session expiry checks
    └─ Multi-device support (max 5)

Layer 4: PASSWORD SECURITY
    ├─ Bcrypt hashing (10 rounds)
    ├─ Strength validation
    ├─ Secure reset flow
    └─ Password history (prevent reuse)

Layer 5: INPUT VALIDATION
    ├─ Email format validation
    ├─ Password strength checks
    ├─ SQL injection prevention (Prisma)
    └─ XSS prevention (sanitization)

Layer 6: AUTHORIZATION
    ├─ Role-based access (USER/ADMIN)
    ├─ Email verification required
    ├─ Resource ownership checks
    └─ Admin-only routes
```

---

## 📊 Session Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│                      SESSION LIFECYCLE                           │
└─────────────────────────────────────────────────────────────────┘

    CREATE                    ACTIVE                    EXPIRED
       │                         │                         │
       │  1. User logs in        │  2. API requests        │  3. Session cleanup
       │                         │     with token          │
       │  Generate JWT           │                         │  Automatic deletion
       │  Generate refresh       │  Verify JWT             │  (hourly cron)
       │  Create session         │  Check session          │
       │  Store in database      │  Update heartbeat       │  Or manual logout
       │                         │                         │
       ├────────────────────────>│                         │
       │                         │                         │
       │     7 days             │     User activity       │
       │                         │                         │
       │                         ├────────────────────────>│
       │                         │                         │
       │                         │  Token expires          │
       │                         │  Session deleted        │
       │                         │  User must login        │
       │                         │                         │
```

---

## 🔄 Token Refresh Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                    TOKEN REFRESH STRATEGY                        │
└─────────────────────────────────────────────────────────────────┘

Access Token (7 days)              Refresh Token (30 days)
       │                                    │
       │  Used for API requests             │  Used to get new access token
       │  Short lived                       │  Long lived
       │  Can't be revoked directly         │  Can be revoked instantly
       │                                    │
       ├────────────────┐                  │
       │                │                  │
       │  Day 1-7       │                  │  Day 1-30
       │  Token valid   │                  │  Token valid
       │                │                  │
       └────────────────┘                  │
              │                            │
              │  Expires                   │
              │                            │
              ├───────────────────────────>│
              │  POST /auth/refresh        │
              │  { refreshToken }          │
              │                            │
              │<───────────────────────────┤
              │  New access token (7d)     │
              │  New refresh token (30d)   │
              │                            │
              ├────────────────┐           │
              │  Next 7 days   │           │
              │                │           │
```

---

## 🎯 User Journey Map

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER JOURNEY                              │
└─────────────────────────────────────────────────────────────────┘

NEW USER JOURNEY:
    Register → Email Sent → Verify Email → Login → Use App

    1. Register
       └─> User provides: email, password, name
       └─> System: Hashes password, creates user, generates token
       └─> Email: Verification link sent

    2. Verify Email (optional but recommended)
       └─> User clicks link in email
       └─> System: Marks email as verified

    3. Login
       └─> User provides: email, password
       └─> System: Verifies password, creates session, returns JWT

    4. Use App
       └─> User: Makes API requests with token
       └─> System: Validates token, checks session, serves data

RETURNING USER JOURNEY:
    Login → Use App → Logout

    1. Login
       └─> Auto-login if token still valid
       └─> Or manual login with credentials

    2. Use App
       └─> Token auto-refreshed when nearing expiry

    3. Logout
       └─> Session destroyed, tokens cleared

FORGOT PASSWORD JOURNEY:
    Forgot → Reset Email → New Password → Login

    1. Request Reset
       └─> User provides email
       └─> System sends reset link (1h expiry)

    2. Reset Password
       └─> User clicks link, provides new password
       └─> System: Updates password, revokes all sessions

    3. Login
       └─> User logs in with new password
```

---

## 📱 Multi-Device Support

```
┌─────────────────────────────────────────────────────────────────┐
│                   MULTI-DEVICE SESSIONS                          │
└─────────────────────────────────────────────────────────────────┘

    User                    Database Sessions Table
     │
     │  Device 1: MacBook
     │  └─> Session ID: abc123
     │      Token: eyJhbG...
     │      IP: 192.168.1.10
     │      UserAgent: Chrome/Mac
     │      Created: 2026-09-01
     │      Expires: 2026-09-08
     │
     │  Device 2: iPhone
     │  └─> Session ID: def456
     │      Token: eyJhbG...
     │      IP: 192.168.1.20
     │      UserAgent: Safari/iOS
     │      Created: 2026-09-02
     │      Expires: 2026-09-09
     │
     │  Device 3: Windows PC
     │  └─> Session ID: ghi789
     │      Token: eyJhbG...
     │      IP: 192.168.1.30
     │      UserAgent: Edge/Windows
     │      Created: 2026-09-03
     │      Expires: 2026-09-10
     │
     │  Logout on iPhone
     │  └─> Deletes only Session def456
     │      Other devices still logged in
     │
     │  Logout All Devices
     │  └─> Deletes all 3 sessions
     │      User must re-login everywhere
```

---

## ⚡ Rate Limiting

```
┌─────────────────────────────────────────────────────────────────┐
│                       RATE LIMITING                              │
└─────────────────────────────────────────────────────────────────┘

Endpoint              Limit           Window          Reset
/auth/register        5 attempts      15 minutes      Auto
/auth/login           5 attempts      15 minutes      Auto
/auth/forgot-password 3 attempts      15 minutes      Auto

Example:
    Request 1  ✅ Allowed (1/5)
    Request 2  ✅ Allowed (2/5)
    Request 3  ✅ Allowed (3/5)
    Request 4  ✅ Allowed (4/5)
    Request 5  ✅ Allowed (5/5)
    Request 6  ❌ Blocked (Rate limit exceeded)
               └─> Wait 15 minutes or restart server
```

---

**This diagram shows the complete authentication flow in your application!**

Use this as a reference when:
- 🔧 Debugging authentication issues
- 📱 Implementing frontend auth
- 🔒 Understanding security layers
- 🎓 Onboarding new developers
