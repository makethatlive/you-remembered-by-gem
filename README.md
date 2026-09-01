# You Remembered By Gem - PostgreSQL Migration

Complete migration package from Base44 to standalone PostgreSQL database with Prisma ORM.

## 🎯 Start Here

**New to this migration?** Read **[START_HERE.md](START_HERE.md)** first.

**Ready to import data?** Follow **[IMPORT_YOUR_DATA.md](IMPORT_YOUR_DATA.md)**.

**Track progress?** Use **[MIGRATION_CHECKLIST.md](MIGRATION_CHECKLIST.md)**.

## 📦 What's Included

This migration package provides everything needed to move from Base44 to your own database:

### Core Files
- ✅ **Prisma Schema** - Complete database schema matching all Base44 entities
- ✅ **CSV Import Script** - Imports your real data from Base44 exports  
- ✅ **API Client** - Drop-in replacement for Base44 SDK
- ✅ **Seeders** - Sample data for testing
- ✅ **Migrations** - Database version control

### Documentation (Read in Order)
1. **[START_HERE.md](START_HERE.md)** - Your starting point
2. **[IMPORT_YOUR_DATA.md](IMPORT_YOUR_DATA.md)** - Import real CSV data
3. **[QUICK_START.md](QUICK_START.md)** - Fast setup guide
4. **[MIGRATION_GUIDE.md](MIGRATION_GUIDE.md)** - Complete walkthrough
5. **[FUNCTION_UPDATE_EXAMPLE.md](FUNCTION_UPDATE_EXAMPLE.md)** - Code examples
6. **[MIGRATION_CHECKLIST.md](MIGRATION_CHECKLIST.md)** - Track your progress

### Your Real Data
```
database-csv/
├── Retailer_export.csv       50+ UK retailers
├── Subscriber_export.csv     Your real customers
├── Recipient_export.csv      Gift recipients
├── Product_export.csv        1000+ products
├── GiftList_export.csv       Generated lists
├── GiftItem_export.csv       Gift suggestions
└── ... (complete data)
```

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Setup database (edit .env with your DATABASE_URL)
copy .env.example .env

# 3. Create schema
npm run db:push

# 4. Import your real data
npm run import:csv

# 5. Start app
npm run dev
```

**Done!** Visit http://localhost:5173

## 📊 Database Schema

### 12 Entities Migrated

1. **User** - Authentication & authorization
2. **Subscriber** - Paid customers (Stripe integration)
3. **Recipient** - Gift recipients with profiles
4. **Retailer** - UK product retailers
5. **Product** - Gift product catalog (1000+)
6. **GiftList** - AI-generated gift suggestions
7. **GiftItem** - Individual gifts in lists
8. **EmailLog** - Email delivery tracking
9. **SignupAttempt** - Signup conversion tracking
10. **ScrapeRunLog** - Web scraping history
11. **ScrapeState** - Scraping state management
12. **TrendStats** - Analytics and insights

All with proper:
- Foreign keys and relationships
- Indexes for performance
- Enum types
- JSON fields for complex data
- Timestamps and audit trails

## 🛠️ Available Commands

### Database
```bash
npm run db:generate       # Generate Prisma client
npm run db:push          # Create/update schema
npm run db:migrate       # Create migration
npm run db:studio        # Browse database (GUI)
npm run db:reset         # Reset database
npm run db:seed          # Sample data (testing)
```

### Data Import
```bash
npm run import:csv       # Import real CSV data (recommended)
npm run migrate:from-base44  # Alternative import method
```

### Development
```bash
npm run dev              # Start dev server
npm run build            # Build for production
npm run preview          # Preview production build
npm run lint             # Check code
npm run lint:fix         # Fix code issues
```

## 🗄️ Database Options

### Cloud (Recommended)
- **[Supabase](https://supabase.com)** - Free tier, built-in auth, backups
- **[Railway](https://railway.app)** - One-click setup, can host app too
- **[Neon](https://neon.tech)** - Serverless PostgreSQL, auto-scaling

### Local
- **[PostgreSQL](https://postgresql.org)** - Full control, no internet needed

## 📝 Migration Steps

### Phase 1: Setup (30 minutes)
1. Choose and setup database
2. Install dependencies
3. Configure environment
4. Create schema

### Phase 2: Import Data (15 minutes)
1. Verify CSV files exist
2. Run import script
3. Verify in Prisma Studio

### Phase 3: Update Code (4-6 hours)
1. Replace Base44 imports
2. Update function code
3. Change field names (snake_case → camelCase)
4. Update enum values

### Phase 4: Testing (4 hours)
1. Test all CRUD operations
2. Test user workflows
3. Test integrations (Stripe, Email)
4. Fix any issues

### Phase 5: Deploy (2-3 hours)
1. Setup production database
2. Run migrations
3. Deploy application
4. Monitor and optimize

**Total Time: ~12-16 hours** (spread over 1-2 weeks)

## 🔄 Code Changes Required

### Before (Base44)
```javascript
import { createClientFromRequest } from '@base44/sdk';

