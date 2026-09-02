/**
 * Test script to directly query the Recipients API
 */

const subscriberId = '6a82fcc8dd23ed146cdc7a8f';

console.log('🧪 Testing Recipients API...\n');
console.log('Subscriber ID:', subscriberId);

const url = `http://localhost:3001/api/recipients?subscriber_id=${subscriberId}`;
console.log('URL:', url);
console.log('\n🌐 Fetching...\n');

fetch(url)
  .then(response => {
    console.log('Status:', response.status, response.statusText);
    return response.json();
  })
  .then(data => {
    console.log('\n📦 Response:');
    console.log(JSON.stringify(data, null, 2));
    console.log('\n✅ Found', data.length, 'recipient(s)');
    
    if (data.length > 0) {
      data.forEach(r => {
        console.log(`   - ${r.name} (ID: ${r.id})`);
      });
    }
  })
  .catch(error => {
    console.error('\n❌ Error:', error.message);
  });
