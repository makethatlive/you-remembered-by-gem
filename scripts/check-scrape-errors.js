/**
 * Check scrape errors for a specific retailer
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkScrapeErrors() {
  try {
    // Get the most recent retailers
    const retailers = await prisma.retailer.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        name: true,
        websiteUrl: true,
        giftPageUrl: true,
        active: true,
        curatedOnly: true,
        lastScrapeAt: true,
        lastScrapeStatus: true,
        lastScrapeError: true,
        lastDiscoveryMethod: true,
        lastScrapeProductsFound: true,
      }
    });

    console.log('\n📊 Recent Retailers:\n');
    for (const retailer of retailers) {
      console.log(`\n🏪 ${retailer.name} (${retailer.id})`);
      console.log(`   Website URL: ${retailer.websiteUrl || 'N/A'}`);
      console.log(`   Gift Page URL: ${retailer.giftPageUrl || 'N/A'}`);
      console.log(`   Active: ${retailer.active}`);
      console.log(`   Curated Only: ${retailer.curatedOnly}`);
      console.log(`   Last Scrape: ${retailer.lastScrapeAt ? retailer.lastScrapeAt.toISOString() : 'Never'}`);
      console.log(`   Status: ${retailer.lastScrapeStatus || 'N/A'}`);
      console.log(`   Discovery: ${retailer.lastDiscoveryMethod || 'N/A'}`);
      console.log(`   Products Found: ${retailer.lastScrapeProductsFound || 0}`);
      if (retailer.lastScrapeError) {
        console.log(`   ❌ Error: ${retailer.lastScrapeError}`);
      }
    }

    // Get scrape run logs for these retailers
    console.log('\n\n📋 Recent Scrape Logs:\n');
    const logs = await prisma.scrapeRunLog.findMany({
      orderBy: { runDate: 'desc' },
      take: 10,
      select: {
        retailerName: true,
        scrapeStatus: true,
        discoveryMethod: true,
        newProducts: true,
        updated: true,
        error: true,
        rejectReasonsJson: true,
        runDate: true,
      }
    });

    for (const log of logs) {
      console.log(`\n🔍 ${log.retailerName} - ${log.runDate.toISOString()}`);
      console.log(`   Status: ${log.scrapeStatus}`);
      console.log(`   Discovery: ${log.discoveryMethod}`);
      console.log(`   New: ${log.newProducts}, Updated: ${log.updated}`);
      if (log.error) {
        console.log(`   ❌ Error: ${log.error}`);
      }
      if (log.rejectReasonsJson && log.rejectReasonsJson !== '{}') {
        console.log(`   Rejections: ${log.rejectReasonsJson}`);
      }
    }

    console.log('\n');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkScrapeErrors();
