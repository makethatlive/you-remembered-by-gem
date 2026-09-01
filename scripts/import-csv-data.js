/**
 * Import real CSV data from Base44 export into PostgreSQL
 * This script reads the actual CSV files and imports them into Prisma
 */

import 'dotenv/config'; // Load environment variables from .env
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import { parse } from 'csv-parse/sync';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();
const CSV_DIR = path.join(__dirname, '../database-csv');

// Mapping from Base44 CSV field names to Prisma field names
const FIELD_MAPPINGS = {
  // Common fields
  created_date: 'createdAt',
  updated_date: 'updatedAt',
  created_by_id: 'createdById',
  
  // Retailer fields
  contains_age_restricted_items: 'containsAgeRestrictedItems',
  gift_page_url: 'giftPageUrl',
  website_url: 'websiteUrl',
  applies_to: 'appliesTo',
  why_it_fits: 'whyItFits',
  what_they_sell: 'whatTheySell',
  last_scrape_at: 'lastScrapeAt',
  last_discovery_method: 'lastDiscoveryMethod',
  last_scrape_status: 'lastScrapeStatus',
  last_scrape_error: 'lastScrapeError',
  last_scrape_products_found: 'lastScrapeProductsFound',
  
  // Subscriber fields
  subscribed_since: 'subscribedSince',
  stripe_customer_id: 'stripeCustomerId',
  stripe_subscription_id: 'stripeSubscriptionId',
  subscription_status: 'subscriptionStatus',
  first_name: 'firstName',
  how_heard: 'howHeard',
  
  // Recipient fields
  subscriber_id: 'subscriberId',
  occasion_day: 'occasionDay',
  occasion_month: 'occasionMonth',
  age_band: 'ageBand',
  budget_max: 'budgetMax',
  budget_min: 'budgetMin',
  comms_preferences: 'commsPreferences',
  age_range: 'ageRange',
  child_age_bracket: 'childAgeBracket',
  gift_types: 'giftTypes',
  avoid_notes: 'avoidNotes',
  who_they_are: 'whoTheyAre',
  hobbies_and_interests: 'hobbiesAndInterests',
  derived_profile: 'derivedProfile',
  derived_profile_hash: 'derivedProfileHash',
  things_you_know: 'thingsYouKnow',
  last_gift_generated: 'lastGiftGenerated',
  involvement_level: 'involvementLevel',
  
  // Product fields
  product_url: 'productUrl',
  interest_tags: 'interestTags',
  canonical_category: 'canonicalCategory',
  search_keywords: 'searchKeywords',
  last_verified: 'lastVerified',
  suitable_age_bands: 'suitableAgeBands',
  reported_broken_at: 'reportedBrokenAt',
  last_checked: 'lastChecked',
  data_quality_flags: 'dataQualityFlags',
  gender_applies_to: 'genderAppliesTo',
  catalogue_enriched_at: 'catalogueEnrichedAt',
  added_date: 'addedDate',
  image_url: 'imageUrl',
  ai_classifications: 'aiClassifications',
  quality_score: 'qualityScore',
  retailer_id: 'retailerId',
  source_type: 'sourceType',
  affiliate_url: 'affiliateUrl',
  gift_type_tags: 'giftTypeTags',
  age_restricted: 'ageRestricted',
  
  // GiftList fields
  recipient_id: 'recipientId',
  subscriber_user_id: 'subscriberUserId',
  birthday_date: 'birthdayDate',
  list_type: 'listType',
  generated_at: 'generatedAt',
  approved_at: 'approvedAt',
  visible_to_subscriber: 'visibleToSubscriber',
  ai_prompt_used: 'aiPromptUsed',
  supersedes_list_id: 'supersedesListId',
  refresh_requested_at: 'refreshRequestedAt',
  refresh_reason: 'refreshReason',
  rejection_reason: 'rejectionReason',
  rejection_note: 'rejectionNote',
  
  // GiftItem fields
  gift_list_id: 'giftListId',
  product_id: 'productId',
  why_this_gift: 'whyThisGift',
  retailer_name: 'retailerName',
  source_type: 'sourceType',
  delivery_speed: 'deliverySpeed',
  subscriber_action: 'subscriberAction',
  admin_feedback_reason: 'adminFeedbackReason',
  admin_feedback_note: 'adminFeedbackNote',
  selection_score: 'selectionScore',
  matched_signals: 'matchedSignals',
  suitability_confidence: 'suitabilityConfidence',
  suitability_reasoning: 'suitabilityReasoning',
  ai_flag_concern: 'aiFlagConcern',
  
  // EmailLog fields
  email_type: 'emailType',
  occasion_year: 'occasionYear',
  sent_at: 'sentAt',
  
  // ScrapeRunLog fields
  run_date: 'runDate',
  retailer_name: 'retailerName',
  scrape_status: 'scrapeStatus',
  discovery_method: 'discoveryMethod',
  new_products: 'newProducts',
  reject_reasons_json: 'rejectReasonsJson',
  
  // ScrapeState fields
  is_running: 'isRunning',
  started_at: 'startedAt',
  heartbeat_at: 'heartbeatAt',
  last_completed_at: 'lastCompletedAt',
  last_run_summary: 'lastRunSummary',
  
  // TrendStats fields
  stat_key: 'statKey',
  computed_at: 'computedAt',
  items_analysed: 'itemsAnalysed',
  category_stats: 'categoryStats',
  retailer_stats: 'retailerStats',
  price_band_stats: 'priceBandStats',
  rejection_reason_counts: 'rejectionReasonCounts',
  recent_loved_titles: 'recentLovedTitles',
  recent_rejected_titles: 'recentRejectedTitles',
};

