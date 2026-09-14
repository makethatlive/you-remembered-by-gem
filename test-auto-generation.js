/**
 * Test script for auto-generation functionality
 * Tests the calculateDaysUntilBirthday helper and simulates recipient creation
 */

/**
 * Calculate days until next occurrence of a birthday
 */
function calculateDaysUntilBirthday(day, month) {
  if (!day || !month) return null;
  
  const now = new Date();
  const currentYear = now.getFullYear();
  
  // Create date for this year's birthday
  let nextBirthday = new Date(currentYear, month - 1, day);
  
  // If birthday has already passed this year, use next year
  if (nextBirthday < now) {
    nextBirthday = new Date(currentYear + 1, month - 1, day);
  }
  
  // Calculate difference in days
  const diffTime = nextBirthday.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

console.log('🧪 Testing Auto-Generation Logic\n');
console.log('='.repeat(60));

// Test cases
const testCases = [
  { name: 'Birthday in 30 days', day: 10, month: 10, expectedRange: [25, 35] },
  { name: 'Birthday in 42 days', day: 22, month: 10, expectedRange: [37, 47] },
  { name: 'Birthday in 50 days', day: 30, month: 10, expectedRange: [45, 55] },
  { name: 'Birthday in 10 days', day: 20, month: 9, expectedRange: [5, 15] },
  { name: 'Birthday next year', day: 1, month: 1, expectedRange: [80, 120] },
];

console.log('\n📅 Current Date:', new Date().toISOString().split('T')[0]);
console.log('\n');

testCases.forEach(testCase => {
  const daysUntil = calculateDaysUntilBirthday(testCase.day, testCase.month);
  const shouldAutoGenerate = daysUntil !== null && daysUntil <= 42;
  
  console.log(`Test: ${testCase.name}`);
  console.log(`   Date: ${testCase.month}/${testCase.day}`);
  console.log(`   Days until: ${daysUntil}`);
  console.log(`   Auto-generate: ${shouldAutoGenerate ? '✅ YES' : '⏰ NO (will wait)'}`);
  console.log('');
});

console.log('='.repeat(60));
console.log('\n✅ Logic Test Complete\n');

console.log('📝 Auto-Generation Rules:');
console.log('   • If birthday is ≤ 42 days away: Auto-generate immediately');
console.log('   • If birthday is > 42 days away: Wait for daily job at 6-week mark');
console.log('   • Daily job runs at 9:00 AM, checks recipients at 41-43 days');
console.log('');
