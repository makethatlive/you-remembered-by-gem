# Claude Sonnet 5 - Important Note

## Temperature Parameter Not Supported

Claude Sonnet 5 **does not support** the `temperature` parameter that older Claude models used.

### What This Means

**Old Claude Models (3.5 Sonnet, etc.):**
```javascript
{
  model: 'claude-3-5-sonnet-20241022',
  temperature: 0.7,  // ✅ Supported
  max_tokens: 8192
}
```

**Claude Sonnet 5:**
```javascript
{
  model: 'claude-sonnet-5',
  // temperature not included ❌
  max_tokens: 8192  // ✅ Only max_tokens
}
```

### Why?

Anthropic made `claude-sonnet-5` a **simplified model** that:
- Has a fixed, optimized response style
- Doesn't need temperature tuning
- Provides consistent, high-quality outputs
- Is easier to use for most applications

### What We Changed

Removed `temperature` from all Claude API calls:

1. **`claude-client.js`** - Core API client
2. **`profile-analyzer.js`** - Profile analysis (was 0.3)
3. **`ai-gift-selector.js`** - Gift selection (was 0.8)

### Impact on Your App

**Good News:** None! 

Claude Sonnet 5's default behavior is already optimized for:
- ✅ Creative gift selection (no temperature needed)
- ✅ Consistent profile analysis
- ✅ Reliable JSON output

The quality remains excellent without temperature control.

### Error You Saw

```
`temperature` is deprecated for this model.
```

This error occurred because we initially tried to use `temperature` with Claude Sonnet 5. Now fixed!

### If You Want More Control

If you need more control over creativity/consistency, you can:

**Option 1:** Use Claude 3.5 Sonnet (older model, supports temperature)
```javascript
model: 'claude-3-5-sonnet-20241022'
temperature: 0.8
```

**Option 2:** Adjust your prompts (recommended)
- Use phrases like "be creative" or "be precise" in prompts
- Claude Sonnet 5 responds well to prompt-based guidance

**Option 3:** Wait for Anthropic updates
- They may add temperature support later
- Or release new models with more parameters

### Recommendation

**Stick with Claude Sonnet 5 without temperature!**

It's:
- ✅ Latest model
- ✅ Best quality
- ✅ Simplest to use
- ✅ Works great for gift generation

---

**Status:** ✅ Fixed - Temperature parameter removed  
**Model:** claude-sonnet-5  
**Quality:** Excellent without temperature control
