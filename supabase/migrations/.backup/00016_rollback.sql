-- ============================================================================
-- ROLLBACK SCRIPT for 00016_fix_profile_privilege_escalation
-- ============================================================================
-- WARNING: This rollback will restore the VULNERABLE state
-- Only use if absolutely necessary and apply a different fix immediately
-- ============================================================================

-- Restore the vulnerable policies (NOT RECOMMENDED)
CREATE POLICY "Triggers can insert profiles"
    ON public.profiles
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Triggers can insert agencies"
    ON public.agencies
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Triggers can insert team_members"
    ON public.team_members
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Triggers can insert subscriptions"
    ON public.subscriptions
    FOR INSERT
    WITH CHECK (true);

-- Remove the secure policies
DROP POLICY IF EXISTS "Users can create own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "System can manage agencies" ON public.agencies;
DROP POLICY IF EXISTS "System can manage team_members" ON public.team_members;
DROP POLICY IF EXISTS "System can manage subscriptions" ON public.subscriptions;

-- Remove the secure function
DROP FUNCTION IF EXISTS public.create_user_profile;

-- Remove the audit function
DROP FUNCTION IF EXISTS public.audit_suspicious_profiles;

-- ============================================================================
-- WARNING: System is now VULNERABLE to privilege escalation
-- ============================================================================