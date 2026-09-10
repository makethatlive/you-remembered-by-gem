# 🚀 Start Server with Authentication

## The Issue

The authentication backend files were created but need a clean restart to work properly.

## Solution - 3 Steps

### Step 1: Stop Any Running Servers

```bash
# PowerShell (Windows)
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
```

Or just close any terminal windows running `npm run server`.

### Step 2: Regenerate Prisma Client

```bash
npx prisma generate
```

This generates the Prisma client with the new Session model.

### Step 3: Start Server

```bash
npm run server
```

You should see:
```
Server running on port 3001
✅ Auth routes loaded at /api/auth
```

## Test Authentication Works

### Quick Test (New Terminal)

```bash
npm run test:auth
```

### Manual Test

```bash
# Register
curl -X POST http://localhost:3001/api/auth/register ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"test@example.com\",\"password\":\"SecurePass123!\",\"firstName\":\"John\"}"

# Login
curl -X POST http://localhost:3001/api/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"test@example.com\",\"password\":\"SecurePass123!\"}"
```

## Check Health

```bash
curl http://localhost:3001/api/health
```

Should return:
```json
{"status":"ok","message":"API server running"}
```

## Troubleshooting

### "Cannot find module 'auth-routes'"
**Solution:** Run `npx prisma generate` again

### "EPERM: operation not permitted"
**Solution:** 
1. Close all terminals
2. Wait 5 seconds
3. Try again

### "Port 3001 already in use"
**Solution:**
```bash
# Find and kill the process
netstat -ano | findstr :3001
taskkill /PID <PID> /F
```

### Database Schema Not Updated
**Solution:**
```bash
npx prisma db push
```

## Verify Everything Works

After starting the server, check these endpoints:

1. **Health Check**
   ```bash
   curl http://localhost:3001/api/health
   ```

2. **Register (should work)**
   ```bash
   curl -X POST http://localhost:3001/api/auth/register ^
     -H "Content-Type: application/json" ^
     -d "{\"email\":\"test@example.com\",\"password\":\"Test123!\",\"firstName\":\"Test\"}"
   ```

3. **Get Current User (should fail without token)**
   ```bash
   curl http://localhost:3001/api/auth/me
   ```
   Should return: `401 Unauthorized`

## Success Indicators

✅ Server starts without errors  
✅ `/api/health` returns 200  
✅ `/api/auth/register` accepts requests  
✅ `/api/auth/login` accepts requests  
✅ `/api/auth/me` returns 401 without token  
✅ Prisma client loads Session model  

---

**Once these work, your authentication is fully operational!** 🎉
