# Authentication Setup Guide

This guide covers the complete setup process for authentication in SMGE, including Supabase configuration and OAuth provider setup.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Supabase Project Setup](#supabase-project-setup)
3. [OAuth Provider Configuration](#oauth-provider-configuration)
   - [Google OAuth](#google-oauth-setup)
   - [Twitter/X OAuth](#twitterx-oauth-setup)
   - [LinkedIn OAuth](#linkedin-oauth-setup)
   - [Facebook/Instagram OAuth](#facebookinstagram-oauth-setup)
4. [Supabase Dashboard Configuration](#supabase-dashboard-configuration)
5. [Email Templates](#email-templates)
6. [Environment Variables](#environment-variables)
7. [Testing Authentication](#testing-authentication)
8. [Troubleshooting](#troubleshooting)
9. [Security Best Practices](#security-best-practices)

## Prerequisites

Before starting, ensure you have:

1. A Supabase account ([sign up here](https://app.supabase.com))
2. A Supabase project created
3. Access to OAuth provider developer consoles
4. Your local development environment running (`npm run dev`)

## Supabase Project Setup

### 1. Create a New Project

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Click "New Project"
3. Fill in:
   - **Name**: Your project name (e.g., "SMGE Production")
   - **Database Password**: Generate a strong password (save this!)
   - **Region**: Choose closest to your users
   - **Pricing Plan**: Start with Free tier

### 2. Get Your API Keys

Once your project is created:

1. Go to **Settings** → **API**
2. Copy these values to your `.env.local`:

```bash
# Project URL
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co

# Anonymous Key (safe for browser)
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...

# Service Role Key (server-side only!)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

### 3. Configure Authentication Settings

1. Go to **Authentication** → **Settings**
2. Configure the following:

**General Settings:**
- **Site URL**: `http://localhost:3000` (development) or your production URL
- **Redirect URLs** (add all):
  ```
  http://localhost:3000/**
  http://localhost:3000/auth/callback
  http://localhost:3000/dashboard
  https://your-domain.com/**
  ```

**Email Settings:**
- **Enable Email Confirmations**: Toggle based on environment
- **Enable Email Change Confirmations**: Recommended ON
- **Secure Email Change**: Recommended ON

## OAuth Provider Configuration

### Google OAuth Setup

#### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable the Google+ API:
   - Go to **APIs & Services** → **Library**
   - Search for "Google+ API"
   - Click **Enable**

#### 2. Create OAuth 2.0 Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. If prompted, configure OAuth consent screen first:
   - **User Type**: External
   - **App Name**: Your app name
   - **Support Email**: Your email
   - **Authorized domains**: Add your domain
   - **Scopes**: Add `email` and `profile`

4. For OAuth client ID:
   - **Application type**: Web application
   - **Name**: "SMGE OAuth"
   - **Authorized JavaScript origins**:
     ```
     http://localhost:3000
     https://your-domain.com
     ```
   - **Authorized redirect URIs**:
     ```
     https://your-project-ref.supabase.co/auth/v1/callback
     ```

5. Copy the **Client ID** and **Client Secret**

#### 3. Configure in Supabase

1. Go to **Authentication** → **Providers** → **Google**
2. Enable Google provider
3. Add your Client ID and Client Secret
4. Save

### Twitter/X OAuth Setup

#### 1. Create Twitter App

1. Go to [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard)
2. Create a new App (requires approved developer account)
3. In your app settings:

**User authentication settings:**
- **App permissions**: Read and write
- **Type of App**: Web App
- **Callback URI**:
  ```
  https://your-project-ref.supabase.co/auth/v1/callback
  ```
- **Website URL**: Your website URL

#### 2. Get OAuth 2.0 Credentials

1. Go to **Keys and tokens**
2. Under **OAuth 2.0 Client ID and Client Secret**:
   - Generate if not already created
   - Copy both values

#### 3. Configure in Supabase

1. Go to **Authentication** → **Providers** → **Twitter**
2. Enable Twitter provider
3. Add your Client ID and Client Secret
4. Save

### LinkedIn OAuth Setup

#### 1. Create LinkedIn App

1. Go to [LinkedIn Developers](https://www.linkedin.com/developers/apps)
2. Click **Create app**
3. Fill in:
   - **App name**: Your app name
   - **LinkedIn Page**: Select or create a company page
   - **Privacy policy URL**: Your privacy policy
   - **App logo**: Upload logo

#### 2. Configure OAuth Settings

1. In your app, go to **Auth** tab
2. Add **Authorized redirect URLs**:
   ```
   https://your-project-ref.supabase.co/auth/v1/callback
   ```
3. Under **OAuth 2.0 scopes**, request:
   - `openid`
   - `profile`
   - `email`
   - `w_member_social` (for posting)

#### 3. Get Credentials

1. Go to **Auth** tab
2. Copy:
   - **Client ID**
   - **Client Secret**

#### 4. Configure in Supabase

1. Go to **Authentication** → **Providers** → **LinkedIn**
2. Enable LinkedIn provider
3. Add your Client ID and Client Secret
4. Save

### Facebook/Instagram OAuth Setup

#### 1. Create Facebook App

1. Go to [Facebook Developers](https://developers.facebook.com/apps/)
2. Click **Create App**
3. Choose **Consumer** as app type
4. Fill in app details

#### 2. Add Facebook Login Product

1. In your app dashboard, click **Add Product**
2. Find **Facebook Login** and click **Set Up**
3. Choose **Web**
4. Site URL: `http://localhost:3000`

#### 3. Configure OAuth Settings

1. Go to **Facebook Login** → **Settings**
2. Add to **Valid OAuth Redirect URIs**:
   ```
   https://your-project-ref.supabase.co/auth/v1/callback
   ```
3. Enable:
   - Client OAuth Login
   - Web OAuth Login
   - Use Strict Mode for Redirect URIs

#### 4. Add Instagram Basic Display

1. Click **Add Product**
2. Add **Instagram Basic Display**
3. Create New App
4. Add redirect URI:
   ```
   https://your-project-ref.supabase.co/auth/v1/callback
   ```

#### 5. Get Credentials

1. Go to **Settings** → **Basic**
2. Copy:
   - **App ID** (Client ID)
   - **App Secret** (Client Secret)

#### 6. Configure in Supabase

1. Go to **Authentication** → **Providers** → **Facebook**
2. Enable Facebook provider
3. Add your App ID and App Secret
4. Save

## Supabase Dashboard Configuration

### User Management Settings

1. Go to **Authentication** → **Users**
2. Review and configure:
   - **Allow new users to sign up**: ON
   - **Require email confirmation**: Based on environment
   - **Enable manual linking of accounts**: ON (for multiple OAuth providers)

### Auth Policies

1. Go to **Authentication** → **Policies**
2. Configure password requirements:
   - Minimum length: 8
   - Require uppercase: Yes
   - Require lowercase: Yes
   - Require numbers: Yes

### Rate Limiting

1. Go to **Authentication** → **Rate Limits**
2. Configure (recommended):
   - Sign-up attempts: 5 per hour
   - Sign-in attempts: 10 per hour
   - Password reset: 3 per hour

## Email Templates

### Customize Email Templates

1. Go to **Authentication** → **Email Templates**
2. Customize each template:

#### Confirmation Email

```html
<h2>Welcome to SMGE!</h2>
<p>Please confirm your email address by clicking the link below:</p>
<p><a href="{{ .ConfirmationURL }}">Confirm Email</a></p>
<p>Or copy this link: {{ .ConfirmationURL }}</p>
<p>This link will expire in 1 hour.</p>
```

#### Magic Link Email

```html
<h2>Sign in to SMGE</h2>
<p>Click the link below to sign in to your account:</p>
<p><a href="{{ .ConfirmationURL }}">Sign In</a></p>
<p>Or copy this link: {{ .ConfirmationURL }}</p>
<p>This link will expire in 1 hour.</p>
<p>If you didn't request this, please ignore this email.</p>
```

#### Password Reset Email

```html
<h2>Reset Your Password</h2>
<p>Click the link below to reset your password:</p>
<p><a href="{{ .ConfirmationURL }}">Reset Password</a></p>
<p>Or copy this link: {{ .ConfirmationURL }}</p>
<p>This link will expire in 1 hour.</p>
<p>If you didn't request this, please ignore this email.</p>
```

#### Email Change Email

```html
<h2>Confirm Email Change</h2>
<p>Please confirm your new email address:</p>
<p><a href="{{ .ConfirmationURL }}">Confirm New Email</a></p>
<p>Or copy this link: {{ .ConfirmationURL }}</p>
<p>This link will expire in 1 hour.</p>
```

## Environment Variables

### Complete Configuration

Your `.env.local` should include:

```bash
# Supabase Core
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# Auth Configuration
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_AUTH_REDIRECT_TO=/dashboard
NEXT_PUBLIC_AUTH_ERROR_REDIRECT=/auth/error
NEXT_PUBLIC_ENABLE_EMAIL_CONFIRMATION=false
SUPABASE_JWT_EXPIRY=3600
MAGIC_LINK_EXPIRY=3600

# OAuth Providers
GOOGLE_OAUTH_CLIENT_ID=your-google-client-id
GOOGLE_OAUTH_CLIENT_SECRET=your-google-client-secret

TWITTER_OAUTH_CLIENT_ID=your-twitter-client-id
TWITTER_OAUTH_CLIENT_SECRET=your-twitter-client-secret

LINKEDIN_OAUTH_CLIENT_ID=your-linkedin-client-id
LINKEDIN_OAUTH_CLIENT_SECRET=your-linkedin-client-secret

FACEBOOK_OAUTH_CLIENT_ID=your-facebook-app-id
FACEBOOK_OAUTH_CLIENT_SECRET=your-facebook-app-secret
```

## Testing Authentication

### 1. Test Email/Password Sign Up

```bash
# Start your development server
npm run dev

# Navigate to http://localhost:3000/auth/signup
# Try creating an account with email/password
```

### 2. Test OAuth Sign In

1. Navigate to sign-in page
2. Click on each OAuth provider button
3. Should redirect to provider's consent screen
4. After approval, should redirect back to dashboard

### 3. Test Magic Link

1. Navigate to sign-in page
2. Enter email and request magic link
3. Check email for link
4. Click link to authenticate

### 4. Verify Session

```javascript
// In browser console after sign in
const { data: { session } } = await supabase.auth.getSession()
console.log(session)
```

## Troubleshooting

### Common Issues and Solutions

#### OAuth Redirect Mismatch Error

**Problem**: "Redirect URI mismatch" error

**Solution**:
1. Ensure redirect URI in provider settings exactly matches:
   ```
   https://your-project-ref.supabase.co/auth/v1/callback
   ```
2. No trailing slashes
3. Check for http vs https
4. Verify project reference is correct

#### Email Not Sending

**Problem**: Confirmation emails not received

**Solution**:
1. Check spam folder
2. In development, disable email confirmation:
   ```bash
   NEXT_PUBLIC_ENABLE_EMAIL_CONFIRMATION=false
   ```
3. For production, configure custom SMTP in Supabase dashboard

#### Session Not Persisting

**Problem**: User logged out on page refresh

**Solution**:
1. Ensure cookies are enabled
2. Check `NEXT_PUBLIC_SUPABASE_URL` is correct
3. Verify auth middleware is properly configured
4. Check browser console for errors

#### OAuth Provider Not Working

**Problem**: OAuth sign-in fails

**Solution**:
1. Verify provider is enabled in Supabase dashboard
2. Check Client ID and Secret are correct
3. Ensure app is not in development/sandbox mode
4. Verify required APIs are enabled (Google+ API for Google)

#### Invalid JWT Token

**Problem**: "Invalid JWT" errors

**Solution**:
1. Clear browser cookies
2. Sign out and sign in again
3. Check JWT expiry settings
4. Verify anon key and service role key

## Security Best Practices

### 1. Environment Variables

- **Never commit** `.env.local` to version control
- Use different credentials for development/staging/production
- Rotate keys regularly
- Use secret management services in production

### 2. Service Role Key

- **Never expose** service role key in client code
- Only use in secure server-side environments
- Use for admin operations only

### 3. Row Level Security (RLS)

- Enable RLS on all tables
- Write policies before adding data
- Test policies thoroughly
- Default to restrictive policies

### 4. Rate Limiting

- Implement rate limiting on auth endpoints
- Use Supabase's built-in rate limiting
- Add custom rate limiting for sensitive operations

### 5. OAuth Scopes

- Request minimum required scopes
- Review scope requirements regularly
- Document why each scope is needed

### 6. Session Management

- Implement proper session expiry
- Add session refresh logic
- Clear sessions on logout
- Monitor for suspicious activity

### 7. HTTPS Only

- Always use HTTPS in production
- Enforce SSL in Supabase settings
- Use secure cookies

### 8. Input Validation

- Validate all user inputs
- Sanitize data before storage
- Use Supabase's built-in validation

## Next Steps

After completing authentication setup:

1. Implement auth UI components
2. Add protected routes
3. Set up user profiles
4. Configure RLS policies
5. Add social account linking
6. Implement role-based access control

## Support Resources

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Next.js Auth Examples](https://github.com/supabase/auth-helpers)
- [OAuth 2.0 Specification](https://oauth.net/2/)
- [SMGE GitHub Issues](https://github.com/Wolfxinze/SMGE/issues)

---

For additional help or questions, please create an issue in the [SMGE repository](https://github.com/Wolfxinze/SMGE/issues).