# Gemini AI Gift Generation Setup

This application now uses Google's Gemini API for intelligent gift recommendation and curation, completely replacing Base44 functionality.

## Architecture Overview

The gift generation system is built with a clean, modular architecture:

```
server/
├── services/
│   ├── ai/
│   │   └── gemini-client.js         # Core Gemini API wrapper
│   └── gifts/
│       ├── profile-analyzer.js       # AI-powered profile analysis
│       ├── product-matcher.js        # Product matching engine
│       ├── ai-gift-selector.js       # AI gift curation
│       └── gift-list-generator.js    # Main orchestrator
```

### Service Responsibilities

1. **GeminiClient** (`services/ai/gemini-client.js`)
   - Handles all Gemini API communication
   - Supports structured JSON responses
   - Error handling and retry logic
   - Reusable across all AI features

2. **ProfileAnalyzer** (`services/gifts/profile-analyzer.js`)
   - Derives structured insights from recipient profiles
   - Caches results to minimize API calls
   - Extracts interests, gift types, persona keywords
   - Uses hash-based cache invalidation

3. **ProductMatcher** (`services/gifts/product-matcher.js`)
   - Matches products to recipient profiles
   - Scores products based on multiple factors
   - Budget-aware filtering
   - Returns ranked candidates

4. **AIGiftSelector** (`services/gifts/ai-gift-selector.js`)
   - Uses Gemini AI to select best gifts
   - Generates personalized explanations
   - Ensures variety across selections
   - Fallback logic for reliability

5. **GiftListGenerator** (`services/gifts/gift-list-generator.js`)
   - Orchestrates the entire generation flow
   - Manages database persistence
   - Handles list creation and item storage
   - Comprehensive error handling

## Setup Instructions

### 1. Get Your Free Gemini API Key

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the generated key

### 2. Configure Environment Variables

Add your Gemini API key to `.env`:

```bash
GEMINI_API_KEY="AIzaSy..."
```

### 3. Test the Setup

Run the server:

```bash
npm run server
```

You should see:
```
🚀 API Server running on http://localhost:3001
📊 Database: PostgreSQL via Prisma
✨ Ready to serve data from your PostgreSQL database!
```

### 4. Generate Your First Gift List

From the admin panel:
1. Navigate to a subscriber
2. Click "Generate Gifts" next to a recipient
3. Watch the AI create a personalized gift list!

## API Endpoint

### POST /api/generate-gift-list

Generate a personalized gift list for a recipient.

**Request Body:**
```json
{
  "recipient_id": "string (required)",
  "list_type": "curated | birthday | christmas",
  "days_until": number,
  "exclude_product_ids": ["string[]"],
  "supersedes_list_id": "string"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "pending_approval",
    "message": "Gift list generated successfully",
    "giftList": {
      "id": "string",
      "status": "pending_approval",
      "itemCount": 5
    },
    "recipient": {
      "id": "string",
      "name": "string"
    },
    "stats": {
      "candidatesEvaluated": 47,
      "giftsSelected": 5,
      "aiStrategy": "Personalized selection strategy..."
    }
  }
}
```

## How It Works

### Step 1: Profile Analysis
The system analyzes the recipient's profile to extract structured insights:
- Canonical interests from free-form text
- Gift type preferences
- Persona keywords for matching
- Categories to avoid
- Life stage summary

This step is **cached** - unchanged profiles cost zero AI calls!

### Step 2: Product Matching
The matcher scores products based on:
- Interest alignment (18 points)
- Gift type fit (14 points)
- Persona keyword matches (up to 20 points)
- Budget preference (5 points)
- Quality score
- Penalty for avoided categories (-50 points)

### Step 3: AI Selection
Gemini reviews the top candidates and selects the best 5 gifts:
- Ensures variety (not all jewelry, not all wine)
- Matches personality and life stage
- Provides personalized "why this gift" explanations
- Considers the occasion and relationship

### Step 4: Database Persistence
The selected gifts are saved as a GiftList with:
- Individual GiftItems for each selection
- Match scores and signals
- AI-generated explanations
- Status tracking (pending_approval → approved → sent)

## Cost Optimization

The system minimizes API costs through:

1. **Profile Caching**: Hash-based caching means unchanged profiles never re-analyze
2. **Batch Processing**: Products are pre-filtered before AI selection
3. **Efficient Prompts**: Structured schemas reduce token usage
4. **Fallback Logic**: Simple scoring when AI isn't available

### Free Tier Limits

Gemini offers generous free tier limits:
- **15 requests per minute**
- **1,500 requests per day**
- **1 million tokens per minute**

For typical usage:
- Profile analysis: ~500 tokens per recipient
- Gift selection: ~2,000 tokens per list
- **Cost**: Completely FREE for normal usage!

## Monitoring

Check generation logs in the terminal:
```
🎁 Generating gift list for recipient: abc123
Finding products for Sarah Test...
Selecting best gifts from 47 candidates...
Saving gift list to database...
✅ Gift list generated: {...}
```

## Troubleshooting

### Error: "Gemini API key not configured"
- Add `GEMINI_API_KEY` to your `.env` file
- Restart the server

### Error: "No candidate products available"
- Ensure you have active products in the database
- Check that products match the recipient's budget range
- Verify product status is "active"

### Insufficient Selections
- The system needs at least 3 matching products
- Review recipient profile for overly restrictive preferences
- Check product catalogue coverage

### AI Selection Fails
- Falls back to score-based selection automatically
- Check Gemini API quotas
- Verify API key is valid

## Upgrading to Paid Tier

If you need higher limits:
1. Visit [Google Cloud Console](https://console.cloud.google.com/)
2. Enable billing for your project
3. Gemini Pro pricing: **$0.50 per million tokens**
4. Still very affordable for production use!

## Benefits Over Base44

✅ **No vendor lock-in** - Own your AI infrastructure
✅ **Free to use** - Generous free tier from Google
✅ **Full control** - Customize every aspect of generation
✅ **Better performance** - Optimized for your specific use case
✅ **Transparent costs** - Pay-as-you-go with clear pricing
✅ **Easy to maintain** - Clean, modular codebase
✅ **Production-ready** - Robust error handling and fallbacks

## Future Enhancements

Possible improvements:
- Multi-occasion support
- Collaborative filtering
- Image analysis for products
- Trend-based recommendations
- A/B testing different selection strategies
- Real-time availability checking

## Support

For issues or questions:
1. Check the terminal logs
2. Review this documentation
3. Inspect the service code in `server/services/`
4. Test with the `/api/health` endpoint

Happy gifting! 🎁