// Enum value mappings from Base44 to Prisma
const ENUM_MAPPINGS = {
  // Retailer category
  'Men': 'MEN',
  'Women': 'WOMEN',
  'Unisex (Adult)': 'UNISEX_ADULT',
  'Kids': 'KIDS',
  'Unisex + Kids': 'UNISEX_KIDS',
  
  // Subscription status
  'active': 'ACTIVE',
  'cancelled': 'CANCELLED',
  'past_due': 'PAST_DUE',
  'trialling': 'TRIALLING',
  
  // Gender
  'Male': 'MALE',
  'Female': 'FEMALE',
  'Non-binary': 'NON_BINARY',
  'Prefer not to say': 'PREFER_NOT_TO_SAY',
  
  // Age band
  'Under 5': 'UNDER_5',
  '5-10': 'FIVE_TO_10',
  '11-17': 'ELEVEN_TO_17',
  '18-30': 'EIGHTEEN_TO_30',
  '31-50': 'THIRTY_ONE_TO_50',
  '51-70': 'FIFTY_ONE_TO_70',
  '71+': 'SEVENTY_PLUS',
  
  // Source type
  'curated_product': 'CURATED_PRODUCT',
  'curated_retailer': 'CURATED_RETAILER',
  'shopify_upload': 'SHOPIFY_UPLOAD',
  'legacy_unknown': 'LEGACY_UNKNOWN',
  
  // Product status
  'active': 'ACTIVE',
  'inactive': 'INACTIVE',
  'needs_review': 'NEEDS_REVIEW',
  'reported_broken': 'REPORTED_BROKEN',
  
  // List type
  'curated': 'CURATED',
  'last_minute': 'LAST_MINUTE',
  'experience_digital': 'EXPERIENCE_DIGITAL',
  
  // List status
  'generating': 'GENERATING',
  'pending_approval': 'PENDING_APPROVAL',
  'approved': 'APPROVED',
  'sent': 'SENT',
  'rejected': 'REJECTED',
  
  // Delivery speed
  'standard': 'STANDARD',
  'next_day': 'NEXT_DAY',
  'experience': 'EXPERIENCE',
  'digital': 'DIGITAL',
  
  // Gift item status
  'active': 'ACTIVE',
  'standby': 'STANDBY',
  'swapped': 'SWAPPED',
  'removed': 'REMOVED',
  
  // Discovery method
  'shopify': 'SHOPIFY',
  'sitemap': 'SITEMAP',
  'crawl': 'CRAWL',
  'none': 'NONE',
  
  // Scrape status
  'ok': 'OK',
  'no_products': 'NO_PRODUCTS',
  'error': 'ERROR',
  'skipped_no_source': 'SKIPPED_NO_SOURCE',
};

function readCSV(filename) {
  const filepath = path.join(CSV_DIR, filename);
  if (!fs.existsSync(filepath)) {
    console.log(`⚠️  File not found: ${filename}`);
    return [];
  }
  
  const content = fs.readFileSync(filepath, 'utf-8');
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
  
  return records;
}

function transformFieldName(csvFieldName) {
  return FIELD_MAPPINGS[csvFieldName] || csvFieldName;
}

