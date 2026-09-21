# Restore Gem's Pick Products

## Backup Information
- **Created:** 2026-09-17T08:57:06.637Z
- **Products:** 485
- **Retailers:** 236

## Files Backed Up
- `curated-products.json` - All CURATED_PRODUCT products
- `retailers.json` - Associated retailers

## Restore Command

To restore this backup, run:

```bash
node scripts/restore-gems-picks.js "D:\you-remembered-by-gem\database-backups\gems-picks-backup-2026-09-17T08-57-06"
```

## Manual Restore (if script fails)

1. Import retailers first:
```javascript
const retailers = JSON.parse(fs.readFileSync('D:\you-remembered-by-gem\database-backups\gems-picks-backup-2026-09-17T08-57-06\retailers.json'));
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
const products = JSON.parse(fs.readFileSync('D:\you-remembered-by-gem\database-backups\gems-picks-backup-2026-09-17T08-57-06\curated-products.json'));
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
- Selfridges: 8 products
- Beautifect: 67 products
- Kurt Geiger: 2 products
- All Saints: 3 products
- The Conran Shop: 2 products
- Billy Tannery: 3 products
- Ettinger: 9 products
- John Lewis: 17 products
- The North Face: 2 products
- Freddie's Flowers: 1 products
- Stadium Tours: 1 products
- The Collectors Corner: 2 products
- Golf Gift Days: 4 products
- PGA Play: 1 products
- The Little Tibet: 2 products
- Lisa Angel: 2 products
- Pascale: 1 products
- Susan Caplan: 2 products
- Wolf and Badger: 5 products
- Prior: 2 products
- Haygen: 2 products
- The White Company: 1 products
- Heal's: 3 products
- Melin Tregwynt: 1 products
- Paul Smith: 2 products
- Masu: 2 products
- House of Hackney: 1 products
- My 1st Years: 1 products
- Sense Nest: 1 products
- Wonderbly: 2 products
- Jellycat: 1 products
- Westwing: 1 products
- Cuddleberry: 1 products
- Hello Baby: 1 products
- Crafts 4 Kids: 15 products
- Jacques: 2 products
- Smyths Toys: 8 products
- The Entertainer: 1 products
- The Toy Shop: 2 products
- Beatrix Potter Shop: 1 products
- True Toys: 1 products
- Very: 2 products
- Lego: 2 products
- loog: 1 products
- Biscuiteers: 1 products
- Oddballs: 1 products
- The Range: 5 products
- TeamSport: 1 products
- Decathlon: 2 products
- Lightning Sports: 1 products
- No.14 Ampthill: 1 products
- Meri  Meri: 2 products
- Banwood: 1 products
- Next: 1 products
- Daisy Daisy: 1 products
- Alf & Co: 1 products
- Hamleys: 2 products
- Little Concepts: 1 products
- Oli's Skate Shop: 1 products
- Bay Sixty56: 1 products
- The Craft Adventure Box: 1 products
- Jo Malone: 1 products
- Galio: 1 products
- Not On The High Street: 1 products
- Comandante: 1 products
- Luxury Pyjamas designed in the UK – Desmond & Dempsey: 7 products
- The Ariandne: 1 products
- Florence London: 1 products
- Louis Vuitton: 1 products
- Monica Vinader: 3 products
- Christian Dior: 1 products
- Finisterre: 1 products
- Mr Porter: 3 products
- Marks & Spencer: 1 products
- beer52.com: 2 products
- YSL: 1 products
- buyagift: 3 products
- Engravers Guild: 1 products
- Shop Contemporary Jewellery to Stack & Style: 17 products
- Liberty: 2 products
- Sunglasses Hut: 2 products
- Borough Kitchen: 6 products
- Georg Jensen: 2 products
- Class Bento: 3 products
- Clapton Craft: 1 products
- Chupi: 2 products
- Virgin Experience: 4 products
- Bramley Products: 4 products
- Tiffany: 3 products
- Gusbourne: 1 products
- Chisholm Hunter: 2 products
- Hermes: 2 products
- Tissot: 3 products
- Dior: 2 products
- Blackwell's: 1 products
- Oura: 1 products
- Perfect Draft: 1 products
- Cartier: 2 products
- James Moore Jewellers: 1 products
- Liberty London: 3 products
- The Night Sky: 1 products
- Ernest Jones: 2 products
- Hamilton: 2 products
- Hedonims Wines: 1 products
- art of living: 2 products
- spacenk.com: 1 products
- Snow Peak: 2 products
- Time and Tide: 1 products
- Healf: 3 products
- Scotland's Wild: 1 products
- Watches of Switzerland: 3 products
- Green Tulip: 1 products
- Longines: 2 products
- Lord of the Beards: 1 products
- Green People: 1 products
- The British Emporium: 1 products
- Reiss: 2 products
- Yoga Matters: 2 products
- Purdey: 1 products
- Affordable Golf: 3 products
- Tom Dixon: 1 products
- Birthdate Co: 1 products
- Allotmate: 1 products
- Fortnum & Mason: 2 products
- Loewe: 1 products
- thewhitecompany.com: 1 products
- Jess Collett: 1 products
- Fendi: 1 products
- Aire Baths: 1 products
- Mysteries in Time: 1 products
- Menkind: 2 products
- Elys Wimbledon: 1 products
- Amazon: 4 products
- Workshop Heaven: 3 products
- Astrid and Miyu: 2 products
- Sound Therapy Shop: 3 products
- Atelier Rebul: 2 products
- Bottega Veneta: 2 products
- Missoma: 1 products
- Ziracle: 1 products
- Bro Coffee: 1 products
- Whisky Exchange: 1 products
- Penhaligons: 1 products
- Very.co.uk: 1 products
- Polene: 1 products
- Massimo Dutti: 1 products
- Wolf & Badger: 1 products
- mysteriesintime.com: 2 products
- brahmaki.com: 1 products
- Cox&Cox: 1 products
- Nao Design: 1 products
- Complete Unity Yoga: 1 products
- Harrods: 4 products
- Ervaia: 1 products
- Science Gifts: 1 products
- Oliver Peoples: 1 products
- Malin+Goetz: 1 products
- Arket: 1 products
- Verano Hill: 2 products
- Erdem: 1 products
- Intelligent Change: 1 products
- Goldsmiths: 4 products
- Dieux: 1 products
- Gordon Ramsay: 1 products
- Cosmetify: 1 products
- Kida Kayo: 1 products
- Dyson: 1 products
- Paradise Row London: 1 products
- Ubuy: 1 products
- Lakeland: 1 products
- The Champagne and Gift Company: 1 products
- The Newt in Somerset: 1 products
- Soho Home: 1 products
- Hugo Boss: 1 products
- Currys: 1 products
- Sip Champagnes: 1 products
- GRIND: 1 products
- Perfect Cellar: 1 products
- Laithwaites: 1 products
- Peugeot: 1 products
- Vonhaus: 1 products
- Mulberry: 1 products
- Norfolk Natural Living: 1 products
- Gardening Gifts Co: 1 products
- RSPB: 1 products
- Debenhams: 1 products
- haygenshop.com: 1 products
- thegoto.com: 4 products
- Whisky World: 1 products
- Moon and Earth Crystals: 1 products
- Rixo: 1 products
- Leatherman: 1 products
- Ori Future: 1 products
- Roseings London: 1 products
- Dartington: 1 products
- London Distillery School: 1 products
- Hey Pocket: 1 products
- RHS Plants: 3 products
- The Waterside Inn: 1 products
- The Jewel Hut: 1 products
- Farrar & Tanner: 1 products
- Sephora: 1 products
- H Samuel: 1 products
- Time in Hand: 1 products
- T.H. Baker: 1 products
- Woodland Trust: 1 products
- Crocus: 1 products
- Watch Pilot: 1 products
- Celine: 1 products
- Farfetch: 1 products
- Drowsy Sleep Co: 1 products
- The Lovat: 1 products
- Rituals: 1 products
- Aspinal of London: 2 products
- Gordon Ramsay Academy: 1 products
- Biddenden: 1 products
- Le Labo: 1 products
- The Jelly Club: 1 products
- Soulful Iron: 1 products
- Suri: 1 products
- Luxe Co: 1 products
- Lumirya: 1 products
- Beats by Dre: 1 products
- Eco Bath London: 1 products
- David Shuttle: 1 products
- Jackie's Kids: 1 products
- Frasers: 1 products
- Disney Store: 1 products
- Babyblooms: 1 products
- Atlantic Blankets: 1 products
- La Maison Couture: 1 products
- Coastal-Inspired Blankets & Throws: 1 products
- Get Kidzly: 1 products
- DIY: 1 products
- Out of the Box Gifts: 1 products
- Lotus Zen: 1 products

### Total Value: £110097.26
