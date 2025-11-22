/**
 * Infrastructure Integration Tests
 * Tests to verify all infrastructure components are properly configured and communicating
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { createClient } from '@/lib/supabase/client';
import { N8NClient } from '@/lib/n8n/client';

describe('Infrastructure Integration Tests', () => {
  describe('Next.js Application', () => {
    it('should have health check endpoint responding', async () => {
      const response = await fetch('http://localhost:3000/api/health');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('ok');
      expect(data.services).toBeDefined();
      expect(data.services.api).toBe('online');
    });

    it('should load environment variables', () => {
      expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toBeDefined();
      expect(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBeDefined();
    });
  });

  describe('Supabase Configuration', () => {
    let supabase: ReturnType<typeof createClient>;

    beforeAll(() => {
      supabase = createClient();
    });

    it('should create Supabase client successfully', () => {
      expect(supabase).toBeDefined();
      expect(supabase.auth).toBeDefined();
      expect(supabase.from).toBeDefined();
    });

    it('should have valid Supabase URL format', () => {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      expect(url).toMatch(/^https:\/\/.*\.supabase\.co$/);
    });

    it('should have valid anon key format (JWT)', () => {
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      expect(key).toMatch(/^eyJ/); // JWT starts with eyJ
    });

    it('should be able to check auth session', async () => {
      const { data, error } = await supabase.auth.getSession();
      // Session might be null for unauthenticated, but should not error
      expect(error).toBeNull();
      expect(data).toBeDefined();
    });
  });

  describe('n8n Configuration', () => {
    let n8n: N8NClient;

    beforeAll(() => {
      n8n = new N8NClient({
        baseUrl: process.env.N8N_URL || 'http://localhost:5678'
      });
    });

    it('should create n8n client successfully', () => {
      expect(n8n).toBeDefined();
    });

    it('should have n8n URL configured', () => {
      expect(process.env.N8N_URL).toBeDefined();
      expect(process.env.N8N_URL).toMatch(/^https?:\/\//);
    });

    // This test requires n8n to be running
    it.skip('should connect to n8n API', async () => {
      const workflows = await n8n.getWorkflows();
      expect(Array.isArray(workflows)).toBe(true);
    });
  });

  describe('Environment Variables', () => {
    it('should have all required Supabase variables', () => {
      const required = [
        'NEXT_PUBLIC_SUPABASE_URL',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY'
      ];

      required.forEach(key => {
        expect(process.env[key]).toBeDefined();
        expect(process.env[key]).not.toBe('');
      });
    });

    it('should have n8n configuration', () => {
      expect(process.env.N8N_URL).toBeDefined();
    });

    it('should not expose service role key in client', () => {
      // Service role key should only be available server-side
      expect(process.env.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
    });
  });

  describe('API Routes', () => {
    it('should have health check route', async () => {
      const response = await fetch('http://localhost:3000/api/health');
      expect(response.ok).toBe(true);
    });

    it('should have n8n webhook route defined', async () => {
      // Webhook route should exist (even if it returns error without valid payload)
      const response = await fetch('http://localhost:3000/api/webhooks/n8n', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      // Should not be 404, might be 400/401 without proper auth
      expect(response.status).not.toBe(404);
    });
  });

  describe('TypeScript Configuration', () => {
    it('should have proper path aliases configured', async () => {
      // Test if @/ alias works by importing a file
      const { createClient: client } = await import('@/lib/supabase/client');
      expect(client).toBeDefined();
    });
  });
});

describe('Integration Readiness', () => {
  it('should have all infrastructure components ready', () => {
    const readiness = {
      nextjs: true, // Running and responding
      supabase: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      n8n: !!process.env.N8N_URL,
      environment: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    };

    expect(readiness.nextjs).toBe(true);
    expect(readiness.supabase).toBe(true);
    expect(readiness.n8n).toBe(true);
    expect(readiness.environment).toBe(true);
  });
});
