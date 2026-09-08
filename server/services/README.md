# Services Architecture

This directory contains the modular service layer for the application.

## Directory Structure

```
services/
├── ai/
│   └── gemini-client.js          # Gemini API client
└── gifts/
    ├── profile-analyzer.js        # Recipient profile analysis
    ├── product-matcher.js         # Product matching engine
    ├── ai-gift-selector.js        # AI-powered gift selection
    └── gift-list-generator.js     # Main gift generation orchestrator
```

## Design Principles

### 1. Separation of Concerns
Each service has a single, well-defined responsibility:
- **GeminiClient**: AI API communication only
- **ProfileAnalyzer**: Profile → structured insights
- **ProductMatcher**: Products → scored candidates
- **AIGiftSelector**: Candidates → curated selections
- **GiftListGenerator**: Orchestration + persistence

### 2. Reusability
Services are designed to be:
- Independent of HTTP layer
- Testable in isolation
- Reusable across features
- Easy to extend

### 3. Error Handling
All services implement graceful degradation:
- Profile analysis failure → continue without derived insights
- AI selection failure → fallback to score-based selection
- Database errors → throw with clear messages

### 4. Performance
Optimization strategies:
- **Caching**: Profile analysis cached by hash
- **Batch processing**: Filter before AI selection
- **Efficient queries**: Include relations in single query
- **Token optimization**: Structured schemas minimize tokens

## Service APIs

### GeminiClient

```javascript
const client = new GeminiClient(apiKey);

// Generate structured JSON
const result = await client.generateStructuredContent(
  prompt,
  schema,
  { temperature: 0.7 }
);

// Generate plain text
const text = await client.generateText(
  prompt,
  { maxOutputTokens: 2048 }
);
```

### ProfileAnalyzer

```javascript
const analyzer = new ProfileAnalyzer(geminiClient);

// Derive or retrieve cached profile
const derived = await analyzer.deriveProfile(recipient, prisma);

// Result:
// {
//   canonical_interests: string[],
//   canonical_gift_types: string[],
//   persona_keywords: string[],
//   avoid_categories: string[],
//   life_stage_summary: string
// }
```

### ProductMatcher

```javascript
const matcher = new ProductMatcher();

// Find and score products
const candidates = await matcher.findMatchingProducts(recipient, prisma);

// Each candidate includes:
// - All product data
// - score: number
// - matchSignals: string[]
```

### AIGiftSelector

```javascript
const selector = new AIGiftSelector(geminiClient);

// Select best gifts with AI
const selections = await selector.selectGifts(candidates, recipient, 5);

// Each selection includes:
// - All product data
// - whyThisGift: string (AI explanation)
// - aiStrategy: string
```

### GiftListGenerator

```javascript
const generator = new GiftListGenerator(geminiClient, prisma);

// Full generation pipeline
const result = await generator.generateGiftList({
  recipientId,
  listType,
  daysUntil,
  excludeProductIds,
  supersedesListId,
});

// Returns:
// {
//   status: string,
//   message: string,
//   giftList: {...},
//   recipient: {...},
//   stats: {...}
// }
```

## Adding New Services

### Step 1: Create Service File

```javascript
// services/new-feature/my-service.js

class MyService {
  constructor(dependencies) {
    this.dependency = dependencies;
  }

  async performTask(input) {
    // Implementation
    return result;
  }
}

module.exports = MyService;
```

### Step 2: Add to Orchestrator

```javascript
const MyService = require('./new-feature/my-service');

class Orchestrator {
  constructor() {
    this.myService = new MyService();
  }
}
```

### Step 3: Expose via API

```javascript
// server/index.js
app.post('/api/my-endpoint', async (req, res) => {
  const { default: MyService } = await import('./services/new-feature/my-service.js');
  const service = new MyService();
  const result = await service.performTask(req.body);
  res.json(result);
});
```

## Testing Services

Services are designed to be easily testable:

```javascript
// Example test structure
const GeminiClient = require('./ai/gemini-client');

// Mock Gemini API
const mockClient = {
  generateStructuredContent: async () => ({
    interests: ['Cooking', 'Wine'],
  }),
};

// Test profile analyzer
const analyzer = new ProfileAnalyzer(mockClient);
const result = await analyzer.deriveProfile(recipient, mockPrisma);
```

## Best Practices

### 1. Dependency Injection
Pass dependencies to constructors:
```javascript
// Good
constructor(geminiClient, prisma) {
  this.geminiClient = geminiClient;
  this.prisma = prisma;
}

// Bad - hard to test
constructor() {
  this.geminiClient = new GeminiClient(process.env.GEMINI_API_KEY);
}
```

### 2. Clear Method Names
Use descriptive, action-oriented names:
```javascript
// Good
async deriveProfile(recipient, prisma)
async findMatchingProducts(recipient, prisma)
async selectGifts(candidates, recipient, count)

// Bad
async process(data)
async handle(input)
```

### 3. Comprehensive Error Messages
```javascript
// Good
throw new Error(`No candidate products available for selection`);
throw new Error(`Recipient not found: ${recipientId}`);

// Bad
throw new Error('Failed');
```

### 4. Document Complex Logic
```javascript
/**
 * Score a product against recipient profile
 * 
 * Scoring breakdown:
 * - Quality: 0-10 points
 * - Interest match: 15 points per interest
 * - Gift type: 12 points per type
 * - Keywords: up to 20 points
 * - Budget fit: up to 5 points
 * 
 * @param {object} product - Product data
 * @param {object} recipient - Recipient data
 * @param {object} derived - Derived profile
 * @returns {object} Score and match signals
 */
scoreProduct(product, recipient, derived) {
  // Implementation
}
```

## Performance Monitoring

Services log key operations:
```
🎁 Generating gift list for recipient: abc123
Finding products for Sarah Test...
Selecting best gifts from 47 candidates...
Saving gift list to database...
✅ Gift list generated: {...}
```

Monitor these logs to identify:
- Slow operations
- High token usage
- API failures
- Database bottlenecks

## Future Service Ideas

Consider adding services for:
- **Email Service**: Transactional emails
- **Analytics Service**: Usage tracking
- **Cache Service**: Redis integration
- **Image Service**: Product image validation
- **Notification Service**: Real-time updates
- **Webhook Service**: External integrations

---

**Remember**: Services should be simple, focused, and composable. When in doubt, create a new service rather than expanding an existing one.
