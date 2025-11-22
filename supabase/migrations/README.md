# Supabase Migrations

This directory contains SQL migration files for the SMGE database schema.

## Running Migrations

### Option 1: Supabase CLI (Recommended)
```bash
# Link to your Supabase project
supabase link --project-ref your-project-ref

# Run all pending migrations
supabase db push

# Or apply migrations to local development
supabase db reset
```

### Option 2: Manual Application
```bash
# Connect to your Supabase database
psql postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres

# Run migration files in order
\i supabase/migrations/00001_initial_schema.sql
\i supabase/migrations/00002_auth_schema.sql
```

### Option 3: Supabase Dashboard
1. Go to https://app.supabase.com
2. Select your project
3. Navigate to SQL Editor
4. Copy and paste the migration SQL
5. Execute

## Migration Files

- `00001_initial_schema.sql` - Initial database schema
  - User profiles table
  - Social accounts table (with encrypted token storage)
  - Health check table
  - RLS policies
  - Helper functions for token encryption/decryption

- `00002_auth_schema.sql` - Authentication flow enhancements
  - Automatic profile creation trigger on user signup
  - Additional profile columns (last_sign_in_at, email_verified, auth_metadata, onboarding_completed)
  - User sessions table for device management
  - Auth helper functions:
    - `handle_new_user()` - Auto-creates profile on signup
    - `update_last_sign_in()` - Tracks user login activity
    - `is_onboarding_complete()` - Checks onboarding status
    - `complete_onboarding()` - Marks onboarding complete
    - `get_subscription_tier()` - Returns user's subscription level
    - `update_profile_from_oauth()` - Updates profile from OAuth data
    - `cleanup_expired_sessions()` - Removes expired sessions
  - Enhanced RLS policies for auth operations
  - Performance indexes for auth-related queries

## Security Notes

**Automatic Profile Creation:**
- The `handle_new_user()` trigger automatically creates a profile when users sign up
- Profile data is populated from auth metadata (full_name, avatar_url, etc.)
- OAuth provider data is stored in the `auth_metadata` JSONB column
- The trigger handles conflicts gracefully with ON CONFLICT DO UPDATE

**Session Management:**
- User sessions are tracked in `user_sessions` table
- Sessions expire based on `expires_at` timestamp
- Run `cleanup_expired_sessions()` periodically to remove old sessions
- Users can only view/delete their own sessions via RLS

**Token Encryption:**
- OAuth tokens are encrypted using PostgreSQL's `pgcrypto` extension
- Encryption requires a secure key passed to encrypt/decrypt functions
- For production, consider using Supabase Vault or external KMS

### Encryption Key Setup

**1. Generate a secure encryption key:**
```bash
openssl rand -base64 32
```

**2. For production (Supabase Cloud):**
- Go to Project Settings > API > Project API keys
- Add as environment variable in your application: `DATABASE_ENCRYPTION_KEY`
- Never commit this key to version control

**3. For local development:**
Add to `.env.local`:
```bash
DATABASE_ENCRYPTION_KEY=your-generated-key-here
```

**4. Usage in application code:**
```typescript
// Encrypt before storing
const encryptedToken = await supabase.rpc('encrypt_token', {
  token: accessToken,
  secret: process.env.DATABASE_ENCRYPTION_KEY
})

// Decrypt when retrieving
const decryptedToken = await supabase.rpc('decrypt_token', {
  encrypted_token: encryptedData,
  secret: process.env.DATABASE_ENCRYPTION_KEY
})
```

**⚠️ WARNING:** Changing the encryption key will make all existing encrypted tokens unreadable. Implement key rotation carefully with a migration strategy.

**Row Level Security (RLS):**
- All tables have RLS enabled
- Users can only access their own data
- Service role bypasses RLS (use carefully!)

## Next Migrations

Future migrations will add:
- Brand context tables (Task 003)
- Content posts tables (Task 004)
- Analytics tables (Task 006)
- Workflow execution logs (Task 005)
