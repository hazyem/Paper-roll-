# Paper Roll Management System

A comprehensive web application for managing paper roll inventory with advanced tracking, release, amendment, and reporting capabilities.

## Features

- **Material Management**: Track different paper materials with detailed attributes
- **Order Reception**: Record incoming paper roll orders with comprehensive validation
- **Material Release**: Process outgoing material with advanced tracking
- **Detail Amendment**: Modify material details with full activity logging
- **Reporting System**: Generate detailed reports with filtering and CSV export
- **User Management**: Role-based access control with admin capabilities
- **Activity Logging**: Track all material movements and changes
- **Responsive Dashboard**: Monitor inventory status and recent activities

## Technology Stack

- **Frontend**: React, TypeScript, Tailwind CSS, Shadcn UI
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Express Session with Passport
- **State Management**: TanStack Query (React Query)

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- PostgreSQL database

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/your-username/paper-roll-management.git
   cd paper-roll-management
   ```

2. Run the setup script which will create necessary files and initialize the database:
   ```
   node scripts/setup.js
   ```

3. Update the `.env` file with your database credentials:
   ```
   DATABASE_URL=postgresql://username:password@hostname:5432/database_name
   SESSION_SECRET=your_session_secret
   ```

4. Install dependencies:
   ```
   npm install
   ```

5. Start the development server:
   ```
   npm run dev
   ```

The application will be available at http://localhost:5000

### Default Admin User

- **Username**: admin
- **Password**: password123

**Important**: Change the default password after first login for security reasons.

## Usage Guide

### Dashboard

The dashboard provides an overview of the system status, including:

- Total materials in stock
- Pending releases
- Orders received
- Total weight in stock
- Recent activity log
- Material status summary

### Receiving Orders

1. Navigate to "Receive Order" in the sidebar
2. Enter material details:
   - Material Name
   - Material Roll ID (unique identifier)
   - Purchase Order Number
   - Declared Weight (optional)
   - Actual Weight (optional)
   - Remarks (optional)
3. Click "Submit" to record the order

### Releasing Materials

1. Navigate to "Release Material" in the sidebar
2. Search for materials by name or Purchase Order
3. Select rolls to release
4. Enter Sales Order Number
5. Add general remarks or roll-specific comments
6. Click "Release Selected" to process the release

### Amending Details

1. Navigate to "Amend Details" in the sidebar
2. Search for the specific roll by Material Roll ID
3. Update the necessary details
4. Add remarks to explain the changes
5. Click "Save Changes" to record the amendments

### Generating Reports

1. Navigate to "Reports" in the sidebar
2. Select the report type:
   - All Stock
   - Available Stock
   - Released Material
3. Apply filters as needed
4. View the report or export to CSV

### User Management

1. Navigate to "User Management" in the sidebar (admin only)
2. Create new users by providing username, password, and role
3. Reset passwords for existing users
4. Deactivate user accounts as needed

## Customization

### Material Types

To add or modify material types, use the "Create Material" option on the dashboard or update them directly in the database.

### Role Configuration

By default, the system includes:
- Admin role: Full access to all features
- User role: Limited to basic operations (receive, release, amend, report)

## Deployment

For production deployment instructions, please refer to [DEPLOYMENT.md](./DEPLOYMENT.md)

## Development

### Project Structure

```
├── client/              # Frontend code
│   ├── src/
│   │   ├── components/  # Reusable UI components
│   │   ├── pages/       # Page components
│   │   ├── hooks/       # Custom React hooks
│   │   ├── lib/         # Utility functions
│   │   ├── context/     # React context providers
├── server/              # Backend code
│   ├── routes.ts        # API routes
│   ├── storage.ts       # Database operations
│   ├── auth.ts          # Authentication logic
├── shared/              # Shared code
│   ├── schema.ts        # Database schema and types
├── scripts/             # Utility scripts
├── .env                 # Environment variables
```

### Available Scripts

- `npm run dev`: Start development server
- `npm run build`: Build for production
- `npm start`: Run production server
- `npm run db:push`: Apply database schema changes
- `npm run lint`: Run ESLint
- `node scripts/setup.js`: Setup initial configuration
- `node scripts/prepare-production.js`: Prepare for production deployment

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgements

- Built with [Shadcn UI](https://ui.shadcn.com/)
- Powered by [React](https://reactjs.org/) and [Express](https://expressjs.com/)
- ORM by [Drizzle](https://orm.drizzle.team/)
- Icons by [Lucide](https://lucide.dev/)

---

Made with ❤️ for efficient paper roll inventory management