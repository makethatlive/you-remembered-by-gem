#!/usr/bin/env node
/**
 * Check database connection status
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkConnection() {
  console.log('🔍 Checking database connection...\n');
  
  try {
    // Test 1: Basic connection
    console.log('Test 1: Basic connection test');
    await prisma.$connect();
    console.log('✅ Database connected successfully!\n');
    
    // Test 2: Query test
    console.log('Test 2: Running simple query');
    const count = await prisma.product.count();
    console.log(`✅ Query successful! Found ${count} products\n`);
    
    // Test 3: Check database info
    console.log('Test 3: Database information');
    const result = await prisma.$queryRaw`SELECT version()`;
    console.log('✅ Database version:', result[0].version);
    
    console.log('\n✅ All connection tests passed!\n');
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.error('\nPossible causes:');
    console.error('1. Railway database is sleeping (wake it up by visiting Railway dashboard)');
    console.error('2. Network connectivity issue');
    console.error('3. Database credentials changed');
    console.error('4. Connection limit reached\n');
    
    console.log('Database URL (masked):', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':****@'));
    
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

checkConnection()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
