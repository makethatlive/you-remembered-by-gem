/**
 * Check and fix stuck scrape state
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkScrapeState() {
  console.log('🔍 Checking scrape state...\n');
  
  try {
    // Check for any running scrape states
    const runningStates = await prisma.scrapeState.findMany({
      where: {
        isRunning: true
      }
    });
    
    if (runningStates.length === 0) {
      console.log('✅ No stuck scrape states found!');
      console.log('   The scraper should work now.\n');
      return;
    }
    
    console.log('⚠️  Found stuck scrape states:\n');
    
    runningStates.forEach((state, i) => {
      console.log(`${i + 1}. Scrape State:`);
      console.log(`   ID: ${state.id}`);
      console.log(`   Is Running: ${state.isRunning}`);
      console.log(`   Started: ${state.startedAt || '(not set)'}`);
      console.log(`   Last heartbeat: ${state.heartbeatAt || '(not set)'}`);
      
      // Check if it's really stuck (no heartbeat for 5+ minutes)
      if (state.heartbeatAt) {
        const minutesSinceHeartbeat = (Date.now() - new Date(state.heartbeatAt).getTime()) / 1000 / 60;
        console.log(`   Minutes since heartbeat: ${minutesSinceHeartbeat.toFixed(1)}`);
        
        if (minutesSinceHeartbeat > 5) {
          console.log('   🔴 STUCK! (no heartbeat for 5+ minutes)');
        } else {
          console.log('   🟢 ACTIVE (recent heartbeat)');
        }
      } else {
        console.log('   🔴 STUCK! (no heartbeat ever)');
      }
      console.log('');
    });
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('🛠️  Fixing stuck states...\n');
    
    // Update all stuck scrape states to not running
    const updated = await prisma.scrapeState.updateMany({
      where: {
        isRunning: true
      },
      data: {
        isRunning: false,
        lastCompletedAt: new Date()
      }
    });
    
    console.log(`✅ Cleared ${updated.count} stuck scrape state(s)\n`);
    console.log('You can now click "Scrape" again!\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkScrapeState();
