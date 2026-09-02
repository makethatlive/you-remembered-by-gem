# Development Login System

## Overview
A simple authentication system for local development that allows you to log in as any user from the database.

## How It Works

### 1. Authentication Flow
- Users are stored in localStorage under the key `auth_user`
- On page load, AuthContext checks for existing session
- If no session exists, user is redirected to `/login`
- Login page fetches all users from the database via `/api/users`
- User selects which account to log in as
- Selected user data is saved to localStorage and AuthContext

### 2. User Data Structure
```json
{
  "id": "user_id_from_database",
  "email": "user@example.com",
  "role": "admin" or "user",
  "full_name": "User Name"
}
```

### 3. Protected Routes
- `/` (Home) - Requires authentication
- `/people` - Requires authentication
- `/onboarding` - Requires authentication
- `/login` - Public (no auth required)

### 4. Logout
- Click logout in the UI
- Clears localStorage `auth_user` key
- Redirects to `/login`

## Files Modified

### `src/lib/AuthContext.jsx`
- Removed hardcoded mock user
- Added `login()` function to set user and save to localStorage
- Check localStorage on mount for existing session
- Redirect to `/login` instead of `/` on logout

### `src/pages/Login.jsx`
- Completely rewritten to fetch users from database
- Shows all users as clickable cards
- Displays user email and role
- One-click login (no password required in dev)

### `src/api/base44Client.js`
- Updated `auth.me()` to read from localStorage
- Updated `auth.logout()` to clear localStorage
- Updated `auth.redirectToLogin()` to go to `/login`

## Testing

1. **Start the server:**
   ```bash
   npm run server
   ```

2. **Start the frontend:**
   ```bash
   npm run dev
   ```

3. **Navigate to http://localhost:3000**
   - Should redirect to `/login`
   - Should show all users from database
   - Click any user to log in as them

4. **Verify authentication:**
   - After login, should redirect to home page
   - Should see user's name/email in header
   - Should be able to access all protected routes
   - Logout should work and redirect back to login

## Database Users

Current users in the database (from CSV import):
- pph2shoaib@gmail.com (ADMIN)
- testuser@example.com (USER)
- alice@example.com (USER)
- bob@example.com (USER)
- carol@example.com (USER)

## Production Considerations

**⚠️ IMPORTANT: This is a development-only system!**

For production deployment:
1. Remove or disable the dev login system
2. Implement proper authentication (OAuth, email/password with hashing, etc.)
3. Add password requirements and validation
4. Implement proper session management (JWT, cookies, etc.)
5. Add rate limiting and security measures
6. Never store credentials in localStorage without encryption
7. Implement proper CSRF protection
8. Add 2FA/MFA support

## Troubleshooting

### "No users found in database"
- Make sure the server is running on port 3001
- Run the CSV import script: `npm run import:csv`
- Check server logs for errors

### Login redirects back to login page
- Check browser console for errors
- Verify localStorage has `auth_user` key after clicking a user
- Check that AuthContext is properly wrapping the app

### User data not persisting
- Check that localStorage is enabled in your browser
- Try clearing localStorage and logging in again
- Check browser DevTools > Application > Local Storage

### API calls failing
- Verify server is running: http://localhost:3001/api/health
- Check browser Network tab for failed requests
- Ensure CORS is properly configured in server
