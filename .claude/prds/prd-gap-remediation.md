---
name: prd-gap-remediation
description: Close critical gaps between SMGE PRD and current implementation to achieve production readiness
status: backlog
created: 2025-11-29T01:38:56Z
---

# PRD: SMGE Gap Remediation

## Executive Summary

This PRD addresses the critical gaps identified between the original SMGE Product Requirements Document and the current implementation state. The gap analysis revealed that while the project has a solid foundation (52% complete), there are 5 critical blockers preventing production deployment. This remediation effort will close those gaps across three prioritized phases.

**Current State:** 52% complete with working database (82%), APIs (90%), but only Twitter integration functional (20% social coverage).

**Target State:** Production-ready MVP with all 5 social platforms, complete Brand Brain UI, and functional payment processing.

## Problem Statement

### What problem are we solving?

The SMGE platform cannot launch to production because:

1. **Only 1 of 5 social platforms works** - Twitter/X is complete, but Instagram, TikTok, LinkedIn, and Facebook are stubs. Users cannot post to 80% of target platforms.

2. **Brand Brain UI is non-functional** - The core value proposition (AI learning your brand voice) has placeholder UI. Users cannot set up their Brand Brain.

3. **n8n workflows don't exist** - The orchestration layer referenced in the architecture exists only as client code, not actual workflows.

4. **Missing Stripe Price IDs** - Payment processing cannot collect revenue with placeholder price IDs.

5. **No platform webhook handlers** - Engagement Agent cannot receive real-time comments/DMs.

### Why is this important now?

- Product cannot generate revenue without payment configuration
- Core value proposition (Brand Brain + multi-platform posting) is unusable
- Competitor pressure requires rapid market entry
- 162 hours of original epic work will be wasted without remediation

## User Stories

### Primary Persona: Social Media Manager

**As a social media manager**, I need to:
- Connect all my social accounts (Instagram, TikTok, LinkedIn, Facebook, Twitter) in one place
- Train the AI on my brand's voice through an intuitive wizard
- Upload my past performing posts to teach the AI what works
- Schedule and publish content to all platforms simultaneously
- Review and approve AI-generated engagement responses

### Secondary Persona: Agency Owner

**As an agency owner**, I need to:
- Manage multiple client brands from one dashboard
- Invite team members with appropriate permissions
- Track usage and billing across all clients
- White-label the platform for my clients

## Requirements

### Functional Requirements

#### FR1: Social Platform Integrations (P0 Critical)

| Requirement | Description | Acceptance Criteria |
|-------------|-------------|---------------------|
| FR1.1 | Instagram Graph API integration | OAuth flow, token refresh, publish posts with media |
| FR1.2 | TikTok API integration | OAuth flow, video upload, analytics fetch |
| FR1.3 | LinkedIn API integration | OAuth flow, text/image posts, company pages |
| FR1.4 | Facebook Graph API integration | OAuth flow, posts to pages, analytics |
| FR1.5 | Platform webhook handlers | Receive real-time engagement events |

#### FR2: Brand Brain UI (P0 Critical)

| Requirement | Description | Acceptance Criteria |
|-------------|-------------|---------------------|
| FR2.1 | Brand Brain wizard | Step-by-step onboarding flow for voice setup |
| FR2.2 | Past posts upload | Drag-and-drop interface to upload historical content |
| FR2.3 | Voice training feedback | Show learning progress, sample generated content |
| FR2.4 | Content goals selection | Allow users to define content objectives |

#### FR3: Payment Configuration (P0 Critical)

| Requirement | Description | Acceptance Criteria |
|-------------|-------------|---------------------|
| FR3.1 | Stripe Price IDs | Configure production price IDs for all plans |
| FR3.2 | Add-on pricing | Configure add-on products (extra brands, team seats) |

#### FR4: Engagement Features (P1 Important)

| Requirement | Description | Acceptance Criteria |
|-------------|-------------|---------------------|
| FR4.1 | Engagement queue UI | Complete approval/rejection workflow |
| FR4.2 | Comment/DM fetching | Pull engagement from connected platforms |

#### FR5: Agency Features (P1 Important)

