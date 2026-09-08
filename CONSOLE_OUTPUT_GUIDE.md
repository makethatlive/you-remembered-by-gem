# Console Output Guide: What You'll See

## 🎯 Quick Reference

### ✅ Claude Working (GOOD)
```
🤖 ===== CLAUDE API CALL =====
✅ CLAUDE RESPONSE RECEIVED
📊 TOKEN USAGE: (with real numbers)
   Response ID: msg_01... (unique ID from Claude)
   Model Used: claude-sonnet-5
   Estimated Cost: $0.0124
```

### ❌ Fallback Mode (BAD)
```
❌ CLAUDE API ERROR
⚠️  USING FALLBACK SELECTION (No Claude AI)
   Fallback: Score-based selection (AI unavailable)
```

---

## 📋 Step-by-Step: What Happens

### Step 1: Server Start
```bash
npm run server
```
**Output:**
```
🚀 Server is running on http://localhost:3001
✅ Database connected successfully
```

### Step 2: Generate Gift List
Click "Generate" in admin dashboard

**Output:**
```
🎁 Generating gift list for recipient: abc-123
📝 List type: curated
🤖 Initializing Claude AI client...
```
✅ **Good sign:** "Claude AI client" (not Gemini)

### Step 3: Profile Analysis (1st Claude Call)
```
🧠 ===== PROFILE ANALYSIS STARTING =====
   Recipient: Sarah
   Using: Claude AI

🤖 ===== CLAUDE API CALL =====
   Model: claude-sonnet-5        ← Real Claude model
   Temperature: 0.3
   Prompt Length: 1847 chars
```
✅ **Good sign:** Shows Claude API details

### Step 4: Claude Response
```
✅ CLAUDE RESPONSE RECEIVED
   Response ID: msg_01ABC...    ← Unique Claude ID
   Model Used: claude-sonnet-5   ← Confirms model
   Duration: 2347ms              ← Real API time

📊 TOKEN USAGE:
   Input Tokens: 1234           ← Real usage
   Output Tokens: 567
   Total Tokens: 1801
   Estimated Cost: $0.0124      ← Real cost
```
✅ **Perfect!** This proves Claude was called

### Step 5: Gift Selection (2nd Claude Call)
```
🎁 ===== AI GIFT SELECTION STARTING =====
   Using: Claude AI

🤖 ===== CLAUDE API CALL =====
   Model: claude-sonnet-5
   Temperature: 0.8             ← Higher for creativity

✅ CLAUDE RESPONSE RECEIVED
   Response ID: msg_02DEF...    ← Different ID
   Model Used: claude-sonnet-5
   Duration: 4123ms

📊 TOKEN USAGE:
   Input Tokens: 2345
   Output Tokens: 789
   Estimated Cost: $0.0189
```
✅ **Perfect!** Second Claude call successful

### Step 6: Complete
```
✅ AI GIFT SELECTION COMPLETE
   Selected: 5 gifts
   Strategy: Mix of practical...  ← Claude's strategy

✅ Gift list generated successfully!
   - Status: pending_approval
   - Items: 5
   - Total AI Cost: ~$0.0313    ← Combined cost
```

---

## 🚨 Error Scenarios

### Scenario 1: No API Key
```
❌ Error: Claude API key not configured
   Please add ANTHROPIC_API_KEY to .env
```
**Fix:** Add your API key to `.env`

### Scenario 2: Invalid API Key
```
🤖 ===== CLAUDE API CALL =====
❌ CLAUDE API ERROR (after 231ms)
   Error: Invalid API key

❌ AI Gift selection failed
⚠️  USING FALLBACK SELECTION
```
**Fix:** Check API key format (must start with `sk-ant-`)

### Scenario 3: No Credits
```
❌ CLAUDE API ERROR
   Error: Insufficient credits
```
**Fix:** Add payment in Anthropic Console

---

## 🔍 How to Spot the Difference

| Feature | ✅ Claude Working | ❌ Fallback |
|---------|------------------|------------|
| **Headers** | `CLAUDE API CALL` | `FALLBACK SELECTION` |
| **Response ID** | `msg_01ABC...` | None |
| **Model** | `claude-sonnet-5` | None |
| **Tokens** | Real numbers | None |
| **Cost** | `$0.0124` | None |
| **Duration** | 2-5 seconds | Instant |
| **Strategy** | Thoughtful text | "Fallback: Score-based..." |

---

## 💡 Pro Tips

### Tip 1: Watch for Response IDs
Every real Claude call gets a unique ID:
```
Response ID: msg_01ABC123...
```
**No Response ID = Not using Claude!**

### Tip 2: Check Token Counts
Real Claude calls show:
```
📊 TOKEN USAGE:
   Input Tokens: 1234
   Output Tokens: 567
```
**No tokens = Fallback mode!**

### Tip 3: Verify Model Name
Should always show:
```
Model Used: claude-sonnet-5
```
**Different model or missing = Issue!**

### Tip 4: Look at Timing
- **Claude:** 2-5 seconds per call
- **Fallback:** < 100ms (instant)

**Instant = Not using AI!**

### Tip 5: Read the Strategy
Claude writes thoughtful strategies:
```
✅ "Curated a mix of mindful self-care..."
```

Fallback is obvious:
```
❌ "Fallback: Score-based selection (AI unavailable)"
```

---

## 📊 Example Outputs

### Perfect Generation (Both Claude Calls Successful)
```
🤖 Initializing Claude AI client...

[Profile Analysis]
🤖 CLAUDE API CALL → ✅ RESPONSE → 📊 TOKENS: 1801

[Gift Selection]  
🤖 CLAUDE API CALL → ✅ RESPONSE → 📊 TOKENS: 3279

✅ Complete! Total Cost: $0.0313
```

### Partial Failure (Profile works, Selection fails)
```
[Profile Analysis]
🤖 CLAUDE API CALL → ✅ RESPONSE → 📊 TOKENS: 1801

[Gift Selection]
🤖 CLAUDE API CALL → ❌ ERROR
⚠️  FALLBACK SELECTION (score only)
```

### Complete Failure (No Claude at all)
```
❌ Error: Invalid API key
⚠️  Generation aborted
```

---

## ✅ Final Check

Before considering it "working", verify:

1. ✅ See `CLAUDE API CALL` (twice: profile + selection)
2. ✅ See `Response ID: msg_...` (twice)
3. ✅ See `Model Used: claude-sonnet-5` (twice)
4. ✅ See `TOKEN USAGE` with real numbers (twice)
5. ✅ See `Estimated Cost` (twice, totaling ~$0.03)
6. ✅ Duration is 2-5 seconds per call
7. ✅ NO "FALLBACK" warnings
8. ✅ Strategy is thoughtful

**All 8 = Claude is 100% working!** 🎉

---

## 🎯 Quick Test

1. Start server: `npm run server`
2. Generate a gift list
3. Check console for:
   - `CLAUDE API CALL` ✅
   - `Response ID: msg_...` ✅
   - `TOKEN USAGE` ✅
   - `Estimated Cost: $...` ✅

**All present = Success!** 🎊
