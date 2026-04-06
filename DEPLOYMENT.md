# Deployment Guide for Paper Roll Management System

This document provides instructions for deploying the Paper Roll Management System to production.

## Prerequisites

- Node.js (v16 or higher)
- PostgreSQL database
- Domain name (optional)
- SSL certificate (recommended for production)

## Configuration

### 1. Environment Variables

Create a `.env` file in the root directory with the following variables:

```
# Database connection (required)
DATABASE_URL=postgresql://username:password@hostname:5432/database_name

# Session secret (required) - Use a strong random string
SESSION_SECRET=your_very_secure_random_string

# Environment (required)
NODE_ENV=production

# Port (optional, defaults to 5000)
PORT=5000
```

For security, ensure your database credentials are strong and that the SESSION_SECRET is a long, random string.

### 2. Database Setup

1. Create a PostgreSQL database:
   ```sql
   CREATE DATABASE paper_roll_db;
   ```

2. Run the database migration:
   ```
   npm run db:push
   ```

3. Initialize the admin user:
   ```
   node scripts/setup.js
   ```

### 3. Build for Production

Build the frontend application:
```
npm run build
```

## Deployment Options

### Option 1: Traditional VPS/Server

1. Install dependencies:
   ```
   npm install --production
   ```

2. Start the application using a process manager like PM2:
   ```
   npm install -g pm2
   pm2 start server/index.js --name paper-roll-system
   ```

3. Set up a reverse proxy using Nginx or Apache:

   Example Nginx configuration:
   ```nginx
   server {
       listen 80;
       server_name yourdomain.com;

       location / {
           proxy_pass http://localhost:5000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

4. Set up SSL with Let's Encrypt:
   ```
   sudo certbot --nginx -d yourdomain.com
   ```

### Option 2: Docker Deployment

1. Create a `Dockerfile`:
   ```dockerfile
   FROM node:18-alpine

   WORKDIR /app

   COPY package*.json ./
   RUN npm install --production

   COPY . .
   
   RUN npm run build

   ENV NODE_ENV=production
   
   EXPOSE 5000
   
   CMD ["node", "server/index.js"]
   ```

2. Build and run the Docker image:
   ```
   docker build -t paper-roll-system .
   docker run -p 5000:5000 --env-file .env paper-roll-system
   ```

### Option 3: Replit Deployment

1. Make sure your Replit project is properly configured
2. Set the environment variables in the Replit Secrets panel
3. Use the Replit Deployments feature to deploy your application

## Security Considerations

1. **Passwords**: Change the default admin password immediately after deployment
2. **Database**: Secure your PostgreSQL database with strong credentials
3. **Firewall**: Configure firewall rules to restrict database access
4. **HTTPS**: Always use SSL/TLS in production
5. **Updates**: Regularly update dependencies to patch security vulnerabilities

## Monitoring and Maintenance

1. Set up logging using a service like Logtail, Papertrail, or ELK stack
2. Configure monitoring using Prometheus, Grafana, or a commercial service
3. Set up regular database backups
4. Implement a CI/CD pipeline for seamless updates

## Scaling

For higher loads, consider:

1. Horizontal scaling with load balancing
2. Database read replicas
3. Caching frequently accessed data with Redis
4. Database connection pooling

## Troubleshooting

Common issues:

1. **Database Connection Errors**: Verify the DATABASE_URL is correct and the database is accessible
2. **Permission Issues**: Ensure the application has permissions to write logs and temporary files
3. **Memory Issues**: Increase Node.js memory limit if needed: `NODE_OPTIONS=--max-old-space-size=4096`

## First-Time Production Setup Checklist

- [ ] Database created and credentials secured
- [ ] Environment variables set
- [ ] Application built for production
- [ ] Default admin password changed
- [ ] SSL/TLS configured
- [ ] Firewall rules established
- [ ] Monitoring set up
- [ ] Backup strategy implemented

For any issues or questions, please contact the system administrator.