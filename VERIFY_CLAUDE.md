# Verify Claude Integration

Use this guide to verify that your Claude AI integration is working correctly.

## Quick Verification Steps

### Step 1: Check Environment Configuration

Open your `.env` file and verify:

```bash
# Should be set (with your actual key)
ANTHROPIC_API_KEY="sk-ant-api03-YOUR_KEY_HERE"

# Should be commented out or removed
# GEMINI_API_KEY="..."
```

**✅ Pass Criteria**: `ANTHROPIC_API_KEY` is set with a key starting with `sk-ant-`

---

### Step 2: Verify Package Installation

Check that the Anthropic SDK is installed:

```bash
npm list @anthropic-ai/sdk
```

**Expected Output**:
```
you-remembered-by-gem@1.0.0
└── @anthropic-ai/sdk@0.123.0
```

**✅ Pass Criteria**: Package is installed (any 0.x version is fine)

---

### Step 3: Start the Server

```bash
npm run server
```

**Expected Output**:
```
🚀 Server is running on http://localhost:3001
✅ Database connected successfully
📦 Ready to accept requests
```

**✅ Pass Criteria**: Server starts without errors mentioning Gemini or missing API keys

---

### Step 4: Test API Key Validation

Try generating a gift list with a test recipient. The server should:

**If API key is missing:**
```json
{
  "error": "Claude API key not configured",
  "message": "Please add ANTHROPIC_API_KEY to your .env file..."
}
```

**If API key is invalid format:**
```json
{
  "error": "Invalid Claude API key format",
  "message": "Your API key should start with 'sk-ant-'..."
}
```

**If API key is valid:**
Server proceeds to gift generation (see Step 5)

**✅ Pass Criteria**: Error messages mention Claude (not Gemini)

---

### Step 5: Generate a Test Gift List

#### Via Admin Dashboard (Recommended)
1. Open http://localhost:5173 in your browser
2. Navigate to Admin Dashboard
3. Go to Recipients tab
4. Select a recipient with a complete profile
5. Click "Generate Gift List"
6. Watch the console output

#### Via API (Alternative)
```bash
curl -X POST http://localhost:3001/api/generate-gift-list \
  -H "Content-Type: application/json" \
  -d '{
    "recipient_id": "YOUR_RECIPIENT_ID",
    "list_type": "curated"
  }'
```

**Expected Console Output**:
```
🎁 Generating gift list for recipient: abc-123-def
📝 List type: curated
📅 Days until: not specified
🤖 Initializing Claude AI client...
✅ Gift list generated successfully!
   - Status: pending_approval
   - Items: 5
   - Candidates evaluated: 47
```

**✅ Pass Criteria**: 
- Console shows "Initializing Claude AI client" (not Gemini)
- Gift list generates successfully
- 5 gifts are selected

---

### Step 6: Verify Gift Quality

Check the generated gift list in your database or admin dashboard:

**What to Look For**:
1. **5 gifts selected**: Not fewer, not more
2. **Personalized explanations**: Each gift has a "why_this_gift" with 2+ sentences
3. **Variety**: Different types of gifts (not all jewelry, not all wine, etc.)
4. **Budget compliance**: All gifts within recipient's budget range
5. **Interest alignment**: Gifts match recipient's stated interests

**✅ Pass Criteria**: All 5 criteria above are met

---

### Step 7: Test Profile Analysis

Profile analysis should work with caching:

**First Generation (for a recipient)**:
- Should call Claude API to derive profile
- Console shows profile analysis activity
- `derivedProfile` is saved to database

**Second Generation (same recipient, unchanged profile)**:
- Should NOT call Claude API (uses cache)
- Much faster generation
- Console shows "Using cached profile"

**✅ Pass Criteria**: Second generation is faster and uses cached profile

---

## Common Issues & Solutions

### Issue 1: "Cannot find module 'claude-client.js'"

**Problem**: File path issue  
**Solution**: Verify `server/services/ai/claude-client.js` exists  
**Check**: File should be exactly at this path

---

### Issue 2: "Invalid API Key"

