/**
 * Migrate Recipient Age Bands from Old Enums to New Format
 * 
 * Converts old enum values to onboarding-aligned age band format
 * Old: THIRTY_ONE_TO_50, ELEVEN_TO_17, etc.
 * New: "46-55", "12-17", etc. (matching onboarding form exactly)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Mapping based on ageRange field (more accurate than enum alone)
// This uses the actual age range the user selected in onboarding
const AGE_RANGE_TO_BAND = {
  // Children
  '1-2': '1-2',
  '3-4': '3-4',
  '5-6': '5-6',
  '7-8': '7-8',
  '9-11': '9-11',
  '12-17': '12-17',
  
  // Adults
  '18-25': '18-25',
  '26-35': '26-35',
  '36-45': '36-45',
  '46-55': '46-55',
  '56-65': '56-65',
  '66-75': '66-75',
  '75+': '75+',
  
  // Legacy fallbacks (if ageRange not set)
  'Under 11': '5-6',  // Default to middle
};

// Fallback mapping for old enum values (when ageRange is null)
const ENUM_FALLBACK = {
  'UNDER_5': '3-4',
  'FIVE_TO_10': '7-8',
  'FIVE_TO_TEN': '7-8',  // Alternative spelling
  'ELEVEN_TO_17': '12-17',
  'ELEVEN_TO_SEVENTEEN': '12-17',  // Alternative
  'EIGHTEEN_TO_30': '26-35',  // Default to middle
  'EIGHTEEN_TO_THIRTY': '26-35',
  'THIRTY_ONE_TO_50': '46-55',  // Default to older range
  'THIRTY_ONE_TO_FIFTY': '46-55',
  'FIFTY_ONE_TO_70': '56-65',  // Default to middle
  'FIFTY_ONE_TO_SEVENTY': '56-65',
  'FIFTY_TO_SIXTY_FIVE': '56-65',
  'SIXTY_FIVE_PLUS': '75+',
  'SEVENTY_PLUS': '75+',
};

async function migrateRecipients() {
  console.log('🔄 Starting recipient age band migration...\n');
  
  // Fetch all recipients
  const recipients = await prisma.recipient.findMany({
    select: {
      id: true,
      name: true,
      ageBand: true,
      ageRange: true,
      childAgeBracket: true,
    }
  });
  
  console.log(`📊 Found ${recipients.length} recipients to process\n`);
  
  const updates = [];
  const stats = {
    updated: 0,
    skipped: 0,
    errors: 0,
    byMapping: {}
  };
  
  for (const recipient of recipients) {
    let newAgeBand = null;
    let source = null;
    
    // Priority 1: Use childAgeBracket for children (most accurate)
    if (recipient.childAgeBracket && AGE_RANGE_TO_BAND[recipient.childAgeBracket]) {
      newAgeBand = AGE_RANGE_TO_BAND[recipient.childAgeBracket];
      source = 'childAgeBracket';
    }
    // Priority 2: Use ageRange (user's actual selection)
    else if (recipient.ageRange && AGE_RANGE_TO_BAND[recipient.ageRange]) {
      newAgeBand = AGE_RANGE_TO_BAND[recipient.ageRange];
      source = 'ageRange';
    }
    // Priority 3: Use old ageBand enum as fallback
    else if (recipient.ageBand && ENUM_FALLBACK[recipient.ageBand]) {
      newAgeBand = ENUM_FALLBACK[recipient.ageBand];
      source = 'enum';
    }
    
    if (newAgeBand) {
      // Check if already in new format (skip if same)
      if (recipient.ageBand === newAgeBand) {
        console.log(`⏭️  ${recipient.name}: Already in new format (${newAgeBand})`);
        stats.skipped++;
        continue;
      }
      
      updates.push({
        id: recipient.id,
        name: recipient.name,
        oldValue: recipient.ageBand,
        newValue: newAgeBand,
        source: source
      });
      
      // Track statistics
      const key = `${recipient.ageBand} → ${newAgeBand}`;
      stats.byMapping[key] = (stats.byMapping[key] || 0) + 1;
    } else {
      console.warn(`⚠️  ${recipient.name}: Could not determine new age band`);
      console.warn(`   Current: ${recipient.ageBand}, ageRange: ${recipient.ageRange}, childAgeBracket: ${recipient.childAgeBracket}`);
      stats.errors++;
    }
  }
  
  console.log(`\n📋 Migration Plan:`);
  console.log(`   ✅ Will update: ${updates.length}`);
  console.log(`   ⏭️  Will skip: ${stats.skipped}`);
  console.log(`   ⚠️  Errors: ${stats.errors}`);
  
  if (updates.length === 0) {
    console.log(`\n✨ No updates needed - all recipients already in new format!`);
    return;
  }
  
  console.log(`\n📊 Mapping breakdown:`);
  for (const [mapping, count] of Object.entries(stats.byMapping)) {
    console.log(`   ${mapping}: ${count} recipients`);
  }
  
  // Show preview
  console.log(`\n🔍 Preview (first 5 updates):`);
  updates.slice(0, 5).forEach(u => {
    console.log(`   ${u.name}: ${u.oldValue} → ${u.newValue} (source: ${u.source})`);
  });
  
  // Prompt for confirmation
  console.log(`\n⚠️  Ready to update ${updates.length} recipients`);
  console.log(`   Press Ctrl+C to cancel, or wait 5 seconds to continue...`);
  
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  console.log(`\n🚀 Starting batch update...\n`);
  
  // Update in batches
  const BATCH_SIZE = 50;
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE);
    
    // Update each recipient in the batch
    const promises = batch.map(update =>
      prisma.recipient.update({
        where: { id: update.id },
        data: { ageBand: update.newValue }
      })
      .then(() => {
        console.log(`✅ ${update.name}: ${update.oldValue} → ${update.newValue}`);
        stats.updated++;
      })
      .catch(err => {
        console.error(`❌ ${update.name}: Failed - ${err.message}`);
        stats.errors++;
      })
    );
    
    await Promise.all(promises);
    
    if (i + BATCH_SIZE < updates.length) {
      console.log(`   ... processed ${Math.min(i + BATCH_SIZE, updates.length)}/${updates.length}`);
    }
  }
  
  console.log(`\n✨ Migration complete!`);
  console.log(`\n📊 Final Statistics:`);
  console.log(`   ✅ Updated: ${stats.updated}`);
  console.log(`   ⏭️  Skipped: ${stats.skipped}`);
  console.log(`   ❌ Errors: ${stats.errors}`);
  console.log(`   📝 Total: ${recipients.length}`);
}

// Run migration
migrateRecipients()
  .then(() => {
    console.log(`\n🎉 All done!`);
    prisma.$disconnect();
    process.exit(0);
  })
  .catch((error) => {
    console.error(`\n❌ Migration failed:`, error);
    prisma.$disconnect();
    process.exit(1);
  });
