# Claude Sonnet 5 Configuration

## Model Information

Your application is now configured to use **Claude Sonnet 5**, the latest model from Anthropic.

### Model Identifier
```javascript
model: 'claude-sonnet-5'
```

This is Anthropic's latest model, released in 2024, offering:
- ✨ **Superior Intelligence**: Best-in-class reasoning and comprehension
- 🎯 **Excellent JSON Output**: Highly reliable structured data generation
- 💡 **Creative & Thoughtful**: Perfect for personalized gift recommendations
- ⚡ **Efficient**: Smart, everyday model that balances quality and cost

### Where It's Used

**Gift List Generator** (`server/services/gifts/ai-gift-selector.js`)
- Selects 5 personalized gifts from candidates
- Temperature: 0.8 (higher creativity for gift selection)
- Max tokens: 4096

**Profile Analyzer** (`server/services/gifts/profile-analyzer.js`)
- Derives structured insights from recipient profiles
- Temperature: 0.3 (lower for consistent analysis)
- Max tokens: 8192

**Product Scraper** (`server/services/scraper/extraction/ai-extractor.js`)
- Extracts product data from HTML when structured data unavailable
- Temperature: 0.7 (default)
- Max tokens: 8192

### Model Comparison

| Model | Best For | Speed | Quality | Cost |
|-------|----------|-------|---------|------|
| claude-sonnet-5 | Everyday tasks (⭐ We use this) | Fast | Excellent | Moderate |
| claude-opus-5 | Complex challenges | Slower | Best | Higher |
| claude-haiku-4-5 | Simple tasks | Fastest | Good | Lower |

### Why Claude Sonnet 5?

We chose Claude Sonnet 5 because it offers:

1. **Perfect Balance**: Best quality-to-cost ratio for gift generation
2. **Reliable Output**: Excellent at following JSON schemas
3. **Creative Yet Consistent**: High enough quality for personalized recommendations
4. **Fast Enough**: Quick response times for good user experience
5. **Latest Features**: Access to Anthropic's newest capabilities

### Performance Expectations

**Response Times**:
- Gift selection: 3-5 seconds
- Profile analysis: 2-3 seconds
- Product extraction: 2-4 seconds

**Token Usage** (per gift list):
- Input: ~1,500-2,500 tokens
- Output: ~500-1,000 tokens
- Total cost: ~$0.03-$0.08

### Alternative Models

If you want to experiment with different models, you can override the default in the service options:

**For More Complex Scenarios** (Higher quality, slower):
```javascript
const response = await this.claudeClient.generateStructuredContent(
  prompt,
  schema,
  { 
    model: 'claude-opus-5',  // Use Opus instead
    temperature: 0.8,
    maxOutputTokens: 4096 
  }
);
```

**For Simpler Tasks** (Faster, cheaper):
```javascript
const response = await this.claudeClient.generateStructuredContent(
  prompt,
  schema,
  { 
    model: 'claude-haiku-4-5',  // Use Haiku instead
    temperature: 0.7,
    maxOutputTokens: 2048 
  }
);
```

### Updating the Model

To change the default model, edit `server/services/ai/claude-client.js`:

```javascript
async generateStructuredContent(prompt, schema, options = {}) {
  const {
    model = 'claude-sonnet-5',  // ← Change this default
    temperature = 0.7,
    maxOutputTokens = 8192,
  } = options;
  // ...
}
```

---

**Current Configuration**: ✅ Claude Sonnet 5  
**Status**: Optimized for gift generation quality and cost  
**Recommendation**: Keep this configuration unless you have specific needs for different models
