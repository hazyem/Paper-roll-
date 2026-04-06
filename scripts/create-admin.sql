
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
      