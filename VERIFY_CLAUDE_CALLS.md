# How to Verify Claude AI is Actually Being Used

This guide shows you **exactly** how to confirm Claude AI is being called (not fallback) when generating gift lists.

## 🔍 What to Look For in Console

When you generate a gift list, you'll see **detailed logs** showing every Claude API call.

### ✅ GOOD: Claude is Working

When Claude AI is working correctly, your console will show:

```
🎁 Generating gift list for recipient: abc-123-def
📝 List type: curated
📅 Days until: not specified
🤖 Initializing Claude AI client...

🧠 ===== PROFILE ANALYSIS STARTING =====
   Recipient: Sarah Johnson
   Profile Hash: 8f7e6d5c
   Using: Claude AI

🤖 ===== CLAUDE API CALL =====
   Model: claude-sonnet-5
   Temperature: 0.3
   Max Tokens: 8192
   Prompt Length: 1847 characters

✅ CLAUDE RESPONSE RECEIVED
   Response ID: msg_01ABC123XYZ...
   Model Used: claude-sonnet-5
   Duration: 2347ms
   Stop Reason: end_turn

📊 TOKEN USAGE:
   Input Tokens: 1234
   Output Tokens: 567
   Total Tokens: 1801
   Estimated Cost: $0.0124

   Response Length: 892 characters
   ✅ JSON parsed successfully
=============================

✅ PROFILE ANALYSIS COMPLETE
   Interests: 5
   Gift Types: 3
   Keywords: 15
==========================================

Finding products for Sarah Johnson...

🎁 ===== AI GIFT SELECTION STARTING =====
   Recipient: Sarah Johnson
   Candidates: 47 products
   Requested: 5 gifts
   Using: Claude AI

🤖 ===== CLAUDE API CALL =====
   Model: claude-sonnet-5
   Temperature: 0.8
   Max Tokens: 4096
   Prompt Length: 3421 characters

✅ CLAUDE RESPONSE RECEIVED
   Response ID: msg_02DEF456ABC...
   Model Used: claude-sonnet-5
   Duration: 4123ms
   Stop Reason: end_turn

📊 TOKEN USAGE:
   Input Tokens: 2345
   Output Tokens: 789
   Total Tokens: 3134
   Estimated Cost: $0.0189

   Response Length: 1243 characters
   ✅ JSON parsed successfully
=============================

✅ AI GIFT SELECTION COMPLETE
   Selected: 5 gifts
   Strategy: Mix of practical and delightful gifts...
==========================================

✅ Gift list generated successfully!
   - Status: pending_approval
   - Items: 5
```

---

### ❌ BAD: Fallback Mode (Claude NOT Used)

If Claude API fails or API key is wrong, you'll see:

```
🎁 Generating gift list for recipient: abc-123-def
🤖 Initializing Claude AI client...

🧠 ===== PROFILE ANALYSIS STARTING =====
   Recipient: Sarah Johnson
   Using: Claude AI

🤖 ===== CLAUDE API CALL =====
   Model: claude-sonnet-5
   ...

❌ CLAUDE API ERROR (after 231ms)
   Error: Invalid API key
=============================

❌ Profile derivation failed: Failed to generate content
   Generation will continue without derived profile

🎁 ===== AI GIFT SELECTION STARTING =====
   ...

❌ AI Gift selection failed: Invalid API key
   Falling back to score-based selection...

⚠️  USING FALLBACK SELECTION (No Claude AI)
   Selecting top 5 by score only
```

**Notice the difference:**
- ❌ Shows errors with "CLAUDE API ERROR"
- ⚠️ Shows "USING FALLBACK SELECTION"
- ❌ No token usage statistics
- ❌ No response IDs from Claude

---

## 🎯 Key Indicators Claude is Working

### 1. Response ID
```
Response ID: msg_01ABC123XYZ...
```
This is Claude's unique identifier. **Only appears if Claude API was called.**

### 2. Model Used
```
Model Used: claude-sonnet-5
```
Confirms the exact model that processed your request.

### 3. Token Usage
```
📊 TOKEN USAGE:
   Input Tokens: 1234
   Output Tokens: 567
   Total Tokens: 1801
   Estimated Cost: $0.0124
```
Real token counts and costs. **Only Claude API returns this.**

### 4. Duration
```
Duration: 2347ms
```
Real API calls take 2-5 seconds. Fallback is instant (<100ms).

### 5. Strategy Description
```
Strategy: Mix of practical and delightful gifts...
```
Claude writes thoughtful strategy. Fallback says: "Fallback: Score-based selection (AI unavailable)"

---

## 📋 Complete Verification Checklist

Run a test gift list generation and check these:

- [ ] ✅ See "CLAUDE API CALL" headers (not just "PROFILE ANALYSIS")
- [ ] ✅ See "Response ID: msg_..." in logs
- [ ] ✅ See "Model Used: claude-sonnet-5"
- [ ] ✅ See token usage with Input/Output counts
- [ ] ✅ See estimated cost (e.g., $0.0124)
- [ ] ✅ Duration is 2-5 seconds (not instant)
- [ ] ✅ No "FALLBACK SELECTION" warnings
- [ ] ✅ No "CLAUDE API ERROR" messages
- [ ] ✅ Strategy is thoughtful (not "Fallback: Score-based...")
- [ ] ✅ "why_this_gift" explanations are personalized (2+ sentences)