function transformValue(value, fieldName) {
  // Handle empty strings
  if (value === '' || value === 'null' || value === 'NULL') {
    return null;
  }
  
  // Handle booleans
  if (value === 'true') return true;
  if (value === 'false') return false;
  
  // Handle JSON fields
  if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
    try {
      return JSON.parse(value);
    } catch (e) {
      // If parsing fails, return as string
      return value;
    }
  }
  
  // Handle enum mappings
  if (ENUM_MAPPINGS[value]) {
    return ENUM_MAPPINGS[value];
  }
  
  // Handle birthday date format (--MM-DD or '--MM-DD)
  if (fieldName === 'birthdayDate' && typeof value === 'string') {
    // birthdayDate in CSV comes as '--08-18 or --MM-DD format
    // Skip it or convert to null since it's not a valid ISO date
    return null;
  }
  
  // Handle dates
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return new Date(value);
  }
  
  // Handle numbers
  if (typeof value === 'string' && !isNaN(value) && value !== '') {
    const num = parseFloat(value);
    if (!isNaN(num)) return num;
  }
  
  return value;
}

function transformRecord(record) {
  const transformed = {};
  
  for (const [key, value] of Object.entries(record)) {
    const newKey = transformFieldName(key);
    transformed[newKey] = transformValue(value, newKey);
  }
  
  // Remove system fields that shouldn't be imported
  delete transformed.is_sample;
  delete transformed.createdAt; // Let Prisma set these
  delete transformed.updatedAt;
  delete transformed.createdById; // Remove this field (not in all schemas)
  
  return transformed;
}

async function importRetailers() {
  console.log('\n📦 Importing Retailers...');
  const records = readCSV('Retailer_export.csv');
  
  let imported = 0;
  for (const record of records) {
    try {
      const data = transformRecord(record);
      await prisma.retailer.upsert({
        where: { id: data.id },
        update: data,
        create: data,
      });
      imported++;
    } catch (error) {
      console.error(`   ❌ Error importing retailer ${record.name}:`, error.message);
    }
  }
  
  console.log(`   ✅ Imported ${imported}/${records.length} retailers`);
}

async function importSubscribers() {
  console.log('\n📦 Importing Subscribers...');
  const records = readCSV('Subscriber_export.csv');
  
  let imported = 0;
  for (const record of records) {
    try {
      const data = transformRecord(record);
      
      // Create or get the user for this subscriber
      let userId = data.subscriberId || data.id;
      
      // First, ensure a user exists for this subscriber
      await prisma.user.upsert({
        where: { id: userId },
        update: {},
        create: {
          id: userId,
          email: data.email || `subscriber-${data.id}@youremembered.com`,
          role: 'USER',
        },
      });
      
      // Now create/update the subscriber
      await prisma.subscriber.upsert({
        where: { id: data.id },
        update: {
          name: data.name,
          firstName: data.firstName,
          email: data.email,
          howHeard: data.howHeard,
          stripeCustomerId: data.stripeCustomerId,
          stripeSubscriptionId: data.stripeSubscriptionId,
          subscriptionStatus: data.subscriptionStatus,
          subscribedSince: data.subscribedSince,
        },
        create: {
          id: data.id,
          name: data.name,
          firstName: data.firstName,
          email: data.email,
          howHeard: data.howHeard,
          stripeCustomerId: data.stripeCustomerId,
          stripeSubscriptionId: data.stripeSubscriptionId,
          subscriptionStatus: data.subscriptionStatus,
          subscribedSince: data.subscribedSince,
          createdBy: {
            connect: { id: userId }
          }
        },
      });
      imported++;
    } catch (error) {
      console.error(`   ❌ Error importing subscriber ${record.name}:`, error.message);
    }
  }
  
  console.log(`   ✅ Imported ${imported}/${records.length} subscribers`);
}

