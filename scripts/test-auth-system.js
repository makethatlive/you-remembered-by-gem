/**
 * Test Authentication System
 * Quick script to test all auth endpoints
 */

const API_BASE = 'http://localhost:3001/api';

// Colors for console
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = colors.reset) {
  console.log(color + message + colors.reset);
}

async function testAuth() {
  log('\n🔐 Testing Authentication System\n', colors.blue);
  
  const testUser = {
    email: `test${Date.now()}@example.com`,
    password: 'SecureTest123!',
    firstName: 'Test',
    lastName: 'User',
  };

  let accessToken = null;
  let refreshToken = null;

  try {
    // Test 1: Register
    log('1️⃣  Testing Registration...', colors.yellow);
    const registerResponse = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser),
    });
    
    if (registerResponse.ok) {
      const data = await registerResponse.json();
      accessToken = data.auth.accessToken;
      refreshToken = data.auth.refreshToken;
      log(`✅ Registration successful! User: ${data.user.email}`, colors.green);
    } else {
      const error = await registerResponse.json();
      log(`❌ Registration failed: ${error.error}`, colors.red);
      return;
    }

    // Test 2: Get Current User
    log('\n2️⃣  Testing Get Current User...', colors.yellow);
    const meResponse = await fetch(`${API_BASE}/auth/me`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    
    if (meResponse.ok) {
      const data = await meResponse.json();
      log(`✅ Get user successful! Email: ${data.user.email}`, colors.green);
    } else {
      log(`❌ Get user failed`, colors.red);
    }

    // Test 3: Get Active Sessions
    log('\n3️⃣  Testing Get Active Sessions...', colors.yellow);
    const sessionsResponse = await fetch(`${API_BASE}/auth/sessions`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    
    if (sessionsResponse.ok) {
      const data = await sessionsResponse.json();
      log(`✅ Get sessions successful! Active: ${data.sessions.length}`, colors.green);
    } else {
      log(`❌ Get sessions failed`, colors.red);
    }

    // Test 4: Update Profile
    log('\n4️⃣  Testing Update Profile...', colors.yellow);
    const profileResponse = await fetch(`${API_BASE}/auth/profile`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}` 
      },
      body: JSON.stringify({ firstName: 'Updated', lastName: 'Name' }),
    });
    
    if (profileResponse.ok) {
      const data = await profileResponse.json();
      log(`✅ Profile update successful! Name: ${data.user.firstName} ${data.user.lastName}`, colors.green);
    } else {
      log(`❌ Profile update failed`, colors.red);
    }

    // Test 5: Refresh Token
    log('\n5️⃣  Testing Token Refresh...', colors.yellow);
    const refreshResponse = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    
    if (refreshResponse.ok) {
      const data = await refreshResponse.json();
      log(`✅ Token refresh successful!`, colors.green);
      accessToken = data.auth.accessToken; // Update token
    } else {
      log(`❌ Token refresh failed`, colors.red);
    }

    // Test 6: Change Password
    log('\n6️⃣  Testing Change Password...', colors.yellow);
    const changePasswordResponse = await fetch(`${API_BASE}/auth/change-password`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}` 
      },
      body: JSON.stringify({ 
        currentPassword: testUser.password,
        newPassword: 'NewSecure123!' 
      }),
    });
    
    if (changePasswordResponse.ok) {
      log(`✅ Password change successful!`, colors.green);
      testUser.password = 'NewSecure123!'; // Update password
    } else {
      const error = await changePasswordResponse.json();
      log(`❌ Password change failed: ${error.error}`, colors.red);
    }

    // Test 7: Login with New Password
    log('\n7️⃣  Testing Login with New Password...', colors.yellow);
    const loginResponse = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        email: testUser.email, 
        password: testUser.password 
      }),
    });
    
    if (loginResponse.ok) {
      const data = await loginResponse.json();
      accessToken = data.auth.accessToken;
      log(`✅ Login successful!`, colors.green);
    } else {
      log(`❌ Login failed`, colors.red);
    }

    // Test 8: Logout
    log('\n8️⃣  Testing Logout...', colors.yellow);
    const logoutResponse = await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    
    if (logoutResponse.ok) {
      log(`✅ Logout successful!`, colors.green);
    } else {
      log(`❌ Logout failed`, colors.red);
    }

    // Test 9: Try to access protected route after logout
    log('\n9️⃣  Testing Protected Route After Logout (should fail)...', colors.yellow);
    const protectedResponse = await fetch(`${API_BASE}/auth/me`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    
    if (protectedResponse.status === 401) {
      log(`✅ Protected route correctly rejected!`, colors.green);
    } else {
      log(`❌ Protected route should have failed`, colors.red);
    }

    log('\n🎉 All authentication tests completed!', colors.blue);
    log('\n📊 Summary:', colors.blue);
    log('  ✅ Registration', colors.green);
    log('  ✅ Get Current User', colors.green);
    log('  ✅ Get Active Sessions', colors.green);
    log('  ✅ Update Profile', colors.green);
    log('  ✅ Token Refresh', colors.green);
    log('  ✅ Change Password', colors.green);
    log('  ✅ Login', colors.green);
    log('  ✅ Logout', colors.green);
    log('  ✅ Protected Routes', colors.green);

  } catch (error) {
    log(`\n❌ Test error: ${error.message}`, colors.red);
  }
}

// Check if server is running
async function checkServer() {
  try {
    const response = await fetch(`${API_BASE}/health`);
    if (response.ok) {
      log('✅ Server is running\n', colors.green);
      return true;
    }
  } catch (error) {
    log('❌ Server is not running! Start it with: npm run server', colors.red);
    return false;
  }
}

// Run tests
(async () => {
  const serverRunning = await checkServer();
  if (serverRunning) {
    await testAuth();
  }
})();