**If all checked:** ✅ Claude is working perfectly!  
**If any missing:** ❌ Check API key or review errors

---

## 🧪 Test Scenarios

### Test 1: Valid API Key
**Expected:** All logs show Claude calls, token usage, costs

### Test 2: Invalid API Key
**Expected:** Error messages, fallback warnings, no tokens

### Test 3: No API Key
**Expected:** Error before any AI calls, clear error message

### Test 4: Cached Profile
**Expected:** 
- First generation: 2 Claude calls (profile + selection)
- Second generation (same recipient): 1 Claude call (selection only)
- Log says: "✅ Using cached derived profile"

---

## 💰 Cost Tracking

Every Claude call shows estimated cost:

**Profile Analysis**
```
📊 TOKEN USAGE:
   Input Tokens: ~1,200-1,500
   Output Tokens: ~500-700
   Estimated Cost: ~$0.01
```

**Gift Selection**
```
📊 TOKEN USAGE:
   Input Tokens: ~2,000-2,500
   Output Tokens: ~600-900
   Estimated Cost: ~$0.02
```

**Total per Gift List:** ~$0.03-$0.08

You can verify this matches your Anthropic Console usage!

---

## 🔍 Advanced: Check Anthropic Console

Cross-verify in Anthropic Console:

1. Visit: https://console.anthropic.com/
2. Go to "Usage" section
3. Check recent API calls

You should see:
- **Timestamps** matching your generation times
- **Model:** claude-sonnet-5
- **Token counts** matching console logs
- **Costs** matching estimated costs

**Perfect Match = 100% Confirmed Claude is Working!**

---

## 🚨 Common Issues

### Issue: "Invalid API Key"
**Cause:** API key is wrong or not set  
**Fix:** Check `.env` file, ensure `ANTHROPIC_API_KEY` starts with `sk-ant-`

### Issue: "Rate Limit Exceeded"
**Cause:** Too many requests too quickly  
**Fix:** Wait 60 seconds, then try again

### Issue: "Insufficient Credits"
**Cause:** No API credits remaining  
**Fix:** Add payment method in Anthropic Console

### Issue: No logs appearing
**Cause:** Wrong API key might stop before logging  
**Fix:** Check server starts without errors, verify API key

---

## 📊 Example: Full Console Output

Here's what a **successful** generation looks like:

```bash
$ npm run server

🚀 Server is running on http://localhost:3001

# User clicks "Generate Gift List" in admin dashboard

🎁 Generating gift list for recipient: rec_abc123
📝 List type: curated
🤖 Initializing Claude AI client...

🧠 ===== PROFILE ANALYSIS STARTING =====
   Recipient: Emma Watson
   Profile Hash: a3f2e8d1
   Using: Claude AI

🤖 ===== CLAUDE API CALL =====
   Model: claude-sonnet-5
   Temperature: 0.3
   Max Tokens: 8192
   Prompt Length: 1654 characters

✅ CLAUDE RESPONSE RECEIVED
   Response ID: msg_01H8K9J7F6E5D4C3B2A1
   Model Used: claude-sonnet-5
   Duration: 2156ms
   Stop Reason: end_turn

📊 TOKEN USAGE:
   Input Tokens: 1123
   Output Tokens: 542
   Total Tokens: 1665
   Estimated Cost: $0.0115

   Response Length: 847 characters
   ✅ JSON parsed successfully
=============================

✅ PROFILE ANALYSIS COMPLETE
   Interests: 6
   Gift Types: 4
   Keywords: 18
==========================================

Finding products for Emma Watson...
   Budget: £20-£80
   Age: 25-34
   Interests: Wellness, Art, Reading

Product matching: Found 47 candidates

🎁 ===== AI GIFT SELECTION STARTING =====
   Recipient: Emma Watson
   Candidates: 47 products
   Requested: 5 gifts
   Using: Claude AI

🤖 ===== CLAUDE API CALL =====
   Model: claude-sonnet-5
   Temperature: 0.8
   Max Tokens: 4096
   Prompt Length: 3789 characters

✅ CLAUDE RESPONSE RECEIVED
   Response ID: msg_02X9Y8W7V6U5T4S3R2Q1
   Model Used: claude-sonnet-5
   Duration: 3892ms
   Stop Reason: end_turn

📊 TOKEN USAGE:
   Input Tokens: 2456
   Output Tokens: 823
   Total Tokens: 3279
   Estimated Cost: $0.0197

   Response Length: 1456 characters
   ✅ JSON parsed successfully
=============================

✅ AI GIFT SELECTION COMPLETE
   Selected: 5 gifts
   Strategy: Curated a mix of mindful self-care items and artistic inspiration...
==========================================

Saving gift list to database...

✅ Gift list generated successfully!
   - Status: pending_approval
   - Items: 5
   - Candidates evaluated: 47
   - Total AI Cost: ~$0.0312
```

**This is what success looks like! 🎉**

---

## ✅ Final Verification

To be **absolutely certain** Claude is working:

1. **Console Logs:** See detailed Claude API calls with response IDs
2. **Token Usage:** Real token counts and costs displayed
3. **Duration:** API calls take 2-5 seconds each
4. **Quality:** Gift explanations are thoughtful and personal
5. **Anthropic Console:** Usage matches your console logs
6. **No Fallback:** Zero "FALLBACK SELECTION" warnings

**All 6 checks pass = Claude is 100% working!** ✨

---

**Ready to test?** Generate a gift list and watch the console! 🎁