| Requirement | Description | Acceptance Criteria |
|-------------|-------------|---------------------|
| FR5.1 | Agency management UI | Client brand management dashboard |
| FR5.2 | Team permissions UI | Role-based access control interface |
| FR5.3 | Brand permission validation | API-level permission checks |

#### FR6: Analytics & Tracking (P1 Important)

| Requirement | Description | Acceptance Criteria |
|-------------|-------------|---------------------|
| FR6.1 | Follower snapshots | Daily follower count tracking table |
| FR6.2 | CTR tracking | Click-through rate measurement |
| FR6.3 | Best-time optimization | AI-powered posting time suggestions |

### Non-Functional Requirements

#### NFR1: Performance
- Social API calls must complete within 10 seconds
- Brand Brain wizard must load in under 2 seconds
- Webhook handlers must process events within 500ms

#### NFR2: Security
- All social tokens encrypted at rest
- RLS policies for all new tables
- API rate limiting per user/brand

#### NFR3: Reliability
- 99.9% uptime for posting queue
- Automatic token refresh before expiration
- Failed post retry with exponential backoff

## Success Criteria

### Phase 1 Completion (P0 Critical)
- [ ] All 5 social platforms functional (OAuth + publish + analytics)
- [ ] Brand Brain wizard complete with 80%+ user completion rate
- [ ] Stripe accepting live payments
- [ ] Platform webhooks receiving events

### Phase 2 Completion (P1 Important)
- [ ] Engagement queue processing comments/DMs
- [ ] Agency dashboard managing 10+ brands
- [ ] Team permissions working for 3+ roles
- [ ] Follower tracking with 7-day history

### Phase 3 Completion (P2 Minor)
- [ ] Best-time posting improving engagement by 10%+
- [ ] Strategy dashboard generating weekly plans
- [ ] CTR tracking with link shortening

## Constraints & Assumptions

### Technical Constraints
- Must use existing Supabase schema where possible
- Twitter integration is the reference pattern for other platforms
- n8n may be replaced with direct API calls if simpler

### Timeline Constraints
- Phase 1 must complete within 4 weeks
- Phase 2 within 3 additional weeks
- Phase 3 within 2 additional weeks

### Resource Constraints
- Single full-stack developer
- No dedicated designer (use existing shadcn/ui)
- Limited social API rate limits during development

### Assumptions
- All platform developer accounts are approved
- Social API credentials are available
- Stripe account is verified for live payments

## Out of Scope

The following are explicitly NOT part of this remediation:

1. **Video repurposing engine** - Major feature, deferred to post-MVP
2. **Competitor intelligence** - New feature area, not gap remediation
3. **CRM integrations** - HubSpot/GoHighLevel deferred
4. **White-label customization** - Agency feature, Phase 2+
5. **Multi-language support** - Future enhancement
6. **YouTube/Pinterest integration** - Not in original PRD scope

## Dependencies

### External Dependencies
- Instagram Graph API developer access
- TikTok for Developers app approval
- LinkedIn Marketing API partner status
- Facebook Graph API business verification
- Stripe live mode activation

### Internal Dependencies
- Existing `lib/scheduler/platforms/base.ts` pattern
- Working `lib/scheduler/platforms/twitter.ts` reference
- Supabase RLS policies from recent security fixes
- Current `lib/stripe/client.ts` integration

## Technical Approach

### Social Platform Integration Pattern

Follow the existing Twitter implementation pattern:
1. OAuth callback handler at `app/auth/callback/[platform]/`
2. Platform class extending `BasePlatform` in `lib/scheduler/platforms/`
3. Token storage in `social_accounts` table with encryption
4. Publish, media upload, and analytics methods

### Brand Brain Wizard Architecture

Multi-step form with:
1. Basic info collection (step 1)
2. Voice characteristics (step 2)
3. Past content upload (step 3)
4. AI training confirmation (step 4)
5. Sample generation preview (step 5)

### n8n Decision

Evaluate whether to:
- Build actual n8n workflow JSON files
- Replace with direct OpenAI/Claude API calls
- Use hybrid approach (direct calls + n8n for complex orchestration)

