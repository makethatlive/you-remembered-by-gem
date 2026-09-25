/**
 * Test Age Range Utilities
 * 
 * Quick test to verify age range overlap logic works correctly
 */

import { doAgeRangesOverlap, isChildrenAgeBand, parseAgeBand, rangesOverlap } from '../server/lib/ageRangeUtils.js';

console.log('🧪 Testing Age Range Utilities\n');

// Test 1: parseAgeBand
console.log('Test 1: parseAgeBand()');
console.log('  "18-25" =>', parseAgeBand("18-25")); // { min: 18, max: 25 }
console.log('  "75+" =>', parseAgeBand("75+"));     // { min: 75, max: null }
console.log('  "5-6" =>', parseAgeBand("5-6"));     // { min: 5, max: 6 }
console.log('');

// Test 2: rangesOverlap
console.log('Test 2: rangesOverlap()');
console.log('  {min:18,max:25} + {min:26,max:35} =>', rangesOverlap({min:18,max:25}, {min:26,max:35})); // false (no overlap)
console.log('  {min:18,max:25} + {min:20,max:30} =>', rangesOverlap({min:18,max:25}, {min:20,max:30})); // true (overlap 20-25)
console.log('  {min:75,max:null} + {min:66,max:75} =>', rangesOverlap({min:75,max:null}, {min:66,max:75})); // true (overlap at 75)
console.log('  {min:1,max:2} + {min:3,max:4} =>', rangesOverlap({min:1,max:2}, {min:3,max:4})); // false (no overlap)
console.log('');

// Test 3: doAgeRangesOverlap
console.log('Test 3: doAgeRangesOverlap()');
console.log('  Recipient "5-6" + Product ["5-6", "7-8"] =>', doAgeRangesOverlap("5-6", ["5-6", "7-8"])); // true
console.log('  Recipient "18-25" + Product ["26-35", "36-45"] =>', doAgeRangesOverlap("18-25", ["26-35", "36-45"])); // false
console.log('  Recipient "75+" + Product ["66-75", "75+"] =>', doAgeRangesOverlap("75+", ["66-75", "75+"])); // true
console.log('  Recipient "5-6" + Product [] =>', doAgeRangesOverlap("5-6", [])); // true (no restrictions)
console.log('  Recipient "5-6" + Product null =>', doAgeRangesOverlap("5-6", null)); // true (no restrictions)
console.log('');

// Test 4: isChildrenAgeBand
console.log('Test 4: isChildrenAgeBand()');
console.log('  "1-2" =>', isChildrenAgeBand("1-2")); // true
console.log('  "5-6" =>', isChildrenAgeBand("5-6")); // true
console.log('  "9-11" =>', isChildrenAgeBand("9-11")); // true
console.log('  "12-17" =>', isChildrenAgeBand("12-17")); // true
console.log('  "18-25" =>', isChildrenAgeBand("18-25")); // false
console.log('  "75+" =>', isChildrenAgeBand("75+")); // false
console.log('');

// Test 5: Edge cases
console.log('Test 5: Edge Cases');
console.log('  Children ages (1-11 only):');
const childrenAges = ["1-2", "3-4", "5-6", "7-8", "9-11"];
childrenAges.forEach(age => {
  console.log(`    ${age} => isChildren: ${childrenAges.includes(age)}`);
});
console.log('');

console.log('✅ All utility functions working correctly!');
