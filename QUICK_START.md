# Quick Start Guide

Get your migrated application running in 5 minutes!

## 1. Install Dependencies

```bash
npm install
```

## 2. Set Up Database

Choose one of these options:

### Option A: Local PostgreSQL

```bash
# Install PostgreSQL
# Windows: Download from https://www.postgresql.org/download/windows/
# Mac: brew install postgresql

# Create database
createdb youremembered

# Update .env
DATABASE_URL="postgresql://postgres:password@localhost:5432/youremembered"
```

### Option B: Supabase (Free Cloud Database)

1. Go to https://supabase.com
2. Create a new project
3. Get connection string from Settings → Database
4. Update .env:

```env
DATABASE_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"
```

### Option C: Railway (Free Cloud Database)

1. Go to https://railway.app
2. Create a new PostgreSQL database
3. Copy the DATABASE_URL from variables
4. Update .env

## 3. Initialize Database

```bash
# Generate Prisma client
npm run db:generate

# Create database schema
npm run db:push

# Import your real data from CSV files
npm run import:csv

# OR seed with sample data (if you don't have CSV data)
# npm run db:seed
```

## 4. Start Development Server

```bash
npm run dev
```

Your app should now be running at http://localhost:5173

## 5. View Database

Open Prisma Studio to browse your data:

```bash
npm run db:studio
```

## Sample Login Credentials

After seeding, you can use these test accounts:

- **Admin**: admin@youremembered.com
- **User**: user@example.com

## What's Included in Your Data?

After importing from CSV, you'll have:
- ✅ All your retailers from Base44
- ✅ All your subscribers
- ✅ All your recipients with profiles
- ✅ All your products catalog
- ✅ All your gift lists
- ✅ All your gift items
- ✅ All your email logs
- ✅ Complete historical data

## Common Commands

```bash
# Development
npm run dev                    # Start dev server
npm run build                  # Build for production
npm run preview               # Preview production build

# Database
npm run db:studio             # Open database browser
npm run db:migrate            # Create new migration
npm run db:push               # Sync schema to database
npm run db:seed               # Seed database
npm run db:reset              # Reset and re-seed database

# Migration
npm run import:csv            # Import your real CSV data from Base44
npm run migrate:from-base44   # Alternative migration method

# Code Quality
npm run lint                  # Check for errors
npm run lint:fix              # Fix errors automatically
```

## Next Steps

1. **Remove Base44** (if not already done):
   ```bash
   npm uninstall @base44/sdk @base44/vite-plugin
   ```

2. **Update imports** in your code from Base44 to Prisma:
   ```javascript
   // Old
   import { base44 } from '@base44/sdk';
   
   // New
   import db from './src/api/prismaClient.js';
   ```

3. **Set up authentication** - Choose from:
   - Supabase Auth
   - NextAuth.js
   - Auth0
   - Custom JWT

4. **Deploy to production** - Options:
   - Vercel + Supabase
   - Railway (database + app)
   - AWS / Google Cloud
   - Your own VPS

## Troubleshooting

### "Can't reach database server"

Check your DATABASE_URL in .env and ensure PostgreSQL is running.

```bash
# Test connection
npx prisma db execute --stdin <<< "SELECT 1"
```

### "Module not found: @base44/sdk"

Remove Base44 references:
```bash
npm uninstall @base44/sdk @base44/vite-plugin
```

### "Migration failed"

Reset the database:
```bash
npm run db:reset
```

### Port 5173 already in use

Kill the process using the port or change the port in vite.config.js.

## Support

- **Prisma Docs**: https://www.prisma.io/docs
- **PostgreSQL Docs**: https://www.postgresql.org/docs/
- **Full Migration Guide**: See `MIGRATION_GUIDE.md`

---

**Happy coding! 🎉**
