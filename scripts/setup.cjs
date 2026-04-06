/**
 * Paper Roll Management System Setup Script
 * 
 * This script initializes the database and creates the default admin user.
 * Run with: node scripts/setup.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('\n🚀 Paper Roll Management System - Setup\n');

// Check if .env file exists
const envPath = path.join(__dirname, '..', '.env');
if (!fs.existsSync(envPath)) {
  console.log('❌ .env file not found. Creating a sample one...');
  
  const sampleEnv = `# Database connection
DATABASE_URL=postgresql://neondb_owner:npg_pcXSilsK45Jf@localhost:5432/paper_roll_db
# Session secret (change this to a random string in production)
SESSION_SECRET=change_me_in_production
# Environment (development or production)
NODE_ENV=development`;
  
  fs.writeFileSync(envPath, sampleEnv);
  console.log('✅ Sample .env file created. Please update it with your database credentials.');
}

console.log('📋 Environment configuration:');
const envContent = fs.readFileSync(envPath, 'utf8');
console.log(envContent.split('\n').map(line => `  ${line}`).join('\n'));

rl.question('\nWould you like to initialize the database? (Y/n) ', (answer) => {
  if (answer.toLowerCase() !== 'n') {
    console.log('\n🔄 Initializing database...');
    try {
      execSync('npm run db:push', { stdio: 'inherit' });
      console.log('✅ Database schema created successfully.');
      
      // Insert default admin user
      console.log('\n👤 Creating default admin user...');
      const createAdminSQL = `
      -- Create default admin user
      INSERT INTO users (username, password_hash, full_name, email, is_active, is_admin, created_at, updated_at)
      VALUES (
        'admin', 
        'password123',
        'System Admin',
        'admin@example.com',
        TRUE,
        TRUE,
        NOW(),
        NOW()
      ) ON CONFLICT (username) DO NOTHING;

      -- Create default roles
      INSERT INTO roles (name, description)
      VALUES 
        ('admin', 'Full system access'),
        ('user', 'Standard user access')
      ON CONFLICT (name) DO NOTHING;

      -- Assign admin role to admin user
      INSERT INTO user_roles (user_id, role_id)
      SELECT
        (SELECT id FROM users WHERE username = 'admin'),
        (SELECT id FROM roles WHERE name = 'admin')
      WHERE NOT EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = (SELECT id FROM users WHERE username = 'admin')
        AND role_id = (SELECT id FROM roles WHERE name = 'admin')
      );
      `;
      
      // Save the SQL to a file
      const sqlPath = path.join(__dirname, 'create-admin.sql');
      fs.writeFileSync(sqlPath, createAdminSQL);
      
      // Execute the SQL using database URL from env
      const dbUrl = envContent.split('\n')
        .find(line => line.startsWith('DATABASE_URL='))
        ?.split('=')[1];
      
      if (dbUrl) {
        try {
          console.log('Running SQL to create admin user...');
          execSync(`psql "${dbUrl}" -f ${sqlPath}`, { stdio: 'inherit' });
          console.log('✅ Default admin user created successfully.');
        } catch (error) {
          console.log('❌ Error creating admin user. You may need to run the SQL manually.');
          console.log(`SQL file saved to: ${sqlPath}`);
        }
      } else {
        console.log('❌ Could not find DATABASE_URL in .env file.');
        console.log(`SQL file saved to: ${sqlPath}`);
        console.log('Please run this SQL manually to create the admin user.');
      }
      
    } catch (error) {
      console.error('❌ Error initializing database:', error.message);
      console.log('Please check your database connection and try again.');
    }
  }
  
  rl.question('\nWould you like to install dependencies? (Y/n) ', (answer) => {
    if (answer.toLowerCase() !== 'n') {
      console.log('\n📦 Installing dependencies...');
      try {
        execSync('npm install', { stdio: 'inherit' });
        console.log('✅ Dependencies installed successfully.');
      } catch (error) {
        console.error('❌ Error installing dependencies:', error.message);
      }
    }
    
    console.log('\n🎉 Setup complete!');
    console.log('\nTo start the development server:');
    console.log('  npm run dev');
    console.log('\nDefault login:');
    console.log('  Username: admin');
    console.log('  Password: password123');
    console.log('\n⚠️ Important: Change the default password in production!');
    
    rl.close();
  });
});