/**
 * Fix the Aadornattire retailer Gift Page URL
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixRetailer() {
  try {
    // Find the retailer by exact ID
    const retailer = await prisma.retailer.findUnique({
      where: { id: 'cmtsi4gtx0000axfsmych0wj2' }
    });

    if (!retailer) {
      console.log('❌ Retailer not found');
      return;
    }

    console.log('\n📋 Current Retailer Data:');
    console.log(`   Name: ${retailer.name}`);
    console.log(`   Website URL: ${retailer.websiteUrl}`);
    console.log(`   Gift Page URL: ${retailer.giftPageUrl}`);
    console.log(`   Last Scrape Error: ${retailer.lastScrapeError}`);

    // Fix the gift page URL - it should be a full URL, not just "aadornattire"
    const updatedRetailer = await prisma.retailer.update({
      where: { id: retailer.id },
      data: {
        giftPageUrl: 'https://aadornattire.com/',
        // Reset scrape status so it can be tried again
        lastScrapeStatus: null,
        lastScrapeError: null,
      }
    });

    console.log('\n✅ Retailer Updated:');
    console.log(`   Name: ${updatedRetailer.name}`);
    console.log(`   Website URL: ${updatedRetailer.websiteUrl}`);
    console.log(`   Gift Page URL: ${updatedRetailer.giftPageUrl}`);
    console.log('\n🎯 Ready to scrape! Try clicking "Scrape" again in the admin dashboard.\n');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixRetailer();
