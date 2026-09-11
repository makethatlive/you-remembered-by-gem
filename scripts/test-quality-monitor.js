import { PrismaClient } from '@prisma/client';
import GiftQualityMonitor from '../server/services/gifts/gift-quality-monitor.js';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres:UZlUiwQwxvaLceCdOHrsBlKwaEpaiVtZ@sakura.proxy.rlwy.net:45955/railway"
    }
  }
});

async function testQualityMonitor() {
  try {
    const monitor = new GiftQualityMonitor(prisma);
    
    console.log('Testing Quality Monitor with Mate\'s rejected gift list...\n');
    
    const report = await monitor.checkGiftListQuality('cmtwv2bf900039mxnnn3po9ue');
    
    console.log('\n✅ Quality monitor test completed');
    console.log('Final recommendation:', report.recommendation);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testQualityMonitor();
