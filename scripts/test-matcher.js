import { IntelligentMatcher } from '../server/services/gifts/intelligent-matcher.js';

const matcher = new IntelligentMatcher();

// Test product
const product = {
  name: "BERNADOTTE Teapot",
  interestTags: ["Cooking & food", "Wine & drinks"]
};

// Test recipient (Ben)
const recipient = {
  interests: ["Cooking & food", "Watches", "DIY & tools", "Gardening", "Tech & gadgets"]
};

console.log('🧪 TESTING INTELLIGENT MATCHER\n');
console.log('Product tags:', product.interestTags);
console.log('Recipient interests:', recipient.interests);
console.log('');

// Test hasInterestMatch
const hasMatch = matcher.hasInterestMatch(product, recipient);
console.log(`hasInterestMatch result: ${hasMatch}`);
console.log('');

// Test individual matches
console.log('🔍 DETAILED MATCH TESTING:\n');

product.interestTags.forEach(productTag => {
  console.log(`Product tag: "${productTag}"`);
  
  recipient.interests.forEach(recipientInterest => {
    const matchQuality = matcher.getMatchQuality(productTag, recipientInterest);
    console.log(`  vs "${recipientInterest}" → ${matchQuality}`);
  });
  console.log('');
});

// Test taxonomy lookup
console.log('🗂️  TAXONOMY LOOKUP TEST:\n');
recipient.interests.forEach(interest => {
  const taxonomy = matcher.getTaxonomyFor(interest);
  console.log(`Interest: "${interest}"`);
  if (taxonomy) {
    console.log(`  ✅ Found: key="${taxonomy.key}"`);
    console.log(`  Keywords: ${taxonomy.keywords?.join(', ')}`);
  } else {
    console.log(`  ❌ NOT FOUND in taxonomy`);
  }
  console.log('');
});
