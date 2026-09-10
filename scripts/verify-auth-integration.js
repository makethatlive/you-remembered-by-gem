/**
 * Verify Authentication Integration
 * Checks if all components are properly integrated
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

// Colors for console
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(color + message + colors.reset);
}

function checkFile(filePath, description) {
  const fullPath = path.join(projectRoot, filePath);
  const exists = fs.existsSync(fullPath);
  
  if (exists) {
    log(`✅ ${description}`, colors.green);
    return true;
  } else {
    log(`❌ ${description} - NOT FOUND: ${filePath}`, colors.red);
    return false;
  }
}

function checkFileContains(filePath, searchString, description) {
  const fullPath = path.join(projectRoot, filePath);
  
  if (!fs.existsSync(fullPath)) {
    log(`❌ ${description} - FILE NOT FOUND: ${filePath}`, colors.red);
    return false;
  }
  
  const content = fs.readFileSync(fullPath, 'utf8');
  const contains = content.includes(searchString);
  
  if (contains) {
    log(`✅ ${description}`, colors.green);
    return true;
  } else {
    log(`⚠️  ${description} - NOT FOUND IN FILE`, colors.yellow);
    return false;
  }
}

async function checkServer() {
  try {
    const response = await fetch('http://localhost:3001/api/health');
    if (response.ok) {
      log('✅ Server is running', colors.green);
      return true;
    }
  } catch (error) {
    log('❌ Server is NOT running', colors.red);
    log('   Start with: npm run server', colors.yellow);
    return false;
  }
}

async function checkAuthEndpoint() {
  try {
    const response = await fetch('http://localhost:3001/api/auth/me');
    // Should return 401 (unauthorized) which means endpoint exists
    if (response.status === 401) {
      log('✅ Auth endpoints are accessible', colors.green);
      return true;
    } else {
      log(`⚠️  Auth endpoint returned unexpected status: ${response.status}`, colors.yellow);
      return false;
    }
  } catch (error) {
    log('❌ Auth endpoints not accessible', colors.red);
    return false;
  }
}

async function verifyIntegration() {
  log('\n🔍 Verifying Authentication Integration\n', colors.blue);
  
  let score = 0;
  let total = 0;
  
  // Check backend files
  log('📁 Backend Files:', colors.cyan);
  total++; if (checkFile('server/routes/auth-routes.js', 'Auth routes file')) score++;
  total++; if (checkFile('server/middleware/auth-middleware.js', 'Auth middleware file')) score++;
  total++; if (checkFile('server/services/auth/jwt-service.js', 'JWT service file')) score++;
  total++; if (checkFile('server/services/auth/password-service.js', 'Password service file')) score++;
  
  console.log('');
  
  // Check server integration
  log('🔌 Server Integration:', colors.cyan);
  total++; if (checkFileContains('server/index.js', 'import authRoutes', 'Auth routes imported')) score++;
  total++; if (checkFileContains('server/index.js', 'app.use(\'/api/auth\', authRoutes)', 'Auth routes mounted')) score++;
  total++; if (checkFileContains('server/index.js', 'cookieParser', 'Cookie parser imported')) score++;
  total++; if (checkFileContains('server/index.js', 'app.use(cookieParser())', 'Cookie parser middleware added')) score++;
  
  console.log('');
  
  // Check database schema
  log('🗄️  Database Schema:', colors.cyan);
  total++; if (checkFileContains('prisma/schema.prisma', 'model Session', 'Session model exists')) score++;
  total++; if (checkFileContains('prisma/schema.prisma', 'password', 'User password field exists')) score++;
  total++; if (checkFileContains('prisma/schema.prisma', 'emailVerificationToken', 'Email verification field exists')) score++;
  
  console.log('');
  
  // Check frontend integration
  log('🎨 Frontend Integration:', colors.cyan);
  total++; if (checkFileContains('src/api/base44Client.js', 'export const auth', 'Auth API exported')) score++;
  total++; if (checkFileContains('src/api/base44Client.js', 'saveAuth', 'Token management functions')) score++;
  total++; if (checkFileContains('src/api/base44Client.js', 'getAuthHeaders', 'Auth header injection')) score++;
  
  console.log('');
  
  // Check configuration
  log('⚙️  Configuration:', colors.cyan);
  total++; if (checkFileContains('.env', 'JWT_SECRET', 'JWT_SECRET configured')) score++;
  total++; if (checkFileContains('.env', 'SESSION_SECRET', 'SESSION_SECRET configured')) score++;
  
  console.log('');
  
  // Check package dependencies
  log('📦 Dependencies:', colors.cyan);
  total++; if (checkFileContains('package.json', 'jsonwebtoken', 'jsonwebtoken installed')) score++;
  total++; if (checkFileContains('package.json', 'bcrypt', 'bcrypt installed')) score++;
  total++; if (checkFileContains('package.json', 'cookie-parser', 'cookie-parser installed')) score++;
  total++; if (checkFileContains('package.json', 'express-validator', 'express-validator installed')) score++;
  
  console.log('');
  
  // Check test script
  log('🧪 Testing:', colors.cyan);
  total++; if (checkFile('scripts/test-auth-system.js', 'Automated test script')) score++;
  total++; if (checkFileContains('package.json', 'test:auth', 'Test script in package.json')) score++;
  
  console.log('');
  
  // Check documentation
  log('📚 Documentation:', colors.cyan);
  total++; if (checkFile('AUTH_IMPLEMENTATION_COMPLETE.md', 'Technical documentation')) score++;
  total++; if (checkFile('AUTHENTICATION_QUICK_START.md', 'Quick start guide')) score++;
  total++; if (checkFile('AUTHENTICATION_COMPLETE_SUMMARY.md', 'Summary document')) score++;
  
  console.log('');
  
  // Check server (if running)
  log('🚀 Runtime Checks:', colors.cyan);
  const serverRunning = await checkServer();
  if (serverRunning) {
    total++; score++;
    total++; if (await checkAuthEndpoint()) score++;
  } else {
    log('⚠️  Skipping runtime checks (server not running)', colors.yellow);
    total += 2; // Account for skipped checks
  }
  
  console.log('');
  
  // Final score
  const percentage = Math.round((score / total) * 100);
  log('═══════════════════════════════════════', colors.cyan);
  log(`Integration Score: ${score}/${total} (${percentage}%)`, colors.blue);
  log('═══════════════════════════════════════', colors.cyan);
  
  console.log('');
  
  if (percentage === 100) {
    log('🎉 PERFECT! Authentication is fully integrated!', colors.green);
    log('✅ All components verified', colors.green);
    log('✅ Server integration complete', colors.green);
    log('✅ Frontend integration complete', colors.green);
    log('✅ Database schema updated', colors.green);
    log('✅ Configuration complete', colors.green);
    console.log('');
    log('Next step: Run tests with `npm run test:auth`', colors.cyan);
  } else if (percentage >= 80) {
    log('✅ Authentication is mostly integrated!', colors.green);
    log('⚠️  Some components may need attention (see above)', colors.yellow);
    console.log('');
    if (!serverRunning) {
      log('💡 Start server to complete verification: npm run server', colors.cyan);
    }
  } else if (percentage >= 60) {
    log('⚠️  Authentication is partially integrated', colors.yellow);
    log('❌ Some important components are missing (see above)', colors.yellow);
    console.log('');
    log('Review the integration steps in AUTHENTICATION_INTEGRATION_STATUS.md', colors.cyan);
  } else {
    log('❌ Authentication integration incomplete', colors.red);
    log('❌ Many components are missing', colors.red);
    console.log('');
    log('Follow the steps in AUTHENTICATION_QUICK_START.md', colors.cyan);
  }
  
  console.log('');
}

// Run verification
verifyIntegration().catch(error => {
  log(`\n❌ Verification error: ${error.message}`, colors.red);
  process.exit(1);
});