**Problem**: API key format or validity issue  
**Solutions**:
1. Verify key starts with `sk-ant-`
2. Check for extra spaces or line breaks
3. Ensure quotes are correct: `ANTHROPIC_API_KEY="sk-ant-..."`
4. Regenerate key in Anthropic Console if needed

---

### Issue 3: "Rate Limit Exceeded"

**Problem**: Too many API calls too quickly  
**Solutions**:
1. Wait 60 seconds and try again
2. Check your usage in Anthropic Console
3. Ensure you're not in a loop

---

### Issue 4: "Insufficient Credits"

**Problem**: No API credits remaining  
**Solutions**:
1. Check balance in Anthropic Console: https://console.anthropic.com/
2. Add payment method if needed
3. New accounts get $5 free credits

---

### Issue 5: Poor Gift Quality

**Problem**: Gifts don't match recipient well  
**Possible Causes**:
1. Incomplete recipient profile
2. Limited product database
3. Very specific requirements

**Solutions**:
1. Ensure recipient has detailed interests, personality, etc.
2. Import more products
3. Adjust budget range

---

## Verification Checklist

Use this checklist to confirm everything is working:

- [ ] ✅ `.env` file has `ANTHROPIC_API_KEY` set
- [ ] ✅ `@anthropic-ai/sdk` package is installed
- [ ] ✅ Server starts without Gemini-related errors
- [ ] ✅ Error messages reference Claude (not Gemini)
- [ ] ✅ Console shows "Initializing Claude AI client"
- [ ] ✅ Gift lists generate successfully
- [ ] ✅ 5 gifts are selected per list
- [ ] ✅ "why_this_gift" explanations are personalized
- [ ] ✅ Gifts show variety (different types)
- [ ] ✅ Gifts respect budget constraints
- [ ] ✅ Profile caching works (faster 2nd generation)
- [ ] ✅ No "Gemini" references in console output

---

## Performance Benchmarks

### Expected Timings

**Full Gift Generation** (Cold Start):
- Profile Analysis: ~2-3 seconds
- Product Matching: ~1 second  
- AI Gift Selection: ~3-5 seconds
- **Total**: ~6-9 seconds

**Cached Profile** (Warm Start):
- Profile Analysis: ~0 seconds (cached)
- Product Matching: ~1 second
- AI Gift Selection: ~3-5 seconds
- **Total**: ~4-6 seconds

**✅ Good Performance**: Generation completes in 6-10 seconds  
**⚠️ Review Needed**: Generation takes >15 seconds  
**❌ Issue**: Generation fails or takes >30 seconds

---

## API Usage Monitoring

### Check Your Usage

1. Visit: https://console.anthropic.com/
2. Navigate to "Usage" section
3. Monitor your API calls and spending

### Typical Usage

**Per Gift List**:
- Input tokens: ~1,500-2,500
- Output tokens: ~500-1,000
- Cost: ~$0.03-$0.08

**Daily Usage** (10 gift lists):
- Total tokens: ~20,000-35,000
- Cost: ~$0.30-$0.80

**Monthly Usage** (300 gift lists):
- Total tokens: ~600,000-1,000,000
- Cost: ~$9-$24

---

## Success Indicators

You'll know everything is working when:

✅ Server starts mentioning "Claude" in logs  
✅ Gift lists generate in 6-10 seconds  
✅ 5 diverse, personalized gifts per list  
✅ "why_this_gift" explanations are thoughtful  
✅ Profile caching speeds up repeat generations  
✅ No errors in console  
✅ API usage appears in Anthropic Console  

---

## Need Help?

### Debug Mode
Enable more detailed logging by setting in `.env`:
```env
NODE_ENV="development"
```

### Check Logs
Server logs show detailed error information in development mode.

### Test API Directly
Test Claude API outside your app:

```javascript
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: 'YOUR_KEY_HERE'
});

const response = await client.messages.create({
  model: 'claude-sonnet-5',
  max_tokens: 100,
  messages: [{ role: 'user', content: 'Hello!' }]
});

console.log(response);
```

**✅ If this works**: API key is valid, issue is in your app  
**❌ If this fails**: API key issue, check Anthropic Console

---

**Verification Complete?** 🎉  
If all checks pass, your Claude integration is working perfectly!
