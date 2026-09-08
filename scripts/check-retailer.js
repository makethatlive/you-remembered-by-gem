#!/usr/bin/env node
/**
 * Check a specific retailer in the database
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkRetailer() {
  try {
    console.log('🔍 Searching for retailer: adorn-shop.co.uk\n');
    
    // Search by name
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

    console.log('✅ Retailer found!\n');
    console.log('='.repeat(80));
    console.log('RETAILER DATA:');
    console.log('='.repeat(80));
    
    // Format the output
    Object.entries(retailer).forEach(([key, value]) => {
      if (value === null) {
        console.log(`${key.padEnd(30)}: NULL`);
      } else if (value === '') {
        console.log(`${key.padEnd(30)}: "" (empty string)`);
      } else if (typeof value === 'boolean') {
        console.log(`${key.padEnd(30)}: ${value}`);
      } else if (value instanceof Date) {
        console.log(`${key.padEnd(30)}: ${value.toISOString()}`);
      } else {
        console.log(`${key.padEnd(30)}: ${value}`);
      }
    });
    
    console.log('='.repeat(80));
    console.log('\n📋 MISSING/EMPTY FIELDS:');
    console.log('='.repeat(80));
    
    const fieldsToCheck = [
      'website_url',
      'gift_page_url',
      'category',
      'applies_to',
      'what_they_sell',
      'why_it_fits'
    ];
    
    fieldsToCheck.forEach(field => {
      const value = retailer[field];
      if (value === null || value === '' || value === undefined) {
        console.log(`❌ ${field.padEnd(25)}: ${value === null ? 'NULL' : value === '' ? 'EMPTY' : 'UNDEFINED'}`);
      } else {
        console.log(`✅ ${field.padEnd(25)}: Has value`);
      }
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkRetailer();
