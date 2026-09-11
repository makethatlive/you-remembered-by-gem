import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres:UZlUiwQwxvaLceCdOHrsBlKwaEpaiVtZ@sakura.proxy.rlwy.net:45955/railway"
    }
  }
});

async function checkNicolasGifts() {
  try {
    console.log('\n=== CHECKING MATE RECIPIENT DATA (Subscriber: nicklos99) ===\n');
    
    // Find Mate recipient
    const nicolas = await prisma.recipient.findFirst({
      where: {
        id: 'cmtwtxwg1000812fmmnod41pm'
      },
      include: {
        subscriber: true,
        giftLists: {
          include: {
            giftItems: {
              include: {
                product: {
                  include: {
                    retailer: true
                  }
                }
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 1
        }
      }
    });

    if (!nicolas) {
      console.log('❌ No recipient named Mate found');
      return;
    }

    console.log('📋 RECIPIENT INFO:');
    console.log('  Name:', nicolas.name);
    console.log('  Relationship:', nicolas.relationship);
    console.log('  Age Range:', nicolas.ageRange);
    console.log('  Gender:', nicolas.gender);
    console.log('  Interests:', nicolas.interests);
    console.log('  Personality:', nicolas.personality);
    console.log('  Hobbies:', nicolas.hobbies);
    console.log('  Style:', nicolas.style);
    console.log('  Budget Min:', nicolas.budgetMin);
    console.log('  Budget Max:', nicolas.budgetMax);
    console.log('  Notes:', nicolas.notes);
    console.log('  Subscriber:', nicolas.subscriber?.email);

    if (nicolas.giftLists.length === 0) {
      console.log('\n❌ No gift lists found for Mate');
      return;
    }

    const latestList = nicolas.giftLists[0];
    console.log('\n\n=== LATEST GIFT LIST (ID:', latestList.id, ') ===');
    console.log('  Status:', latestList.status);
    console.log('  Created:', latestList.createdAt);
    console.log('  Occasion:', latestList.occasion);
    console.log('  Occasion Date:', latestList.occasionDate);
    console.log('  Total Items:', latestList.giftItems.length);

    console.log('\n\n🎁 GIFT ITEMS:\n');
    
    latestList.giftItems.forEach((item, index) => {
      console.log(`\n${index + 1}. ${item.product?.title || 'Unknown Product'}`);
      console.log('   Retailer:', item.product?.retailer?.name || 'Unknown');
      console.log('   Price:', item.product?.price ? `£${item.product.price}` : 'N/A');
      console.log('   Rank:', item.rank);
      console.log('   AI Reasoning:', item.aiReasoning?.substring(0, 200) || 'N/A');
      console.log('   Product URL:', item.product?.url || 'N/A');
      console.log('   Product ID:', item.product?.id);
      console.log('   Categories:', item.product?.categories || 'N/A');
      console.log('   Tags:', item.product?.tags || 'N/A');
    });

    console.log('\n\n=== ANALYSIS ===\n');
    
    // Check if gifts match recipient profile
    const recipientInterests = (nicolas.interests || []).map(i => i.toLowerCase());
    const recipientHobbies = (nicolas.hobbies || []).map(h => h.toLowerCase());
    const allRecipientKeywords = [...recipientInterests, ...recipientHobbies];
    
    console.log('Recipient Keywords:', allRecipientKeywords.join(', '));
    
    latestList.giftItems.forEach((item, index) => {
      const productTitle = (item.product?.title || '').toLowerCase();
      const productCategories = (item.product?.categories || []).map(c => c.toLowerCase());
      const productTags = (item.product?.tags || []).map(t => t.toLowerCase());
      
      const matchedKeywords = allRecipientKeywords.filter(keyword => 
        productTitle.includes(keyword) || 
        productCategories.some(cat => cat.includes(keyword)) ||
        productTags.some(tag => tag.includes(keyword))
      );
      
      console.log(`\nGift ${index + 1}: ${matchedKeywords.length > 0 ? '✅' : '❌'} Match`);
      if (matchedKeywords.length > 0) {
        console.log('  Matched:', matchedKeywords.join(', '));
      } else {
        console.log('  No clear match with recipient profile');
      }
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkNicolasGifts();
