# 🎨 App Branding & Customization

## 📝 App Title & Favicon

### Files Updated:
- ✅ **`index.html`** - Changed title to "You Remembered by Gem"
- ✅ **`public/favicon.svg`** - Created custom gem icon

### Current Settings:

**App Title:** `You Remembered by Gem`
**Favicon:** Gem icon (teal/gold gradient with "G")

---

## 🔧 How to Customize

### Change App Title:

Edit `index.html`:
```html
<title>Your App Name Here</title>
```

### Change Favicon:

**Option 1: Replace the SVG**
Edit `public/favicon.svg` with your own design

**Option 2: Use PNG/ICO**
1. Add your favicon to `public/` folder (e.g., `favicon.png`)
2. Update `index.html`:
```html
<link rel="icon" type="image/png" href="/favicon.png" />
```

### Change Meta Description:

Edit `index.html`:
```html
<meta name="description" content="Your app description here" />
```

---

## 🎨 Brand Colors (from Tailwind Config)

Current brand colors used in the app:

```javascript
brand: {
  dark: '#1A1A1A',
  cream: '#FAF7F2',
  'cream-card': '#FFFFFF',
  teal: '#2C5F6F',
  'teal-dark': '#1E4350',
  gold: '#C9A86A',
  'gold-soft': '#E5D4B5',
  'gold-dark': '#8B7548',
  coral: '#E57373',
}
```

To change colors, edit: `tailwind.config.js`

---

## 📂 Logo & Brand Assets

### Current Structure:
```
d:\you-remembered-by-gem\
├── index.html           # App title & favicon link
├── public/
│   └── favicon.svg      # App icon
└── tailwind.config.js   # Brand colors
```

### Add Logo:

1. Add logo to `public/` folder:
   ```
   public/logo.svg
   public/logo.png
   ```

2. Use in components:
   ```jsx
   <img src="/logo.svg" alt="Logo" />
   ```

---

## 🌐 SEO & Meta Tags

### Add to `index.html`:

```html
<head>
  <!-- App Title -->
  <title>You Remembered by Gem</title>
  
  <!-- SEO -->
  <meta name="description" content="Personalized gift recommendations" />
  <meta name="keywords" content="gifts, recommendations, personalized" />
  
  <!-- Open Graph (Facebook/LinkedIn) -->
  <meta property="og:title" content="You Remembered by Gem" />
  <meta property="og:description" content="Personalized gift recommendations" />
  <meta property="og:image" content="/og-image.jpg" />
  <meta property="og:url" content="https://yourdomain.com" />
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="You Remembered by Gem" />
  <meta name="twitter:description" content="Personalized gift recommendations" />
  <meta name="twitter:image" content="/twitter-image.jpg" />
</head>
```

---

## 🎯 After Changes

### Test Locally:
```bash
npm run dev
```
Visit http://localhost:5173 and check:
- Browser tab title
- Favicon in browser tab

### Deploy to Railway:
```bash
git add .
git commit -m "Update branding and favicon"
git push
```

Railway will rebuild and deploy automatically!

---

## 📱 PWA Manifest (Optional)

For installable app, create `public/manifest.json`:

```json
{
  "name": "You Remembered by Gem",
  "short_name": "Gem",
  "description": "Personalized gift recommendations",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#FAF7F2",
  "theme_color": "#2C5F6F",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

Then add to `index.html`:
```html
<link rel="manifest" href="/manifest.json" />
```

---

## ✅ Checklist

- [x] App title updated
- [x] Favicon created
- [x] Meta description added
- [ ] Logo added (optional)
- [ ] OG images added (optional)
- [ ] PWA manifest added (optional)

---

**Your app now has proper branding!** 🎉

Favicon shows a gem icon with your brand colors (teal & gold).
