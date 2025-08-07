# Supabase Migration Guide

This document outlines the migration from Prisma to Supabase for your EV Charger Hackathon project.

## What We've Migrated

### ✅ Completed

1. **Environment Configuration** - Updated `.env.local` with Supabase credentials
2. **Database Schema** - Created `supabase-schema.sql` with equivalent tables
3. **Type Definitions** - Created Supabase-compatible types in `src/types/supabase.ts`
4. **Supabase Client Setup** - Updated `src/lib/supabase.ts` with proper client configuration
5. **Supabase Service Layer** - Created `src/lib/supabase-service.ts` to replace Prisma operations
6. **Queue Service** - Updated `src/lib/queue-service.ts` to use Supabase
7. **Timer Service** - Updated `src/lib/timer-service.ts` to use Supabase
8. **Admin Status Route** - Updated `src/app/api/admin/status/route.ts` to use Supabase
9. **Auth Routes** - Updated signin and signup routes to use Supabase

## Next Steps

### 1. Get Your Supabase Service Role Key

1. Go to your Supabase dashboard: https://app.supabase.com/project/xnuinjozsqgswywsnsol
2. Navigate to Settings > API
3. Copy the "service_role" key (not the anon key)
4. Update `.env.local`:
   ```bash
   SUPABASE_SERVICE_ROLE_KEY=your_actual_service_role_key_here
   ```

### 2. Create Database Tables in Supabase

1. In your Supabase dashboard, go to the SQL Editor
2. Copy and paste the contents of `supabase-schema.sql`
3. Run the SQL to create your tables

### 3. Update Remaining API Routes

The following files still need to be updated (I can help with these if needed):

- `src/app/api/auth/user/route.ts`
- `src/app/api/auth/queue-users/route.ts`
- `src/app/api/health/route.ts`
- Any other routes that import from `@/lib/prisma`

### 4. Test the Migration

1. Run your application: `npm run dev`
2. Test basic functionality:
   - User signup/signin
   - Queue operations
   - Admin dashboard
   - Email notifications

### 5. Clean Up (Optional)

After confirming everything works:

- Remove Prisma dependencies: `npm uninstall prisma @prisma/client`
- Delete `prisma/` folder
- Delete `src/lib/prisma.ts`
- Delete `src/generated/` folder

## Schema Mapping

### Users Table

```sql
-- Prisma model User
id        Int      @id @default(autoincrement())
email     String   @unique
password  String
name      String?
createdAt DateTime @default(now())

-- Supabase users table
id SERIAL PRIMARY KEY,
email VARCHAR(255) UNIQUE NOT NULL,
password VARCHAR(255) NOT NULL,
name VARCHAR(255),
created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
```

### Queue Table

```sql
-- Prisma model Queue
id         Int      @id @default(autoincrement())
position   Int
createdAt  DateTime @default(now())
userId     Int
chargerId  Int
status     String   @default("waiting")
durationMinutes Int?
chargingStartedAt DateTime?
estimatedEndTime DateTime?

-- Supabase queue table
id SERIAL PRIMARY KEY,
position INTEGER NOT NULL,
created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
user_id INTEGER NOT NULL,
charger_id INTEGER NOT NULL,
status VARCHAR(50) DEFAULT 'waiting',
duration_minutes INTEGER,
charging_started_at TIMESTAMP WITH TIME ZONE,
estimated_end_time TIMESTAMP WITH TIME ZONE
```

## Key Changes

### 1. Database Client

- **Before**: `authPrisma` and `queuePrisma` from Prisma
- **After**: `SupabaseService` methods

### 2. Field Names

- **Before**: camelCase (userId, chargerId, createdAt)
- **After**: snake_case in database, but converted to camelCase in service layer

### 3. Date Handling

- **Before**: JavaScript Date objects
- **After**: ISO string format for database storage

### 4. Query Patterns

- **Before**: Prisma's findMany, create, update, delete
- **After**: Supabase's select, insert, update, delete with custom service methods

## Environment Variables

Make sure these are set in your `.env.local`:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://xnuinjozsqgswywsnsol.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=your_actual_service_role_key_here

# Email Configuration (unchanged)
GMAIL_USER=your_gmail_user
GMAIL_APP_PASSWORD=your_gmail_app_password
```

## Troubleshooting

### Common Issues

1. **Missing Service Role Key**: Make sure you've added the correct service role key
2. **Table Not Found**: Ensure you've run the `supabase-schema.sql` in your Supabase dashboard
3. **RLS Policies**: The schema includes Row Level Security policies for data protection
4. **Type Errors**: Make sure to import types from `@/types` instead of generated Prisma types

### Verification Steps

1. Check Supabase dashboard for created tables
2. Test API endpoints one by one
3. Monitor console for any remaining Prisma import errors
4. Verify email functionality still works

## Support

If you encounter any issues during migration, the key areas to check are:

1. Environment variables are correct
2. Database schema was created successfully
3. All Prisma imports have been replaced with Supabase service calls
4. Date handling is consistent (ISO strings vs Date objects)
