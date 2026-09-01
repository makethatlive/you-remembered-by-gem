# How to Update Base44 Functions to Prisma

This guide shows you how to convert your Base44 functions to use Prisma.

## Before and After Comparison

### Example 1: Simple Query

**Before (Base44):**
```javascript
import { createClientFromRequest } from '@base44/sdk';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const svc = base44.asServiceRole;
  
  const recipients = await svc.entities.Recipient.filter({
    subscriber_id: 'xxx'
  });
  
  return Response.json({ recipients });
});
```

**After (Prisma):**
```javascript
import prisma from '../../lib/db.js';

export default async function handler(req, res) {
  try {
    const recipients = await prisma.recipient.findMany({
      where: {
        subscriberId: 'xxx'
      }
    });
    
    res.json({ recipients });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
```

### Example 2: Create Record

**Before (Base44):**
```javascript
const newList = await svc.entities.GiftList.create({
  recipient_id: recipientId,
  subscriber_id: subscriberId,
  status: 'generating',
  list_type: 'curated'
});
```

**After (Prisma):**
```javascript
const newList = await prisma.giftList.create({
  data: {
    recipientId: recipientId,
    subscriberId: subscriberId,
    subscriberUserId: userId,
    status: 'GENERATING',
    listType: 'CURATED'
  }
});
```

### Example 3: Update Record

**Before (Base44):**
```javascript
await svc.entities.Product.update(productId, {
  status: 'active',
  last_verified: today()
});
```

**After (Prisma):**
```javascript
await prisma.product.update({
  where: { id: productId },
  data: {
    status: 'ACTIVE',
    lastVerified: new Date()
  }
});
```

### Example 4: Complex Query with Relations

**Before (Base44):**
```javascript
const giftLists = await svc.entities.GiftList.filter({
  status: 'pending_approval',
  visible_to_subscriber: false
}, {
  include: ['recipient', 'giftItems']
});
```

**After (Prisma):**
```javascript
const giftLists = await prisma.giftList.findMany({
  where: {
    status: 'PENDING_APPROVAL',
    visibleToSubscriber: false
  },
  include: {
    recipient: true,
    giftItems: {
      include: {
        product: true
      }
    }
  }
});
```

### Example 5: Counting Records

**Before (Base44):**
```javascript
const count = await svc.entities.Product.count({
  status: 'active',
  retailer_id: retailerId
});
```

**After (Prisma):**
```javascript
const count = await prisma.product.count({
  where: {
    status: 'ACTIVE',
    retailerId: retailerId
  }
});
```

### Example 6: Batch Create

**Before (Base44):**
```javascript
for (const item of items) {
  await svc.entities.GiftItem.create(item);
}
```

**After (Prisma):**
```javascript
await prisma.giftItem.createMany({
  data: items,
  skipDuplicates: true
});
```

### Example 7: Transaction

**Before (Base44):**
```javascript
// Base44 handles this internally
const list = await svc.entities.GiftList.create(listData);
const items = await Promise.all(
  itemsData.map(item => svc.entities.GiftItem.create(item))
);
```

**After (Prisma):**
```javascript
const result = await prisma.$transaction(async (tx) => {
  const list = await tx.giftList.create({
    data: listData
  });
  
  const items = await tx.giftItem.createMany({
    data: itemsData.map(item => ({
      ...item,
      giftListId: list.id
    }))
  });
  
  return { list, items };
});
```

## Key Differences

### 1. Field Naming Convention

Base44 uses `snake_case`, Prisma uses `camelCase`:

| Base44 | Prisma |
|--------|--------|
| `recipient_id` | `recipientId` |
| `subscriber_user_id` | `subscriberUserId` |
| `gift_list_id` | `giftListId` |
| `last_verified` | `lastVerified` |
| `created_at` | `createdAt` |

### 2. Enum Values

Base44 uses lowercase strings, Prisma uses UPPERCASE:

| Base44 | Prisma |
|--------|--------|
| `"admin"` | `"ADMIN"` |
| `"active"` | `"ACTIVE"` |
| `"pending_approval"` | `"PENDING_APPROVAL"` |
| `"curated"` | `"CURATED"` |

### 3. Query Methods

| Base44 | Prisma |
|--------|--------|
| `.filter()` | `.findMany()` |
| `.get()` | `.findUnique()` |
| `.create()` | `.create({ data: ... })` |
| `.update(id, data)` | `.update({ where: { id }, data })` |
| `.delete()` | `.delete({ where: { id } })` |
| `.count()` | `.count()` |

### 4. Including Relations

**Base44:**
```javascript
{ include: ['recipient', 'subscriber'] }
```

**Prisma:**
```javascript
{
  include: {
    recipient: true,
    subscriber: true
  }
}
```

### 5. Authentication

**Base44:**
```javascript
const user = await base44.auth.me();
if (user.role !== 'admin') {
  return Response.json({ error: 'Forbidden' }, { status: 403 });
}
```

**After (Custom Auth Middleware):**
```javascript
// You'll need to implement your own auth
import { verifyToken } from '../auth/jwt.js';

const token = req.headers.authorization?.replace('Bearer ', '');
const user = await verifyToken(token);

if (!user || user.role !== 'ADMIN') {
  return res.status(403).json({ error: 'Forbidden' });
}
```

## Step-by-Step Function Conversion

1. **Replace imports:**
   ```javascript
   // Remove
   import { createClientFromRequest } from '@base44/sdk';
   
   // Add
   import prisma from '../../lib/db.js';
   ```

2. **Update query syntax:**
   - Change `svc.entities.EntityName` to `prisma.entityName`
   - Add `where` and `data` objects
   - Update field names to camelCase
   - Update enum values to UPPERCASE

3. **Handle authentication:**
   - Implement your own auth middleware
   - Check user permissions
   - Return appropriate error responses

4. **Update error handling:**
   ```javascript
   try {
     // Your code
   } catch (error) {
     console.error('Error:', error);
     res.status(500).json({ error: error.message });
   }
   ```

5. **Test thoroughly:**
   - Test all CRUD operations
   - Verify relations work correctly
   - Check error handling
   - Test with real data

## Common Pitfalls

### ❌ Wrong: Using Base44 syntax
```javascript
await prisma.recipient.create({
  name: 'John',
  subscriber_id: 'xxx'  // Wrong: snake_case
});
```

### ✅ Right: Using Prisma syntax
```javascript
await prisma.recipient.create({
  data: {
    name: 'John',
    subscriberId: 'xxx'  // Correct: camelCase
  }
});
```

### ❌ Wrong: Missing 'data' wrapper
```javascript
await prisma.product.update({
  where: { id: productId },
  status: 'ACTIVE'  // Wrong: missing data wrapper
});
```

### ✅ Right: With 'data' wrapper
```javascript
await prisma.product.update({
  where: { id: productId },
  data: {
    status: 'ACTIVE'  // Correct: wrapped in data
  }
});
```

## Testing Your Converted Functions

```javascript
// Test script
import prisma from './src/lib/db.js';

async function testFunction() {
  try {
    // Test your converted function
    const result = await yourConvertedFunction({ /* params */ });
    console.log('✅ Success:', result);
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testFunction();
```

## Need Help?

- Check the [Prisma Documentation](https://www.prisma.io/docs)
- See the full [Migration Guide](./MIGRATION_GUIDE.md)
- Review [Quick Start Guide](./QUICK_START.md)
