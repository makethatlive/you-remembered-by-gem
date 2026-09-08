# How to Get Your Claude API Key

This guide will help you obtain an API key from Anthropic to use Claude AI for gift generation.

## Step-by-Step Instructions

### 1. Visit Anthropic Console
Go to: **https://console.anthropic.com/**

### 2. Create an Account (or Log In)
- Click "Sign Up" if you don't have an account
- Or click "Log In" if you already have one
- You can sign up with:
  - Email address
  - Google account
  - GitHub account

### 3. Access API Keys Section
Once logged in:
1. Look for the **"API Keys"** section in the left sidebar
2. Click on "API Keys"

### 4. Create a New API Key
1. Click the **"Create Key"** or **"+ Create API Key"** button
2. Give your key a descriptive name (e.g., "You Remembered Gift App")
3. Click "Create Key"

### 5. Copy Your API Key
⚠️ **IMPORTANT**: Copy your API key immediately!
- The key starts with `sk-ant-`
- It will only be shown once
- Store it securely - you won't be able to see it again

Example format:
```
sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 6. Add to Your .env File
Open your `.env` file and add:

```env
ANTHROPIC_API_KEY="sk-ant-api03-YOUR_KEY_HERE"
```

Replace `sk-ant-api03-YOUR_KEY_HERE` with your actual key.

## Pricing Information

### Free Tier
- Anthropic offers **$5 in free credits** for new accounts
- This is enough to test and generate many gift lists
- Perfect for development and initial testing

### Usage Tracking
- Monitor your usage in the Anthropic Console
- Go to "Usage" section to see your spending
- Set up billing alerts to avoid surprises

### Costs (as of 2024)
For Claude Sonnet 5 (the model we use):
- **Input**: ~$3 per million tokens
- **Output**: ~$15 per million tokens

**Typical gift list generation:**
- Uses ~2,000-5,000 tokens per list
- Cost: $0.03-$0.10 per complete gift list
- Very affordable for production use!

## Security Best Practices

### ✅ DO:
- Store API keys in `.env` files (never in code)
- Add `.env` to `.gitignore`
- Use environment variables in production
- Rotate keys regularly
- Set up usage limits and alerts

### ❌ DON'T:
- Commit API keys to Git repositories
- Share keys in public forums or screenshots
- Use the same key across multiple projects
- Hardcode keys in your application code

## Troubleshooting

### "Invalid API Key" Error
**Problem**: Key is not recognized  
**Solution**: 
- Verify key starts with `sk-ant-`
- Check for extra spaces or quotes
- Ensure you copied the entire key

### "Rate Limit Exceeded" Error
**Problem**: Too many requests too quickly  
**Solution**:
- Add delays between requests
- Contact Anthropic support for rate limit increase

### "Insufficient Credits" Error
**Problem**: No credits remaining  
**Solution**:
- Add billing information in Anthropic Console
- Purchase additional credits
- Check your usage limits

## Getting Help

### Anthropic Support
- Email: support@anthropic.com
- Documentation: https://docs.anthropic.com/
- Discord Community: https://discord.gg/anthropic

### Check API Status
Visit: https://status.anthropic.com/

## Quick Start Checklist

- [ ] Create Anthropic account
- [ ] Generate API key
- [ ] Copy key (starts with `sk-ant-`)
- [ ] Add to `.env` file as `ANTHROPIC_API_KEY`
- [ ] Verify `.env` is in `.gitignore`
- [ ] Test by generating a gift list
- [ ] Set up billing alerts (optional)

## Comparison with Gemini

| Feature | Gemini | Claude |
|---------|--------|--------|
| Free Tier | Yes (generous) | $5 free credits |
| Key Format | `AIzaSy...` | `sk-ant-...` |
| Setup | Google account | Anthropic account |
| Quality | Good | Excellent |
| Best For | Quick testing | Production use |

---

**Ready to start?** Visit [console.anthropic.com](https://console.anthropic.com/) now! 🚀
