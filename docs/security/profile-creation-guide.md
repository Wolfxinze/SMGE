# Secure Profile Creation Guide

## Overview

After security fix #16, profile creation must use the `create_user_profile()` function to ensure security. Direct INSERTs are blocked by RLS policies.

## Security Model

### Key Principles
1. **Users can only create their own profile** - `auth.uid()` must match `user_id`
2. **Role is always 'user' by default** - Prevents privilege escalation
3. **Admin roles come from team_members** - Not from profile.role field
4. **All inputs are validated** - NULL checks, agency existence, etc.

### What's Prevented
- ❌ Creating profiles for other users
- ❌ Setting admin/agency_owner roles directly
- ❌ Bypassing authentication checks
- ❌ SQL injection through profile fields

## Usage Examples

### Client-Side (JavaScript/TypeScript)

```typescript
// ✅ CORRECT: Use the secure function
async function createUserProfile(user: User) {
  const { data, error } = await supabase.rpc('create_user_profile', {
    p_user_id: user.id,
    p_email: user.email,
    p_full_name: user.full_name,
    p_avatar_url: user.avatar_url,
    p_agency_id: null  // Optional
  });

  if (error) {
    console.error('Profile creation failed:', error);
    throw error;
  }

  return data;
}

// ❌ WRONG: Direct insert (will be blocked by RLS)
async function insecureCreateProfile(user: User) {
  // This will FAIL - RLS blocks direct inserts
  const { error } = await supabase
    .from('profiles')
    .insert({
      id: user.id,
      email: user.email,
      role: 'admin'  // Trying to escalate privileges
    });
}
```

### Server-Side (Service Role)

```typescript
// For service role (e.g., in Edge Functions)
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Service role should still use the function for consistency
async function createProfileAsService(userId: string, email: string) {
  // Even service role should validate business logic
  const { data: user } = await supabase.auth.admin.getUserById(userId);

  if (!user) {
    throw new Error('User not found in auth.users');
  }

  // Use the secure function
  return await supabase.rpc('create_user_profile', {
    p_user_id: userId,
    p_email: email,
    p_full_name: user.user_metadata?.full_name,
    p_avatar_url: user.user_metadata?.avatar_url
  });
}
```

### During Signup Flow

```typescript
// In your signup handler
async function handleSignup(email: string, password: string, fullName: string) {
  // 1. Create auth user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName
      }
    }
  });

  if (authError) throw authError;

  // 2. Create profile using secure function
  const { data: profile, error: profileError } = await supabase.rpc(
    'create_user_profile',
    {
      p_user_id: authData.user!.id,
      p_email: email,
      p_full_name: fullName
    }
  );

  if (profileError) {
    console.error('Profile creation failed:', profileError);
    // Profile creation is handled by trigger, so this is non-fatal
  }

  return authData.user;
}
```

## Role Management

### How Roles Work Post-Fix

1. **Profile.role** - Always 'user' for self-created profiles
2. **Team_members.role** - Determines actual permissions (owner, admin, member)
3. **Agency ownership** - Set through team_members, not profile

### Granting Admin Access

```sql
-- ✅ CORRECT: Grant admin through team_members
INSERT INTO team_members (agency_id, user_id, role, status)
VALUES (
  'agency-uuid',
  'user-uuid',
  'admin',     -- Role in the agency context
  'active'
);

-- ❌ WRONG: Don't try to update profile.role
UPDATE profiles SET role = 'admin' WHERE id = 'user-uuid';  -- Blocked by RLS
```

## Testing Profile Creation

### Unit Test Example

```typescript
describe('Profile Creation Security', () => {
  it('should prevent creating profiles for other users', async () => {
    const attackerId = 'attacker-id';
    const victimId = 'victim-id';

    // Authenticate as attacker
    await supabase.auth.signInWithPassword({...});

    // Try to create victim's profile
    const { error } = await supabase.rpc('create_user_profile', {
      p_user_id: victimId,  // Different from auth.uid()
      p_email: 'victim@example.com'
    });

    expect(error).toBeDefined();
    expect(error.message).toContain('Users can only create their own profile');
  });

  it('should enforce user role for new profiles', async () => {
    const { data: profile } = await supabase.rpc('create_user_profile', {
      p_user_id: currentUser.id,
      p_email: currentUser.email
    });

    // Fetch the created profile
    const { data } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', currentUser.id)
      .single();

    expect(data.role).toBe('user');  // Always 'user', never 'admin'
  });
});
```

## Auditing & Monitoring

### Check for Exploitation Attempts

```sql
-- Run as service role to audit suspicious profiles
SELECT * FROM audit_suspicious_profiles();
```

This will identify:
- Profiles with admin roles but no team_member ownership
- Recently created profiles with elevated privileges
- Potential exploitation of the previous vulnerability

### Monitor Failed Attempts

```sql
-- Check Postgres logs for failed privilege escalation attempts
SELECT
  timestamp,
  user_name,
  error_severity,
  message
FROM postgres_log
WHERE message LIKE '%Users can only create their own profile%'
   OR message LIKE '%user_id cannot be NULL%'
ORDER BY timestamp DESC
LIMIT 100;
```

## Migration Path

### For Existing Code

1. **Replace direct INSERTs** with `create_user_profile()` calls
2. **Update role checks** to use team_members table
3. **Test thoroughly** in staging environment
4. **Monitor** for any failed profile creations

### Backward Compatibility

The function handles `ON CONFLICT` for existing profiles, so it's safe to call even if a profile already exists.

## Support

For questions or issues related to this security fix:
1. Check the [Issue #16](https://github.com/Wolfxinze/SMGE/issues/16) discussion
2. Review test cases in `/supabase/tests/00016_profile_security_test.sql`
3. Contact the security team if you discover any bypasses