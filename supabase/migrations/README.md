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

# Run migration file
\i supabase/migrations/00001_initial_schema.sql
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

## Security Notes

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
