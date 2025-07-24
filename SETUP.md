# EV Charger Hackathon - Setup Guide

## Prerequisites

- Node.js (version 18 or higher)
- npm or yarn

## Setup Instructions

1. **Clone the repository**

   ```bash
   git clone <your-repo-url>
   cd ev-charger-hackathon
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

   This will automatically run `postinstall` which generates the Prisma clients.

3. **Set up environment variables**
   Create a `.env` file in the root directory:

   ```env
   DATABASE_URL="file:./prisma/auth.db"
   DATABASE_URL_1="file:./prisma/queue.db"
   ```

4. **Run database migrations** (if needed)

   ```bash
   npm run db:migrate
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

## Troubleshooting

### "Cannot find module '@/generated/prisma/auth/client'" Error

If you get Prisma import errors:

1. **Generate Prisma clients manually:**

   ```bash
   npm run db:generate
   ```

2. **If that doesn't work, try:**

   ```bash
   npx prisma generate --schema=prisma/schema.prisma
   npx prisma generate --schema=prisma/route.prisma
   ```

3. **Verify the generated files exist:**
   - Check that `src/generated/prisma/auth/` contains client files
   - Check that `src/generated/prisma/queue/` contains client files

### Database Issues

If you have database connection issues:

1. Make sure the `.env` file exists with the correct DATABASE_URL values
2. Run `npm run db:push` to sync the database schema
3. Check that the `prisma/` directory contains `auth.db` and `queue.db` files

## Project Structure

- `prisma/schema.prisma` - Auth database schema (users, authentication)
- `prisma/route.prisma` - Queue database schema (charging queue, timers)
- `src/generated/prisma/auth/` - Generated auth database client
- `src/generated/prisma/queue/` - Generated queue database client

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run db:generate` - Generate Prisma clients
- `npm run db:migrate` - Run database migrations
- `npm run db:push` - Push schema changes to database
