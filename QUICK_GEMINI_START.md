# Quick Start: Gemini AI Gift Generation

Get up and running with AI-powered gift recommendations in 3 minutes!

## 🚀 Quick Setup

### 1. Get Your Free API Key (2 minutes)

Visit [https://makersuite.google.com/app/apikey](https://makersuite.google.com/app/apikey)

- Sign in with Google
- Click "Create API Key"
- Copy the key (starts with `AIzaSy...`)

### 2. Add to .env File (30 seconds)

```bash
# Open your .env file and add:
GEMINI_API_KEY="AIzaSy..."
```

### 3. Restart Your Server (30 seconds)

```bash
npm run server
```

## ✅ That's It!

You're now using Gemini AI for gift generation. The system will:

- ✨ Analyze recipient profiles automatically
- 🎯 Match products based on interests
- 🤖 Use AI to select the best gifts
- 💝 Generate personalized explanations

## 📊 How to Use

### In the Admin Panel:

1. Go to **Subscribers**
2. Click on a subscriber
3. Find a recipient
4. Click **"Generate Gifts"**
5. Wait ~10 seconds
6. Review the AI-generated list in **Approvals**!

## 🎁 What the AI Does

```
Your Input:
├─ Recipient: "Sarah, 28, loves yoga and reading"
├─ Budget: £200-500
└─ Occasion: Birthday

AI Output:
├─ Premium yoga mat - "Perfect for her practice"
├─ Book subscription - "Feeds her love of reading"
├─ Wellness retreat voucher - "Combines relaxation & mindfulness"
└─ 2 more personalized gifts with explanations
```

## 💰 Cost

**FREE** for typical usage!

- 1,500 requests/day free
- ~10 requests per gift list
- You can generate **150 gift lists per day** on the free tier

## ❓ Common Questions

**Q: Do I need a credit card?**
A: No! The free tier requires no payment.

**Q: Is my data secure?**
A: Yes. Data goes directly from your server to Google's API. Nothing is stored by Google.

**Q: Can I customize the AI prompts?**
A: Yes! Edit files in `server/services/gifts/` to customize the AI behavior.

**Q: What if the AI fails?**
A: The system has fallbacks. It will use score-based selection automatically.

## 📖 Full Documentation

See [GEMINI_SETUP.md](./GEMINI_SETUP.md) for:
- Architecture details
- API documentation
- Cost optimization tips
- Troubleshooting guide

## 🛠 Troubleshooting

### Server won't start?
```bash
# Make sure you've installed dependencies
npm install

# Check your .env file has GEMINI_API_KEY
cat .env | grep GEMINI
```

### Generation fails?
```bash
# Check the terminal logs for errors
# Common issues:
# - API key not set
# - No products in database
# - Recipient budget too narrow
```

### Need help?
Check `server/services/gifts/gift-list-generator.js` logs in the terminal.

---

**You're all set!** The AI is now powering your gift recommendations. 🎉
