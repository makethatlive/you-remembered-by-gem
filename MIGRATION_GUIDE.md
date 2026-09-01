# Migration Guide: Base44 to PostgreSQL

This guide will help you migrate your "You Remembered By Gem" application from Base44 to a standalone PostgreSQL database with Prisma ORM.

## Overview

This migration includes:
- ✅ Complete Prisma schema matching all Base44 entities
- ✅ Database seeders with sample data
- ✅ Migration scripts for data transfer
- ✅ New API client compatible with existing code
- ✅ Environment configuration templates

## Prerequisites

1. **PostgreSQL Database** - You'll need a PostgreSQL instance. Options:
   - Local: Install PostgreSQL from https://www.postgresql.org/download/
   - Cloud: Use services like [Supabase](https://supabase.com), [Railway](https://railway.app), [Neon](https://neon.tech), or AWS RDS

2. **Node.js** - Ensure you have Node.js 18+ installed

## Step-by-Step Migration

### Step 1: Install Dependencies

```bash
npm install prisma @prisma/client
npm install -D prisma
```

### Step 2: Set Up Environment Variables

1. Copy the example environment file:
```bash
copy .env.example .env
```

2. Update `.env` with your database credentials:
```env
DATABASE_URL="postgresql://username:password@localhost:5432/youremembered?schema=public"
```

For example:
- **Local**: `postgresql://postgres:password@localhost:5432/youremembered`
- **Supabase**: Get from your project settings → Database → Connection string
- **Railway**: Get from your PostgreSQL service variables

### Step 3: Initialize the Database

Generate Prisma client and create database schema:

```bash
npx prisma generate
npx prisma db push
```

### Step 4: Seed the Database

Run the seeder to populate with initial data:

```bash
npx prisma db seed
```

This creates:
- Admin and sample users
- Sample retailers (Amazon UK, John Lewis, etc.)
- Sample products
- Sample subscriber and recipient
- Sample gift lists and items

### Step 5: Export Data from Base44 (Optional)

If you have existing data in Base44:

1. **Option A: Use Base44 Dashboard**
   - Go to your Base44 dashboard
   - Export each entity as CSV
   - Save to `database-csv/` folder

2. **Option B: Use Base44 SDK** (if still available)
   ```javascript
   // Write custom export script using Base44 SDK
   ```

3. **Run migration script:**
   ```bash
   node scripts/migrate-from-base44.js
   ```

### Step 6: Update Your Code

#### Replace Base44 SDK imports:

**Before (Base44):**
```javascript
import { base44 } from '@base44/sdk';

const users = await base44.User.findMany();
```

**After (Prisma):**
```javascript
import db from './src/api/prismaClient.js';

const users = await db.query('User');
```

#### API Client Compatibility

The new `prismaClient.js` provides a similar API to Base44:

```javascript
// Query records
const recipients = await db.query('Recipient', {
  where: { subscriberId: 'xxx' },
  include: { giftLists: true },
  orderBy: { createdAt: 'desc' }
});

// Get single record
const user = await db.get('User', userId);

// Create record
const newProduct = await db.create('Product', {
  name: 'New Product',
  price: 29.99,
  retailerId: 'xxx'
});

// Update record
await db.update('Product', productId, {
  price: 39.99
});

// Delete record
await db.delete('Product', productId);

// Count records
const count = await db.count('Product', {
  status: 'ACTIVE'
});

// Direct Prisma access for complex queries
const result = await db.client.product.findMany({
  where: {
    price: { gte: 20, lte: 50 }
  }
});
```

### Step 7: Update Functions

Update your Base44 functions to use the new Prisma client:

**Example: `generateGiftList/entry.ts`**

Before:
```typescript
import { base44 } from '@base44/sdk';

const recipient = await base44.Recipient.findUnique({ 
  where: { id: recipientId } 
});
```

After:
```typescript
import db from '../../lib/db.js';

const recipient = await db.client.recipient.findUnique({ 
  where: { id: recipientId } 
});
```

### Step 8: Remove Base44 Dependencies

Once migration is complete and tested:

```bash
npm uninstall @base44/sdk @base44/vite-plugin
```

Update `package.json` to remove Base44 references.

### Step 9: Update Vite Configuration

Remove Base44 Vite plugin from `vite.config.js`:

**Before:**
```javascript
import base44Plugin from '@base44/vite-plugin';

export default defineConfig({
  plugins: [react(), base44Plugin()],
});
```

**After:**
```javascript
export default defineConfig({
  plugins: [react()],
});
```

## Database Management

### View Database

```bash
# Open Prisma Studio (visual database browser)
npx prisma studio
```

### Create Migrations

When you modify the schema:

```bash
# Create a migration
npx prisma migrate dev --name your_migration_name

# Apply migrations to production
npx prisma migrate deploy
```

### Reset Database

```bash
# Reset database and re-seed
npx prisma migrate reset
```

## Schema Mapping

Here's how Base44 entities map to Prisma:

| Base44 Entity | Prisma Model | Notes |
|---------------|--------------|-------|
| User | User | Added id, timestamps |
| Subscriber | Subscriber | Added relations |
| Recipient | Recipient | Full profile support |
| Retailer | Retailer | Scraping metadata |
| Product | Product | AI classifications |
| GiftList | GiftList | Status tracking |
| GiftItem | GiftItem | Feedback & scoring |
| EmailLog | EmailLog | Email tracking |
| SignupAttempt | SignupAttempt | Signup tracking |
| ScrapeRunLog | ScrapeRunLog | Scraping logs |
| ScrapeState | ScrapeState | Scraping state |
| TrendStats | TrendStats | Analytics |

## Enum Mappings

Base44 used string enums. Prisma uses proper enums:

- `"admin"` → `Role.ADMIN`
- `"active"` → `SubscriptionStatus.ACTIVE`
- `"Male"` → `Gender.MALE`
- `"curated"` → `ListType.CURATED`
- etc.

## Authentication

You'll need to implement your own authentication. Recommended options:

1. **NextAuth.js** - If using Next.js
2. **Passport.js** - For Express
3. **Auth0** or **Clerk** - Managed auth services
4. **Supabase Auth** - If using Supabase

Example setup with Supabase:
```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);
```

## Row Level Security (RLS)

Base44's RLS rules need to be implemented in your application layer or PostgreSQL:

### Option 1: Application Layer (Recommended)
```javascript
// Middleware to check permissions
function checkOwnership(req, res, next) {
  const { userId } = req.user;
  const { recipientId } = req.params;
  
  const recipient = await db.client.recipient.findUnique({
    where: { id: recipientId }
  });
  
  if (recipient.createdById !== userId && req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  next();
}
```

### Option 2: PostgreSQL RLS
```sql
-- Enable RLS on tables
ALTER TABLE recipients ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own recipients
CREATE POLICY recipient_isolation ON recipients
  FOR SELECT
  USING (created_by_id = current_user_id());
```

## Testing

Test your migration:

1. **Database Connection:**
```bash
npx prisma db pull  # Verify schema
npx prisma studio   # Browse data
```

2. **Query Testing:**
```javascript
// Test basic queries
import db from './src/api/prismaClient.js';

const count = await db.count('Product');
console.log(`Products: ${count}`);
```

3. **Integration Testing:**
- Test user signup flow
- Test gift list generation
- Test email sending
- Test Stripe webhooks

## Troubleshooting

### Connection Issues

```bash
# Test database connection
npx prisma db execute --stdin <<< "SELECT 1"
```

### Schema Sync Issues

```bash
# Pull current schema from database
npx prisma db pull

# Push schema to database
npx prisma db push
```

### Migration Conflicts

```bash
# Reset migrations
npx prisma migrate reset

# Create new baseline
npx prisma migrate dev --name init
```

## Production Deployment

### Environment Variables

Ensure these are set in production:

```env
DATABASE_URL="postgresql://..."
NODE_ENV="production"
SESSION_SECRET="secure_random_string"
STRIPE_SECRET_KEY="sk_live_..."
```

### Database Setup

```bash
# Run migrations
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate
```

### Connection Pooling

For production, use connection pooling:

```javascript
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  directUrl = env("DIRECT_DATABASE_URL") // For migrations
}
```

## Support

If you encounter issues:

1. Check Prisma documentation: https://www.prisma.io/docs
2. Review Prisma Discord: https://pris.ly/discord
3. Check PostgreSQL logs for database errors

## Next Steps

After migration:

1. ✅ Set up authentication
2. ✅ Implement API routes
3. ✅ Add connection pooling
4. ✅ Set up backup strategy
5. ✅ Configure monitoring
6. ✅ Update CI/CD pipelines
7. ✅ Test all functionality
8. ✅ Deploy to production

## File Structure

```
your-project/
├── prisma/
│   ├── schema.prisma      # Database schema
│   └── seed.js            # Database seeder
├── src/
│   ├── lib/
│   │   └── db.js          # Prisma client singleton
│   └── api/
│       └── prismaClient.js # API wrapper
├── scripts/
│   └── migrate-from-base44.js # Migration script
├── database-csv/          # CSV exports from Base44
├── .env                   # Environment variables
├── .env.example          # Environment template
└── MIGRATION_GUIDE.md    # This file
```

---

**Good luck with your migration! 🚀**
