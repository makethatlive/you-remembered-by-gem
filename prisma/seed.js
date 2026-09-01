import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create admin user
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@youremembered.com' },
    update: {},
    create: {
      email: 'admin@youremembered.com',
      role: 'ADMIN',
    },
  });
  console.log('✅ Admin user created:', adminUser.email);

  // Create sample user
  const sampleUser = await prisma.user.upsert({
    where: { email: 'user@example.com' },
    update: {},
    create: {
      email: 'user@example.com',
      role: 'USER',
    },
  });
  console.log('✅ Sample user created:', sampleUser.email);

  // Create sample retailers
  const retailers = [
    {
      name: 'Amazon UK',
      websiteUrl: 'https://www.amazon.co.uk',
      category: 'UNISEX_KIDS',
      active: true,
      curatedOnly: false,
      whatTheySell: 'Wide range of products across all categories',
      whyItFits: 'Comprehensive selection with reliable delivery',
    },
    {
      name: 'John Lewis',
      websiteUrl: 'https://www.johnlewis.com',
      category: 'UNISEX_ADULT',
      active: true,
      curatedOnly: false,
      whatTheySell: 'Quality homeware, fashion, and gifts',
      whyItFits: 'Premium quality items perfect for special occasions',
    },
    {
      name: 'Not On The High Street',
      websiteUrl: 'https://www.notonthehighstreet.com',
      category: 'UNISEX_KIDS',
      active: true,
      curatedOnly: true,
      whatTheySell: 'Unique, personalized and handmade gifts',
      whyItFits: 'Special and thoughtful gift options',
    },
    {
      name: 'Lego',
      websiteUrl: 'https://www.lego.com',
      category: 'KIDS',
      active: true,
      curatedOnly: false,
      whatTheySell: 'LEGO building sets and toys',
      whyItFits: 'Creative and engaging gifts for children',
    },
  ];

  const createdRetailers = [];
  for (const retailer of retailers) {
    const created = await prisma.retailer.upsert({
      where: { name: retailer.name },
      update: {},
      create: retailer,
    });
    createdRetailers.push(created);
    console.log(`✅ Retailer created: ${created.name}`);
  }

  // Create sample products
  const products = [
    {
      name: 'LEGO Classic Creative Bricks',
      description: 'A set of classic LEGO bricks for creative building',
      retailerId: createdRetailers.find(r => r.name === 'Lego').id,
      productUrl: 'https://www.lego.com/en-gb/product/creative-bricks-11003',
      price: 29.99,
      category: 'Toys & Games',
      genderAppliesTo: 'Unisex',
      ageRestricted: false,
      suitableAgeBands: ['5-10', '11-17'],
      sourceType: 'CURATED_PRODUCT',
      status: 'ACTIVE',
      interestTags: ['building', 'creativity', 'toys'],
      giftTypeTags: ['educational', 'hands-on'],
      searchKeywords: ['lego', 'building', 'blocks', 'creative'],
      canonicalCategory: 'toys_games',
    },
    {
      name: 'Personalized Leather Journal',
      description: 'Beautiful leather-bound journal with custom engraving',
      retailerId: createdRetailers.find(r => r.name === 'Not On The High Street').id,
      productUrl: 'https://www.notonthehighstreet.com/product/leather-journal',
      price: 45.00,
      category: 'Stationery',
      genderAppliesTo: 'Unisex',
      ageRestricted: false,
      suitableAgeBands: ['18+'],
      sourceType: 'CURATED_PRODUCT',
      status: 'ACTIVE',
      interestTags: ['writing', 'journaling', 'stationery'],
      giftTypeTags: ['personalized', 'keepsake'],
      searchKeywords: ['journal', 'leather', 'personalized', 'writing'],
      canonicalCategory: 'books_stationery',
    },
    {
      name: 'Premium Coffee Gift Set',
      description: 'Selection of artisan coffees from around the world',
      retailerId: createdRetailers.find(r => r.name === 'John Lewis').id,
      productUrl: 'https://www.johnlewis.com/coffee-gift-set',
      price: 35.00,
      category: 'Food & Drink',
      genderAppliesTo: 'Unisex',
      ageRestricted: false,
      suitableAgeBands: ['18+'],
      sourceType: 'CURATED_RETAILER',
      status: 'ACTIVE',
      interestTags: ['coffee', 'food', 'gourmet'],
      giftTypeTags: ['edible', 'experience'],
      searchKeywords: ['coffee', 'gift', 'set', 'premium'],
      canonicalCategory: 'food_drink',
    },
    {
      name: 'Wireless Noise-Cancelling Headphones',
      description: 'High-quality wireless headphones with active noise cancellation',
      retailerId: createdRetailers.find(r => r.name === 'Amazon UK').id,
      productUrl: 'https://www.amazon.co.uk/headphones',
      price: 129.99,
      category: 'Electronics',
      genderAppliesTo: 'Unisex',
      ageRestricted: false,
      suitableAgeBands: ['11-17', '18+'],
      sourceType: 'CURATED_RETAILER',
      status: 'ACTIVE',
      interestTags: ['music', 'technology', 'audio'],
      giftTypeTags: ['tech', 'practical'],
      searchKeywords: ['headphones', 'wireless', 'music', 'technology'],
      canonicalCategory: 'technology',
    },
  ];

  const createdProducts = [];
  for (const product of products) {
    const created = await prisma.product.create({
      data: product,
    });
    createdProducts.push(created);
    console.log(`✅ Product created: ${created.name}`);
  }

  // Create sample subscriber
  const subscriber = await prisma.subscriber.create({
    data: {
      name: 'Jane Doe',
      firstName: 'Jane',
      email: 'jane.doe@example.com',
      howHeard: 'Google Search',
      subscriptionStatus: 'ACTIVE',
      subscribedSince: new Date(),
      createdById: sampleUser.id,
    },
  });
  console.log('✅ Subscriber created:', subscriber.name);

  // Create sample recipient
  const recipient = await prisma.recipient.create({
    data: {
      subscriberId: subscriber.id,
      name: 'Tom',
      relationship: 'Son',
      occasion: 'Birthday',
      occasionDay: 15,
      occasionMonth: 8,
      birthday: '--08-15',
      gender: 'MALE',
      ageRange: '5-10',
      ageBand: 'FIVE_TO_10',
      budgetMin: 20,
      budgetMax: 50,
      interests: ['lego', 'dinosaurs', 'space'],
      personality: ['curious', 'energetic', 'creative'],
      giftTypes: ['toys', 'books', 'experiences'],
      whoTheyAre: 'An imaginative 7-year-old who loves building things',
      hobbiesAndInterests: 'Building LEGO, reading about space, playing outdoors',
      createdById: sampleUser.id,
    },
  });
  console.log('✅ Recipient created:', recipient.name);

  // Create sample gift list
  const giftList = await prisma.giftList.create({
    data: {
      recipientId: recipient.id,
      subscriberId: subscriber.id,
      subscriberUserId: sampleUser.id,
      listType: 'CURATED',
      status: 'APPROVED',
      generatedAt: new Date(),
      approvedAt: new Date(),
      visibleToSubscriber: true,
      aiPromptUsed: 'Generate gift suggestions for a 7-year-old boy who loves LEGO and space',
    },
  });
  console.log('✅ Gift list created');

  // Create sample gift items
  const giftItems = [
    {
      giftListId: giftList.id,
      subscriberUserId: sampleUser.id,
      productId: createdProducts[0].id, // LEGO set
      title: createdProducts[0].name,
      description: createdProducts[0].description,
      whyThisGift: 'Perfect for Tom\'s love of building and creativity. This LEGO set will keep him engaged for hours.',
      productUrl: createdProducts[0].productUrl,
      retailerName: 'Lego',
      price: createdProducts[0].price,
      sourceType: 'CURATED_PRODUCT',
      deliverySpeed: 'STANDARD',
      status: 'ACTIVE',
      selectionScore: 95,
      matchedSignals: ['interest:lego', 'age:5-10', 'personality:creative'],
      suitabilityConfidence: 5,
      suitabilityReasoning: 'Excellent match - aligns perfectly with interest in LEGO and building',
    },
  ];

  for (const item of giftItems) {
    const created = await prisma.giftItem.create({
      data: item,
    });
    console.log(`✅ Gift item created: ${created.title}`);
  }

  // Initialize scrape state singleton
  await prisma.scrapeState.create({
    data: {
      isRunning: false,
    },
  });
  console.log('✅ Scrape state initialized');

  // Initialize trend stats singleton
  await prisma.trendStats.create({
    data: {
      statKey: 'global',
      computedAt: new Date(),
      itemsAnalysed: 0,
      categoryStats: [],
      retailerStats: [],
      priceBandStats: [],
      rejectionReasonCounts: [],
      recentLovedTitles: [],
      recentRejectedTitles: [],
    },
  });
  console.log('✅ Trend stats initialized');

  console.log('\n🎉 Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