async function importRecipients() {
  console.log('\n📦 Importing Recipients...');
  const records = readCSV('Recipient_export.csv');
  
  let imported = 0;
  for (const record of records) {
    try {
      const data = transformRecord(record);
      
      // Check if subscriber exists
      const subscriber = await prisma.subscriber.findUnique({
        where: { id: data.subscriberId }
      });
      
      if (!subscriber) {
        console.log(`   ⚠️  Skipping recipient ${record.name} - subscriber not found`);
        continue;
      }
      
      // Get the user ID from the subscriber
      const userId = subscriber.createdById;
      
      // Ensure birthday is in correct format (--MM-DD)
      if (typeof data.birthday === 'string' && data.birthday.startsWith("'")) {
        data.birthday = data.birthday.substring(1); // Remove leading '
      }
      
      await prisma.recipient.upsert({
        where: { id: data.id },
        update: {
          name: data.name,
          relationship: data.relationship,
          occasion: data.occasion,
          occasionDay: data.occasionDay,
          occasionMonth: data.occasionMonth,
          occasions: data.occasions,
          birthday: data.birthday,
          gender: data.gender,
          ageRange: data.ageRange,
          childAgeBracket: data.childAgeBracket,
          ageBand: data.ageBand,
          budgetMin: data.budgetMin,
          budgetMax: data.budgetMax,
          interests: data.interests,
          personality: data.personality,
          giftTypes: data.giftTypes,
          avoidNotes: data.avoidNotes,
          whoTheyAre: data.whoTheyAre,
          hobbiesAndInterests: data.hobbiesAndInterests,
          thingsYouKnow: data.thingsYouKnow,
          milestones: data.milestones,
          involvementLevel: data.involvementLevel,
          commsPreferences: data.commsPreferences,
          notes: data.notes,
          lastGiftGenerated: data.lastGiftGenerated,
          derivedProfile: data.derivedProfile,
          derivedProfileHash: data.derivedProfileHash,
        },
        create: {
          id: data.id,
          name: data.name,
          relationship: data.relationship,
          occasion: data.occasion,
          occasionDay: data.occasionDay,
          occasionMonth: data.occasionMonth,
          occasions: data.occasions,
          birthday: data.birthday,
          gender: data.gender,
          ageRange: data.ageRange,
          childAgeBracket: data.childAgeBracket,
          ageBand: data.ageBand,
          budgetMin: data.budgetMin,
          budgetMax: data.budgetMax,
          interests: data.interests,
          personality: data.personality,
          giftTypes: data.giftTypes,
          avoidNotes: data.avoidNotes,
          whoTheyAre: data.whoTheyAre,
          hobbiesAndInterests: data.hobbiesAndInterests,
          thingsYouKnow: data.thingsYouKnow,
          milestones: data.milestones,
          involvementLevel: data.involvementLevel,
          commsPreferences: data.commsPreferences,
          notes: data.notes,
          lastGiftGenerated: data.lastGiftGenerated,
          derivedProfile: data.derivedProfile,
          derivedProfileHash: data.derivedProfileHash,
          subscriber: {
            connect: { id: data.subscriberId }
          },
          owner: {
            connect: { id: userId }
          }
        },
      });
      imported++;
    } catch (error) {
      console.error(`   ❌ Error importing recipient ${record.name}:`, error.message);
    }
  }
  
  console.log(`   ✅ Imported ${imported}/${records.length} recipients`);
}

async function importProducts() {
  console.log('\n📦 Importing Products...');
  const records = readCSV('Product_export.csv');
  
  let imported = 0;
  let skipped = 0;
  
  for (const record of records) {
    try {
      const data = transformRecord(record);
      
      // Check if retailer exists
      const retailerExists = await prisma.retailer.findUnique({
        where: { id: data.retailerId }
      });
      
      if (!retailerExists) {
        skipped++;
        continue;
      }
      
      await prisma.product.upsert({
        where: { id: data.id },
        update: data,
        create: data,
      });
      imported++;
      
      if (imported % 100 === 0) {
        console.log(`   📊 Progress: ${imported} products imported...`);
      }
    } catch (error) {
      console.error(`   ❌ Error importing product ${record.name}:`, error.message);
    }
  }
  
  console.log(`   ✅ Imported ${imported}/${records.length} products (${skipped} skipped)`);
}

async function importGiftLists() {
  console.log('\n📦 Importing Gift Lists...');
  const records = readCSV('GiftList_export.csv');
  
  let imported = 0;
  let skipped = 0;
  for (const record of records) {
    try {
      const data = transformRecord(record);
      
      // Check if recipient and subscriber exist
      const recipientExists = await prisma.recipient.findUnique({
        where: { id: data.recipientId }
      });
      
      const subscriberExists = await prisma.subscriber.findUnique({
        where: { id: data.subscriberId }
      });
      
      if (!recipientExists || !subscriberExists) {
        skipped++;
        continue;
      }
      
      // birthdayDate already handled by transformValue (returns null for invalid formats)
      
      await prisma.giftList.upsert({
        where: { id: data.id },
        update: data,
        create: data,
      });
      imported++;
    } catch (error) {
      console.error(`   ❌ Error importing gift list:`, error.message);
    }
  }
  
  console.log(`   ✅ Imported ${imported}/${records.length} gift lists (${skipped} skipped)`);
}

