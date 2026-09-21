# Restore Gem's Pick Products

## Backup Information
- **Created:** 2026-09-17T09:19:47.021Z
- **Products:** 246
- **Retailers:** 163

## Files Backed Up
- `curated-products.json` - All CURATED_PRODUCT products
- `retailers.json` - Associated retailers

## Restore Command

To restore this backup, run:

```bash
node scripts/restore-gems-picks.js "D:\you-remembered-by-gem\database-backups\gems-picks-backup-2026-09-17T09-19-46"
```

## Manual Restore (if script fails)

1. Import retailers first:
```javascript
const retailers = JSON.parse(fs.readFileSync('D:\you-remembered-by-gem\database-backups\gems-picks-backup-2026-09-17T09-19-46\retailers.json'));
for (const retailer of retailers) {
  await prisma.retailer.upsert({
    where: { id: retailer.id },
    update: retailer,
    create: retailer
  });
}
```

2. Then import products:
```javascript
const products = JSON.parse(fs.readFileSync('D:\you-remembered-by-gem\database-backups\gems-picks-backup-2026-09-17T09-19-46\curated-products.json'));
for (const product of products) {
  await prisma.product.upsert({
    where: { id: product.id },
    update: product,
    create: product
  });
}
```

## Product Details

### Products by Retailer:
- Borough Kitchen: 6 products
- fortnumandmason.com: 2 products
- buyagift.co.uk: 3 products
- Class Bento: 3 products
- John Lewis: 9 products
- Gordon Ramsay Academy: 1 products
- Harrods: 4 products
- The Waterside Inn: 1 products
- Biddenden: 1 products
- Georg Jensen: 2 products
- Clapton Craft: 1 products
- Virgin Experience Days UK: 3 products
- Perfect Cellar: 1 products
- Laithwaites: 1 products
- Peugeot: 1 products
- Lakeland: 1 products
- David Shuttle: 1 products
- Gusbourne: 1 products
- The Champagne and Gift Company: 1 products
- The Newt in Somerset: 1 products
- Soho Home: 1 products
- Amazon: 4 products
- Sip Champagnes: 1 products
- GRIND: 1 products
- Ubuy: 1 products
- Bro Coffee: 1 products
- Snow Peak: 2 products
- YSL: 1 products
- Tom Dixon: 1 products
- Selfridges: 8 products
- notonthehighstreet.com: 1 products
- Comandante: 1 products
- Blackwell's: 1 products
- Ori Future: 1 products
- Vonhaus: 1 products
- hedonism.co.uk: 1 products
- art of living: 2 products
- Dartington: 1 products
- London Distillery School: 1 products
- Whisky World: 1 products
- Gordon Ramsay: 1 products
- thewhiskyexchange.com: 1 products
- Engravers Guild: 1 products
- Scotland's Wild: 1 products
- Out of the Box Gifts: 1 products
- Green Tulip: 1 products
- Lord of the Beards: 1 products
- Green People: 1 products
- Complete Unity Yoga: 1 products
- Ervaia: 1 products
- The Lovat: 1 products
- Suri: 1 products
- Monica Vinader: 3 products
- Finisterre: 1 products
- Ziracle: 1 products
- Paradise Row London: 1 products
- La Maison Couture: 1 products
- Luxe Co: 1 products
- Healf: 3 products
- Lotus Zen: 1 products
- Yoga Matters: 2 products
- Norfolk Natural Living: 1 products
- Debenhams: 1 products
- Birthdate Co: 1 products
- Liberty: 4 products
- Rituals: 1 products
- Sound Therapy Shop: 3 products
- Aire Baths: 1 products
- Moon and Earth Crystals: 1 products
- Jo Malone: 1 products
- penhaligons.com: 1 products
- Le Labo: 1 products
- Sephora: 1 products
- Elys Wimbledon: 1 products
- Shop Contemporary Jewellery to Stack & Style: 2 products
- Florence London: 1 products
- Missoma: 1 products
- Chupi: 2 products
- Tiffany: 3 products
- Chisholm Hunter: 2 products
- Dior: 3 products
- Cartier: 2 products
- Goldsmiths: 4 products
- Tissot: 3 products
- H Samuel: 1 products
- Time and Tide: 1 products
- Time in Hand: 1 products
- James Moore Jewellers: 1 products
- Ernest Jones: 2 products
- Hamilton: 2 products
- Longines: 2 products
- Galio: 1 products
- T.H. Baker: 1 products
- The Jewel Hut: 1 products
- Watch Pilot: 1 products
- Watches of Switzerland: 3 products
- Woodland Trust: 1 products
- RHS Plants: 3 products
- The British Emporium: 1 products
- Menkind: 2 products
- Gardening Gifts Co: 1 products
- RSPB: 1 products
- Crocus: 1 products
- Allotmate: 1 products
- Workshop Heaven: 3 products
- Soulful Iron: 1 products
- Leatherman: 1 products
- The Conran Shop: 2 products
- Cox&Cox: 1 products
- Heal's: 1 products
- mrporter.com: 3 products
- Hermes: 2 products
- Personalized Books For Kids & Adults: 1 products
- Beats by Dre: 1 products
- skincare you trust+scents you love.: 1 products
- The North Face: 1 products
- Oura: 1 products
- Hugo Boss: 1 products
- Currys: 1 products
- Perfect Draft: 1 products
- The Night Sky - Custom Star Map: 1 products
- DIY: 1 products
- Collections – Dieux: 1 products
- Eco Bath London: 1 products
- Cosmetify: 1 products
- Kida Kayo: 1 products
- Dyson: 1 products
- Beautifect: 2 products
- Atelier Rebul: 2 products
- wolfandbadger.com: 1 products
- Drowsy Sleep Co: 1 products
- Nao Design: 1 products
- Intelligent Change: 1 products
- The Ariandne: 1 products
- Hey Pocket: 1 products
- Aspinal of London: 2 products
- Celine: 1 products
- Farfetch: 1 products
- Louis Vuitton: 1 products
- Marks & Spencer: 1 products
- Very.co.uk: 1 products
- Sunglasses Hut: 2 products
- All Saints: 3 products
- Reiss: 2 products
- Kurt Geiger: 2 products
- Mulberry: 1 products
- Bottega Veneta: 2 products
- Loewe: 1 products
- Farrar & Tanner: 1 products
- Purdey: 1 products
- Jess Collett: 1 products
- Fendi: 1 products
- Designer Clothing for Men, Women & Kids, Fashion Accessories: 1 products
- The Jelly Club: 1 products
- Rixo: 1 products
- Polene: 1 products
- Massimo Dutti: 1 products
- Oliver Peoples: 1 products
- Arket: 1 products
- Verano Hill: 2 products
- Lumirya: 1 products
- Erdem: 1 products
- Roseings London: 1 products

### Total Value: £76647.95