Recommendation: Start with direct API calls, add n8n later for complex multi-step workflows.

## Effort Estimates

### Phase 1: Critical Gaps (P0)
| Task | Effort |
|------|--------|
| Configure Stripe Price IDs | 2h |
| Instagram Platform | 30h |
| TikTok Platform | 25h |
| LinkedIn Platform | 25h |
| Facebook Platform | 20h |
| Brand Brain Wizard | 30h |
| n8n/Direct API Decision | 40h |
| Platform Webhooks | 30h |
| **Total Phase 1** | **202h** |

### Phase 2: Important Gaps (P1)
| Task | Effort |
|------|--------|
| Past Posts Upload | 15h |
| Engagement Queue UI | 15h |
| Brand Permission Validation | 8h |
| Follower Snapshots | 6h |
| Agency Management UI | 20h |
| Team Permissions UI | 10h |
| **Total Phase 2** | **74h** |

### Phase 3: Minor Gaps (P2)
| Task | Effort |
|------|--------|
| Best-Time Optimization | 8h |
| Strategy Dashboard | 20h |
| CTR Tracking | 4h |
| **Total Phase 3** | **32h** |

**Grand Total: 308 hours (~7.7 weeks at 40h/week)**

## UI/UX Optimization (Parallel Track)

In addition to functional gaps, the UI requires a complete premium redesign inspired by world-class experiences like Singapore Airlines.

### Design Philosophy

**Singapore Airlines Principles:**
1. **Elegant Simplicity** - Clean layouts with generous whitespace
2. **Premium Feel** - Refined typography, subtle gradients, sophisticated palette
3. **Effortless Navigation** - Intuitive hierarchy, clear visual flow
4. **Attention to Detail** - Micro-interactions, smooth transitions, polished states
5. **Trust & Professionalism** - Consistent patterns, reliable feedback, accessibility

### Current UI Audit Issues

| Issue Category | Count | Severity |
|----------------|-------|----------|
| Inconsistent Styling | 15+ | High |
| Missing Responsive Design | 8 | High |
| Hardcoded Colors | 20+ | Medium |
| No Loading States | 6 pages | Medium |
| Accessibility Gaps | 10+ | High |
| Component Duplication | 5 areas | Medium |

### New Design System

#### Color Palette (Premium SaaS)
```css
/* Primary - Deep Navy (Trust, Premium) */
--primary: 222 47% 11%;        /* #0f172a - Singapore Airlines inspired */
--primary-foreground: 210 40% 98%;

/* Accent - Warm Gold (Excellence, Premium) */
--accent: 38 92% 50%;          /* #f59e0b - Subtle gold accent */
--accent-foreground: 222 47% 11%;

/* Success - Refined Teal */
--success: 158 64% 42%;        /* #10b981 */

/* Warning - Warm Amber */
--warning: 38 92% 50%;         /* #f59e0b */

/* Destructive - Muted Coral */
--destructive: 0 72% 51%;      /* #ef4444 */

/* Neutrals - Sophisticated Grays */
--muted: 215 20% 65%;
--border: 214 32% 91%;
```

#### Typography Scale (Premium)
```css
/* Headings - Inter (Semi-bold to Bold) */
--font-display: 'Inter', sans-serif;
h1: 48px/56px, font-weight: 700, letter-spacing: -0.02em
h2: 36px/44px, font-weight: 600, letter-spacing: -0.01em
h3: 24px/32px, font-weight: 600
h4: 20px/28px, font-weight: 600

/* Body - Inter (Regular to Medium) */
body-lg: 18px/28px, font-weight: 400
body: 16px/24px, font-weight: 400
body-sm: 14px/20px, font-weight: 400
caption: 12px/16px, font-weight: 500
```

#### Spacing System (8px Grid)
```css
--space-1: 4px;   /* Tight */
--space-2: 8px;   /* Compact */
--space-3: 12px;  /* Default small */
--space-4: 16px;  /* Default */
--space-5: 24px;  /* Comfortable */
--space-6: 32px;  /* Relaxed */
--space-8: 48px;  /* Section */
--space-10: 64px; /* Page section */
--space-12: 96px; /* Hero */
```

