# SMGE - AI-Powered Social Media Growth Engine

An enterprise-grade social media management platform that leverages AI agents to automate content creation, optimize posting schedules, and maximize engagement across multiple platforms.

## Tech Stack

- **Frontend**: Next.js 14+ (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Realtime)
- **Workflow Automation**: n8n (self-hosted or cloud)
- **AI Services**: OpenAI GPT-4, Claude 3.5 Sonnet, Stable Diffusion
- **Social APIs**: Instagram Graph API, Twitter API v2, LinkedIn API, TikTok API
- **Payments**: Stripe

## Prerequisites

- Node.js 18+ and npm/yarn/pnpm
- Supabase account (free tier available)
- n8n instance (cloud or self-hosted)
- API keys for AI services (OpenAI/Anthropic)
- Social media developer accounts

## Supabase Setup

### 1. Create a Supabase Project

1. Go to [https://app.supabase.com](https://app.supabase.com)
2. Click "New Project"
3. Fill in project details:
   - **Name**: SMGE (or your preferred name)
   - **Database Password**: Generate a strong password and save it securely
   - **Region**: Choose the closest to your users
   - **Pricing Plan**: Start with Free tier

### 2. Configure Environment Variables

1. Copy the environment template:
   ```bash
   cp .env.local.example .env.local
   ```

2. Get your Supabase credentials:
   - Go to your project's Settings > API
   - Copy the following values to `.env.local`:
     - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
     - **anon/public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (keep this secret!)

3. (Optional) Get database connection strings:
   - Go to Settings > Database
   - Copy connection strings if needed for migrations or direct access

### 3. Database Schema Setup

Run the SQL scripts provided in the README to set up your database schema, including:
- User profiles
- Brand context store
- Social accounts
- Content posts
- Workflow executions
- User roles

### 4. Row Level Security (RLS) Policies

Enable RLS on all tables and configure policies for secure data access. RLS ensures users can only access their own data.

### 5. Test Connection

After setup, test your connection using the health check endpoint at `/api/health`.

## Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables:
   ```bash
   cp .env.local.example .env.local
   # Edit .env.local with your Supabase credentials
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
/app              # Next.js App Router
  /api            # API routes
  /(auth)         # Authentication pages
  /(dashboard)    # Protected dashboard routes
/lib              # Shared libraries
  /supabase       # Supabase client configurations
/components       # React components
/types            # TypeScript type definitions
/n8n-workflow     # n8n workflow definitions
```

## Security Best Practices

1. **Never commit `.env.local`** - It contains sensitive keys
2. **Service role key** must only be used server-side
3. **Enable RLS** on all tables before production
4. **Validate all inputs** before database operations
5. **Implement rate limiting** on API routes

## Support

For issues and questions:
- [Supabase Documentation](https://supabase.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [GitHub Issues](https://github.com/Wolfxinze/SMGE/issues)
