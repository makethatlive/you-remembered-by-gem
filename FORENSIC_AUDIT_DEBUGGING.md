# Forensic Audit - Debugging Guide

## ✅ SOLUTION FOUND

### Error: 404 Not Found - POST http://localhost:5173/api/audit/forensic

**Root Cause:** The frontend was calling the wrong port (5173 instead of 3001). Vite dev server needs to proxy API requests to the backend server.

**Fix Applied:** Added proxy configuration to `vite.config.js`

### Steps to Fix:

1. **Stop your Vite dev server** (Ctrl+C)
2. **Restart Vite**:
   ```bash
   npm run dev
   ```
3. **Ensure backend server is also running on port 3001**
4. **Try the audit again**

The proxy is now configured to forward all `/api/*` requests from port 5173 (Vite) to port 3001 (Express API).

---

## Error: "Unexpected end of JSON input"

This error means the server is either:
1. Crashing before sending a response
2. Sending an empty response
3. Sending invalid JSON

## How to Debug

### Step 1: Check Server Console

After clicking "Run forensics audit", check your server console output. You should see:

```
🔍 Running forensic audit...
```

If you see an error after that, it will show the problem. Common issues:

#### Issue: `runForensicAudit is not defined`
**Solution:** Restart your server to pick up the import

#### Issue: Database connection error
**Solution:** Check your `.env` DATABASE_URL is correct

#### Issue: Table doesn't exist
**Solution:** Run `npx prisma db push` to sync schema

### Step 2: Test the Endpoint Directly

Use the test script:

```bash
node test-audit.js
```

This will show you:
- Response status code
- Response headers
- Raw response body
- Any parsing errors

### Step 3: Check Server is Running

Make sure your server is running on port 3001:

```bash
# Start server
npm run dev

# Or if using different command
node server/index.js
```

You should see:
```
🚀 API Server running on http://localhost:3001
```

### Step 4: Test with Sample Data

If you have no products/retailers, the audit will return empty results but should still work. Check:

```sql
-- Check if you have products
SELECT COUNT(*) FROM products;

-- Check if you have retailers
SELECT COUNT(*) FROM retailers;
```

## Fixed Issues

### ✅ Status Mapping Fixed

Changed from:
```javascript
const statusKey = product.status.toLowerCase().replace('_', '_');
```

To:
```javascript
const statusMap = {
  'ACTIVE': 'active',
  'NEEDS_REVIEW': 'needs_review',
  'INACTIVE': 'inactive',
  'REPORTED_BROKEN': 'reported_broken',
};
const statusKey = statusMap[product.status];
```

## Common Causes

### 1. Server Not Restarted
After changes, you **must** restart the server:
- Stop with `Ctrl+C`
- Start with `npm run dev`

### 2. Import Path Wrong
Check that `server/services/audit/forensic-audit-service.js` exists

### 3. Prisma Client Not Generated
Run:
```bash
npx prisma generate
```

### 4. Database Schema Out of Sync
Run:
```bash
npx prisma db push
```

## Quick Fix Checklist

- [ ] Stop server (Ctrl+C)
- [ ] Run `npx prisma generate`
- [ ] Start server (`npm run dev`)
- [ ] Check server console shows: "🚀 API Server running"
- [ ] Check endpoint is listed: "POST /api/audit/forensic (admin)"
- [ ] Try audit again in UI
- [ ] Check server console for error details

## If Still Failing

1. **Check server console** - Error details will be there
2. **Run test-audit.js** - See raw response
3. **Check database** - Make sure tables exist
4. **Verify Prisma** - Run `npx prisma studio` to view data

## Success Output

When working, server console should show:

```
🔍 Running forensic audit...
✅ Forensic audit complete: 123 products analyzed in 1234ms
```

And UI should show:
- Summary statistics grid
- Retailer coverage table
- Example products
- Notes section

## Need More Help?

Check these files:
- `server/services/audit/forensic-audit-service.js` - Audit logic
- `server/index.js` - API endpoint (line ~1750)
- `src/components/admin/ForensicsAuditPanel.jsx` - Frontend UI

Look for console errors in:
- Server terminal (backend errors)
- Browser DevTools Console (frontend errors)
- Browser DevTools Network tab (response details)
