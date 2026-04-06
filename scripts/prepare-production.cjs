/**
 * Paper Roll Management System - Production Preparation Script
 * 
 * This script helps prepare the application for production deployment.
 * Run with: node scripts/prepare-production.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const crypto = require('crypto');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('\n🚀 Paper Roll Management System - Production Preparation\n');

// Generate a secure random string for SESSION_SECRET
const generateSecureSecret = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Check if .env file exists
const envPath = path.join(__dirname, '..', '.env');
const envExamplePath = path.join(__dirname, '..', '.env.example');

// Start by creating a production .env if it doesn't exist
if (!fs.existsSync(envPath)) {
  if (fs.existsSync(envExamplePath)) {
    const envExample = fs.readFileSync(envExamplePath, 'utf8');
    
    // Create a production version with secure session secret
    const productionEnv = envExample
      .replace('SESSION_SECRET=change_this_to_a_secure_random_string', `SESSION_SECRET=${generateSecureSecret()}`)
      .replace('NODE_ENV=development', 'NODE_ENV=production');
    
    fs.writeFileSync(envPath, productionEnv);
    console.log('✅ Created .env file with secure session secret.');
  } else {
    console.log('❌ .env.example file not found. Creating a basic .env file...');
    
    const basicEnv = `# Database connection
DATABASE_URL=postgresql://neondb_owner:npg_pcXSilsK45Jf@ep-shy-mouse-and7gvny-pooler.c-6.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require
# Session secret (auto-generated)
SESSION_SECRET=${generateSecureSecret()}
# Environment
NODE_ENV=production
# Port
PORT=5000`;
    
    fs.writeFileSync(envPath, basicEnv);
    console.log('✅ Created basic .env file. Please update with your production database credentials.');
  }
} else {
  console.log('📋 Existing .env file found. Checking configuration...');
  
  let envContent = fs.readFileSync(envPath, 'utf8');
  let modified = false;
  
  // Check if we need to update the NODE_ENV
  if (!envContent.includes('NODE_ENV=production')) {
    rl.question('⚠️ Set NODE_ENV to production? (Y/n) ', (answer) => {
      if (answer.toLowerCase() !== 'n') {
        envContent = envContent.replace(/NODE_ENV=development/g, 'NODE_ENV=production');
        if (!envContent.includes('NODE_ENV=')) {
          envContent += '\nNODE_ENV=production';
        }
        modified = true;
      }
      
      // Check SESSION_SECRET
      if (envContent.includes('SESSION_SECRET=change_this') || 
          envContent.includes('SESSION_SECRET=your_') ||
          !envContent.includes('SESSION_SECRET=')) {
        
        rl.question('⚠️ Generate a secure SESSION_SECRET? (Y/n) ', (answer) => {
          if (answer.toLowerCase() !== 'n') {
            const newSecret = generateSecureSecret();
            
            if (envContent.includes('SESSION_SECRET=')) {
              envContent = envContent.replace(/SESSION_SECRET=.*/g, `SESSION_SECRET=${newSecret}`);
            } else {
              envContent += `\nSESSION_SECRET=${newSecret}`;
            }
            modified = true;
          }
          
          if (modified) {
            fs.writeFileSync(envPath, envContent);
            console.log('✅ Updated .env file with production settings.');
          }
          
          continuePreparation();
        });
      } else {
        if (modified) {
          fs.writeFileSync(envPath, envContent);
          console.log('✅ Updated .env file with production settings.');
        }
        continuePreparation();
      }
    });
  } else {
    console.log('✅ NODE_ENV already set to production.');
    
    // Check SESSION_SECRET
    if (envContent.includes('SESSION_SECRET=change_this') || 
        envContent.includes('SESSION_SECRET=your_') ||
        !envContent.includes('SESSION_SECRET=')) {
      
      rl.question('⚠️ Generate a secure SESSION_SECRET? (Y/n) ', (answer) => {
        if (answer.toLowerCase() !== 'n') {
          const newSecret = generateSecureSecret();
          
          if (envContent.includes('SESSION_SECRET=')) {
            envContent = envContent.replace(/SESSION_SECRET=.*/g, `SESSION_SECRET=${newSecret}`);
          } else {
            envContent += `\nSESSION_SECRET=${newSecret}`;
          }
          
          fs.writeFileSync(envPath, envContent);
          console.log('✅ Updated SESSION_SECRET with a secure random value.');
        }
        
        continuePreparation();
      });
    } else {
      console.log('✅ SESSION_SECRET appears to be properly set.');
      continuePreparation();
    }
  }
}

function continuePreparation() {
  rl.question('\nWould you like to build the project for production? (Y/n) ', (answer) => {
    if (answer.toLowerCase() !== 'n') {
      console.log('\n🔨 Building for production...');
      try {
        execSync('npm run build', { stdio: 'inherit' });
        console.log('✅ Production build completed successfully.');
      } catch (error) {
        console.error('❌ Error building for production:', error.message);
      }
    }
    
    rl.question('\nWould you like to run database migrations? (Y/n) ', (answer) => {
      if (answer.toLowerCase() !== 'n') {
        console.log('\n🔄 Running database migrations...');
        try {
          execSync('npm run db:push', { stdio: 'inherit' });
          console.log('✅ Database migrations completed successfully.');
        } catch (error) {
          console.error('❌ Error running migrations:', error.message);
        }
      }
      
      console.log('\n🎉 Production preparation complete!');
      console.log('\nNext steps:');
      console.log('  1. Update database credentials in .env if needed');
      console.log('  2. Start the application with: npm start');
      console.log('  3. For better reliability, use a process manager like PM2:');
      console.log('     - npm install -g pm2');
      console.log('     - pm2 start server/index.js --name paper-roll-system');
      console.log('\n📝 For more deployment options, see DEPLOYMENT.md');
      
      rl.close();
    });
  });
}