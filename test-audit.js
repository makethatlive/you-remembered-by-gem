/**
 * Quick test script to debug the forensic audit endpoint
 * Run with: node test-audit.js
 */

async function testAudit() {
  try {
    console.log('Testing forensic audit endpoint...');
    
    const response = await fetch('http://localhost:3001/api/audit/forensic', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ write_sheet: false }),
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers));
    
    const text = await response.text();
    console.log('Response body (raw):', text);
    
    if (text) {
      try {
        const data = JSON.parse(text);
        console.log('Parsed JSON:', JSON.stringify(data, null, 2));
      } catch (e) {
        console.error('Failed to parse JSON:', e.message);
      }
    } else {
      console.error('Empty response body!');
    }
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testAudit();
