import { PrismaClient } from '@prisma/client';
import { IntelligentMatcher } from '../server/services/gifts/intelligent-matcher.js';

const prisma = new PrismaClient();
const matcher = new IntelligentMatcher();

async function debugProduct() {
  try {
    const product = await prisma.product.findFirst({
      where: {
        name: {
          contains: '6 Cup Moka Exclusive'
        }
      }
    });
    
    if (!product) {
      console.log('Product not found');
      return;
    }
    
    console.log('🔍 DEBUGGING PRODUCT:\n');
    console.log(`Name: ${product.name}`);
    console.log(`Description: ${product.description?.substring(0, 200) || 'NO DESCRIPTION'}`);
    console.log(`Tags: ${product.interestTags?.join(', ')}`);
    console.log('');
    
    const recipient = {
      interests: ['Cooking & food', 'Watches', 'DIY & tools', 'Gardening', 'Tech & gadgets']
    };
    
    const hasMatch = matcher.hasInterestMatch(product, recipient);
    console.log(`Has match: ${hasMatch}`);
    console.log('');
    
    // Test each interest individually
    console.log('🔍 Testing each interest:\n');
    
    recipient.interests.forEach(interest => {
      console.log(`Interest: "${interest}"`);
      
      const taxonomy = matcher.getTaxonomyFor(interest);
      if (taxonomy) {
        console.log(`  Taxonomy keywords: ${taxonomy.keywords.join(', ')}`);
        
        const productText = [product.name, product.description]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        
        console.log(`  Product text: ${productText.substring(0, 100)}...`);
        
        // Check keyword matches
        const matchingKeywords = [];
        taxonomy.keywords.forEach(kw => {
          if (productText.includes(kw.toLowerCase())) {
            matchingKeywords.push(kw);
          }
        });
        
        if (matchingKeywords.length > 0) {
          console.log(`  ✅ Matching keywords: ${matchingKeywords.join(', ')}`);
        } else {
          console.log(`  ❌ No keyword matches`);
        }
      } else {
        console.log(`  ❌ No taxonomy found`);
      }
      console.log('');
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugProduct();