#### Shadow System (Layered Depth)
```css
--shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
--shadow-md: 0 4px 6px -1px rgba(0,0,0,0.1);
--shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.1);
--shadow-xl: 0 20px 25px -5px rgba(0,0,0,0.1);
--shadow-glow: 0 0 20px rgba(245,158,11,0.15); /* Gold glow for premium */
```

### UI/UX Requirements

#### FR7: Design System Foundation (P0)

| Requirement | Description | Acceptance Criteria |
|-------------|-------------|---------------------|
| FR7.1 | Design System Foundation | Color tokens, typography, spacing, shadows in Tailwind |
| FR7.2 | Card Components | 5 card variants (Elevated, Bordered, Glass, Metric, Action) |
| FR7.3 | Form Components | Floating labels, focus rings, error/success states |
| FR7.4 | Loading & Empty States | Skeleton loaders, shimmer, empty illustrations |

#### FR8: Core Page Redesign (P0)

| Requirement | Description | Acceptance Criteria |
|-------------|-------------|---------------------|
| FR8.1 | Header Navigation | Glassmorphism, smooth transitions, user dropdown |
| FR8.2 | Dashboard Redesign | Hero section, metric cards, activity feed |
| FR8.3 | Mobile Responsive | Drawer sidebar, touch targets, bottom nav |

#### FR9: Feature UI Polish (P1)

| Requirement | Description | Acceptance Criteria |
|-------------|-------------|---------------------|
| FR9.1 | Sidebar Navigation | Collapsible, icon+label, section grouping |
| FR9.2 | Button Refinement | Premium/ghost/icon variants, loading states |
| FR9.3 | Analytics Dashboard | Chart styling, sparklines, date picker |
| FR9.4 | Post Generator Redesign | Wizard, platform previews, streaming animation |
| FR9.5 | Toast Notifications | Slide-in, progress bar, stacking |

#### FR10: Polish & Accessibility (P2)

| Requirement | Description | Acceptance Criteria |
|-------------|-------------|---------------------|
| FR10.1 | Micro-interactions | Button feedback, hover effects, animations |
| FR10.2 | Dark Mode Polish | WCAG AA contrast, glow effects, smooth transition |

### UI Task Breakdown

| Task | Title | Effort | Priority |
|------|-------|--------|----------|
| UI-001 | Design System Foundation | 4h | P0 |
| UI-002 | Header Navigation | 6h | P0 |
| UI-003 | Sidebar Navigation | 8h | P1 |
| UI-004 | Dashboard Redesign | 12h | P0 |
| UI-005 | Card Components | 4h | P0 |
| UI-006 | Form Components | 8h | P0 |
| UI-007 | Button Refinement | 4h | P1 |
| UI-008 | Analytics Dashboard | 10h | P1 |
| UI-009 | Post Generator Redesign | 8h | P1 |
| UI-010 | Loading & Empty States | 6h | P0 |
| UI-011 | Toast Notifications | 4h | P1 |
| UI-012 | Mobile Responsive | 10h | P0 |
| UI-013 | Micro-interactions | 6h | P2 |
| UI-014 | Dark Mode Polish | 4h | P2 |

**Total UI Effort:** 94 hours

### Implementation Phases

- **Phase 1 (Foundation):** UI-001, UI-005, UI-006, UI-010 (22h)
- **Phase 2 (Core Pages):** UI-002, UI-004, UI-012 (28h)
- **Phase 3 (Features):** UI-003, UI-007, UI-008, UI-009, UI-011 (34h)
- **Phase 4 (Polish):** UI-013, UI-014 (10h)

### Design References

**Additional Inspiration:**
- Linear.app - Clean developer tools aesthetic
- Stripe Dashboard - Premium SaaS patterns
- Vercel - Modern, minimal approach
- Notion - Refined typography and spacing

---

## Combined Effort Summary

| Category | Tasks | Effort |
|----------|-------|--------|
| Functional Gaps (P0-P2) | 17 | 308h |
| UI/UX Optimization | 14 | 94h |
| **Grand Total** | **31** | **402h** |

**Timeline:** ~10 weeks at 40h/week
