#!/usr/bin/env node
/**
 * Test script to verify retailer edit form data mapping
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Map database enum values to display values
const CATEGORY_ENUM_TO_DISPLAY = {
  "MEN": "Men",
  "WOMEN": "Women", 
  "UNISEX_ADULT": "Unisex (Adult)",
  "KIDS": "Kids",
  "UNISEX_KIDS": "Unisex + Kids",
};

async function testRetailerMapping() {
  try {
    console.log('🧪 Testing retailer data mapping...\n');
    
    // Get adorn-shop retailer
    const retailer = await prisma.retailer.findFirst({
      where: {
        name: {
          contains: 'adorn-shop',
          mode: 'insensitive'
        }
      }
    });

    if (!retailer) {
      console.log('❌ Retailer not found!');
      return;
    }

    console.log('✅ Retailer found:', retailer.name, '\n');
    
    // Simulate what form receives (with camelCase from base44Client.toCamelCase)
    const formData = {
      name: retailer.name,
      websiteUrl: retailer.websiteUrl,
      giftPageUrl: retailer.giftPageUrl,
      category: retailer.category,
      appliesTo: retailer.appliesTo,
      containsAgeRestrictedItems: retailer.containsAgeRestrictedItems,
      whatTheySell: retailer.whatTheySell,
      whyItFits: retailer.whyItFits,
      active: retailer.active,
    };
    
    console.log('📦 Data as received by form (camelCase):');
    console.log(JSON.stringify(formData, null, 2));
    console.log('\n');
    
    // Simulate form initialization
    console.log('📝 Form field values after initialization:');
    console.log('  name:', formData.name || '(empty)');
    console.log('  website_url:', formData.websiteUrl || '(empty)');
    console.log('  gift_page_url:', formData.giftPageUrl || '(empty)');
    console.log('  category (raw):', formData.category || '(empty)');
    console.log('  category (display):', CATEGORY_ENUM_TO_DISPLAY[formData.category] || formData.category || '(empty)');
    console.log('  applies_to:', formData.appliesTo || '(empty)');
    console.log('  contains_age_restricted_items:', formData.containsAgeRestrictedItems);
    console.log('  what_they_sell:', formData.whatTheySell || '(empty)');
    console.log('  why_it_fits:', formData.whyItFits || '(empty)');
    console.log('  active:', formData.active);
    
    console.log('\n✅ All fields should be populated correctly!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testRetailerMapping();