async function importGiftItems() {
  console.log('\n📦 Importing Gift Items...');
  const records = readCSV('GiftItem_export.csv');
  
  let imported = 0;
  let skipped = 0;
  for (const record of records) {
    try {
      const data = transformRecord(record);
      
      // Check if gift list and product exist
      const giftListExists = await prisma.giftList.findUnique({
        where: { id: data.giftListId }
      });
      
      const productExists = await prisma.product.findUnique({
        where: { id: data.productId }
      });
      
      if (!giftListExists || !productExists) {
        skipped++;
        continue;
      }
      
      await prisma.giftItem.upsert({
        where: { id: data.id },
        update: data,
        create: data,
      });
      imported++;
      
      if (imported % 50 === 0) {
        console.log(`   📊 Progress: ${imported} gift items imported...`);
      }
    } catch (error) {
      console.error(`   ❌ Error importing gift item:`, error.message);
    }
  }
  
  console.log(`   ✅ Imported ${imported}/${records.length} gift items (${skipped} skipped)`);
}

async function importEmailLogs() {
  console.log('\n📦 Importing Email Logs...');
  const records = readCSV('EmailLog_export.csv');
  
  let imported = 0;
  for (const record of records) {
    try {
      const data = transformRecord(record);
      
      await prisma.emailLog.create({
        data,
      });
      imported++;
    } catch (error) {
      console.error(`   ❌ Error importing email log:`, error.message);
    }
  }
  
  console.log(`   ✅ Imported ${imported}/${records.length} email logs`);
}

async function importOtherData() {
  console.log('\n📦 Importing Other Data...');
  
  // SignupAttempts
  try {
    const signups = readCSV('SignupAttempt_export.csv');
    for (const record of signups) {
      const data = transformRecord(record);
      await prisma.signupAttempt.create({ data });
    }
    console.log(`   ✅ Imported ${signups.length} signup attempts`);
  } catch (error) {
    console.log(`   ⚠️  Signup attempts: ${error.message}`);
  }
  
  // ScrapeRunLogs
  try {
    const scrapeLogs = readCSV('ScrapeRunLog_export.csv');
    for (const record of scrapeLogs) {
      const data = transformRecord(record);
      await prisma.scrapeRunLog.create({ data });
    }
    console.log(`   ✅ Imported ${scrapeLogs.length} scrape logs`);
  } catch (error) {
    console.log(`   ⚠️  Scrape logs: ${error.message}`);
  }
  
  // ScrapeState
  try {
    const scrapeStates = readCSV('ScrapeState_export.csv');
    for (const record of scrapeStates) {
      const data = transformRecord(record);
      await prisma.scrapeState.create({ data });
    }
    console.log(`   ✅ Imported scrape state`);
  } catch (error) {
    console.log(`   ⚠️  Scrape state: ${error.message}`);
  }
  
  // TrendStats
  try {
    const trendStats = readCSV('TrendStats_export.csv');
    for (const record of trendStats) {
      const data = transformRecord(record);
      await prisma.trendStats.create({ data });
    }
    console.log(`   ✅ Imported trend stats`);
  } catch (error) {
    console.log(`   ⚠️  Trend stats: ${error.message}`);
  }
}

async function main() {
  console.log('🚀 Importing Real CSV Data from Base44\n');
  console.log('=' .repeat(60) + '\n');

  try {
    // Import in order of dependencies
    await importRetailers();
    await importSubscribers();
    await importRecipients();
    await importProducts();
    await importGiftLists();
    await importGiftItems();
    await importEmailLogs();
    await importOtherData();
    
    // Show final counts
    console.log('\n📊 Final Database Counts:');
    const counts = {
      retailers: await prisma.retailer.count(),
      subscribers: await prisma.subscriber.count(),
      recipients: await prisma.recipient.count(),
      products: await prisma.product.count(),
      giftLists: await prisma.giftList.count(),
      giftItems: await prisma.giftItem.count(),
      emailLogs: await prisma.emailLog.count(),
      users: await prisma.user.count(),
    };
    
    Object.entries(counts).forEach(([entity, count]) => {
      console.log(`   ${entity}: ${count}`);
    });
    
    console.log('\n✅ Import completed successfully!\n');
    
  } catch (error) {
    console.error('\n❌ Import failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