const base44 = createClientFromRequest(req);
const recipients = await base44.entities.Recipient.filter({
  subscriber_id: 'xxx'
});
```

### After (Prisma)
```javascript
import prisma from './src/lib/db.js';

const recipients = await prisma.recipient.findMany({
  where: {
    subscriberId: 'xxx'
  }
});
```

See **[FUNCTION_UPDATE_EXAMPLE.md](FUNCTION_UPDATE_EXAMPLE.md)** for detailed examples.

## ✨ Benefits

| Before (Base44) | After (PostgreSQL) |
|-----------------|-------------------|
| Vendor lock-in | ✅ Full ownership |
| Limited control | ✅ Complete flexibility |
| Fixed pricing | ✅ Pay what you use |
| Black box | ✅ Full visibility |
| Proprietary | ✅ Open source |

## 📚 Tech Stack

- **Database**: PostgreSQL 14+
- **ORM**: Prisma 5.x
- **Frontend**: React 18 + Vite
- **UI**: Radix UI + Tailwind CSS
- **Payments**: Stripe
- **Email**: Resend API
- **AI**: OpenAI API

## 🆘 Troubleshooting

### "Can't connect to database"
→ Check `DATABASE_URL` in `.env`
→ Test: `npx prisma db execute --stdin <<< "SELECT 1"`

### "Module not found"
→ Run `npm install`
→ Ensure Node 18+ is installed

### "Import failed"
→ Verify CSV files in `database-csv/` folder
→ Check error messages in console
→ Review **[IMPORT_YOUR_DATA.md](IMPORT_YOUR_DATA.md)**

### "Foreign key constraint failed"
→ Import creates missing users automatically
→ Some orphaned records may be skipped (normal)

## 📈 Success Criteria

Migration is successful when:

✅ All CSV data imported
✅ Prisma Studio shows your data
✅ App runs with new database
✅ All features work correctly
✅ Tests pass
✅ Performance is good
✅ You can remove `@base44/sdk`

## 🎯 Next Actions

1. **Right Now**: Read **[START_HERE.md](START_HERE.md)**
2. **Today**: Follow **[IMPORT_YOUR_DATA.md](IMPORT_YOUR_DATA.md)**
3. **This Week**: Update code using **[FUNCTION_UPDATE_EXAMPLE.md](FUNCTION_UPDATE_EXAMPLE.md)**
4. **Next Week**: Test and deploy

## 📞 Support

- **Documentation**: Check the guide files in this folder
- **Prisma Docs**: https://www.prisma.io/docs
- **PostgreSQL Docs**: https://www.postgresql.org/docs
- **Issues**: Review error logs and documentation

## 📄 License

Private commercial project.

## 👥 Credits

Migration package created for "You Remembered By Gem" gift recommendation service.

---

**Ready to migrate?** Open **[START_HERE.md](START_HERE.md)** and let's go! 🚀
