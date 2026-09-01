# API Server Setup ✅

## Overview
Your app now uses a local Express API server that fetches data from PostgreSQL via Prisma instead of Base44.

## Running the Application

### Two Terminal Windows Required:

**Terminal 1 - Frontend (Vite)**
```bash
npm run dev
```
- Runs on: http://localhost:5173
- This is your React frontend

**Terminal 2 - Backend (Express API)**
```bash
npm run server
```
- Runs on: http://localhost:3001
- This serves data from PostgreSQL

## How It Works

### 1. Frontend (Browser)
- User opens http://localhost:5173
- React app loads with mock auth (auto-login)
- Components call `base44.entities.Recipient.filter()`, etc.

### 2. Base44 Client (`src/api/base44Client.js`)
- Intercepts Base44 SDK calls
- Converts them to REST API calls
- Sends requests to http://localhost:3001/api/*

### 3. Express API (`server/index.js`)
- Receives REST API requests
- Uses Prisma to query PostgreSQL
- Returns real data as JSON

### 4. PostgreSQL Database
- Stores all your data (imported from CSV)
- Accessed via Prisma ORM
- No Base44 dependency!

## API Endpoints

### Subscribers
- `GET /api/subscribers` - List all subscribers
- `GET /api/subscribers/:id` - Get single subscriber
- `POST /api/subscribers` - Create subscriber
- `PATCH /api/subscribers/:id` - Update subscriber

### Recipients
- `GET /api/recipients` - List all recipients
- `GET /api/recipients/:id` - Get single recipient  
- `POST /api/recipients` - Create recipient
- `PATCH /api/recipients/:id` - Update recipient
- `DELETE /api/recipients/:id` - Delete recipient

### Gift Lists
- `GET /api/gift-lists` - List all gift lists
- `GET /api/gift-lists/:id` - Get single gift list with items

### Products
- `GET /api/products` - List products (limit 100)
- `GET /api/products/:id` - Get single product

## Testing the API

Test endpoints directly:
```bash
# Check health
curl http://localhost:3001/api/health

# Get subscribers
curl http://localhost:3001/api/subscribers

# Get recipients
curl http://localhost:3001/api/recipients

# Get products
curl http://localhost:3001/api/products
```

## Your Current Data

Based on the CSV import:
- ✅ **4 Subscribers** (including pph2shoaib@gmail.com)
- ✅ **1 Recipient** (Sarah Test - Daughter)
- ✅ **81 Retailers**
- ✅ **2,743 Products**
- ✅ **2 Gift Lists**
- ✅ **6 Gift Items**

## What Just Happened?

1. ✅ Created Express API server in `server/index.js`
2. ✅ Updated `src/api/base44Client.js` to call REST API
3. ✅ Added helper functions for snake_case ↔ camelCase conversion
4. ✅ Started API server on port 3001
5. ✅ Tested endpoints - returning real data!

## Next Steps

1. **Refresh your browser** at http://localhost:5173
   - Should now show real data from PostgreSQL
   - Subscribers, recipients, and gift lists should appear

2. **If data still not showing**:
   - Check browser console (F12) for errors
   - Look for network requests to localhost:3001
   - Verify both servers are running (Vite + Express)

3. **When adding features**:
   - Add new endpoints to `server/index.js`
   - Update `src/api/base44Client.js` to call them
   - Frontend code remains mostly unchanged!

## Stopping the Servers

- **Frontend**: Ctrl+C in the terminal running `npm run dev`
- **Backend**: Ctrl+C in the terminal running `npm run server`

## Production Deployment

When ready for production:
1. Deploy database to Railway/Heroku/etc
2. Deploy API server (Express) to same or separate host
3. Deploy frontend (Vite build) to Vercel/Netlify/etc
4. Update API_BASE URL in `base44Client.js` to production API

---

**Status**: ✅ Complete and running!
**Frontend**: http://localhost:5173
**Backend**: http://localhost:3001
**Database**: PostgreSQL (local pgAdmin)
