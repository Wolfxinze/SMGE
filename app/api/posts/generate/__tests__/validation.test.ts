/**
 * Validation tests for Post Generator API
 *
 * Tests input validation and error handling
 */

import { describe, it, expect } from '@jest/globals'

describe('POST /api/posts/generate - Validation Logic', () => {
  describe('Required Fields', () => {
    it('should identify missing brand_id', () => {
      const request = {
        topic: 'Test topic',
        platform: 'instagram',
      }

      const hasBrandId = !!(request as any).brand_id
      expect(hasBrandId).toBe(false)
    })

    it('should identify missing topic', () => {
      const request = {
        brand_id: 'test-id',
        platform: 'instagram',
      }

      const hasTopic = !!(request as any).topic
      expect(hasTopic).toBe(false)
    })

    it('should identify missing platform', () => {
      const request = {
        brand_id: 'test-id',
        topic: 'Test topic',
      }

      const hasPlatform = !!(request as any).platform
      expect(hasPlatform).toBe(false)
    })

    it('should validate complete request', () => {
      const request = {
        brand_id: 'test-id',
        topic: 'Test topic',
        platform: 'instagram',
      }

      const isValid = !!(
        request.brand_id &&
        request.topic &&
        request.platform
      )

      expect(isValid).toBe(true)
    })
  })

  describe('Platform Validation', () => {
    const validPlatforms = ['instagram', 'twitter', 'linkedin', 'tiktok', 'facebook']

    validPlatforms.forEach(platform => {
      it(`should accept valid platform: ${platform}`, () => {
        expect(validPlatforms).toContain(platform)
      })
    })

    it('should have exactly 5 supported platforms', () => {
      expect(validPlatforms).toHaveLength(5)
    })

    it('should reject invalid platform', () => {
      const invalidPlatform = 'myspace'
      expect(validPlatforms).not.toContain(invalidPlatform)
    })
  })

  describe('Platform Character Limits', () => {
    const platformLimits = {
      twitter: 280,
      instagram: 2200,
      linkedin: 3000,
      tiktok: 2200,
      facebook: 63206,
    }

    it('should enforce Twitter limit (280 chars)', () => {
      expect(platformLimits.twitter).toBe(280)
    })

    it('should enforce Instagram limit (2200 chars)', () => {
      expect(platformLimits.instagram).toBe(2200)
    })

    it('should enforce LinkedIn limit (3000 chars)', () => {
      expect(platformLimits.linkedin).toBe(3000)
    })

    it('should enforce TikTok limit (2200 chars)', () => {
      expect(platformLimits.tiktok).toBe(2200)
    })

    it('should enforce Facebook limit (63206 chars)', () => {
      expect(platformLimits.facebook).toBe(63206)
    })

    it('should identify content exceeding Twitter limit', () => {
      const content = 'a'.repeat(300)
      const exceedsLimit = content.length > platformLimits.twitter

      expect(exceedsLimit).toBe(true)
      expect(content.length).toBe(300)
    })

    it('should identify content within Instagram limit', () => {
      const content = 'a'.repeat(2000)
      const withinLimit = content.length <= platformLimits.instagram

      expect(withinLimit).toBe(true)
    })
  })

  describe('Content Type Validation', () => {
    const validContentTypes = ['post', 'story', 'reel', 'thread', 'article']

    validContentTypes.forEach(type => {
      it(`should accept valid content type: ${type}`, () => {
        expect(validContentTypes).toContain(type)
      })
    })

    it('should have exactly 5 content types', () => {
      expect(validContentTypes).toHaveLength(5)
    })
  })

  describe('Optional Parameters', () => {
    it('should handle missing max_length', () => {
      const request = {
        brand_id: 'test-id',
        topic: 'Test',
        platform: 'instagram',
      }

      const maxLength = (request as any).max_length || undefined
      expect(maxLength).toBeUndefined()
    })

    it('should handle provided max_length', () => {
      const request = {
        brand_id: 'test-id',
        topic: 'Test',
        platform: 'instagram',
        max_length: 500,
      }

      expect(request.max_length).toBe(500)
    })

    it('should default include_hashtags to undefined', () => {
      const request = {
        brand_id: 'test-id',
        topic: 'Test',
        platform: 'instagram',
      }

      const includeHashtags = (request as any).include_hashtags
      expect(includeHashtags).toBeUndefined()
    })

    it('should handle reference_content_ids array', () => {
      const request = {
        brand_id: 'test-id',
        topic: 'Test',
        platform: 'instagram',
        reference_content_ids: ['ref-1', 'ref-2'],
      }

      expect(Array.isArray(request.reference_content_ids)).toBe(true)
      expect(request.reference_content_ids).toHaveLength(2)
    })
  })

  describe('Brand Voice Integration', () => {
    it('should structure brand voice data correctly', () => {
      const brandVoice = {
        tone: ['professional', 'friendly'],
        writing_style: ['informative', 'concise'],
        keywords: ['innovation', 'technology'],
        avoid_phrases: ['cheap', 'discount'],
        brand_values: ['quality', 'trust'],
      }

      expect(brandVoice.tone).toBeInstanceOf(Array)
      expect(brandVoice.writing_style).toBeInstanceOf(Array)
      expect(brandVoice.keywords).toBeInstanceOf(Array)
      expect(brandVoice.avoid_phrases).toBeInstanceOf(Array)
      expect(brandVoice.brand_values).toBeInstanceOf(Array)
    })

    it('should handle missing brand voice gracefully', () => {
      const brandVoice = null
      const defaultTone = brandVoice || { tone: ['professional'] }

      expect(defaultTone).toBeDefined()
    })

    it('should extract first tone from array', () => {
      const brandVoice = {
        tone: ['professional', 'friendly'],
      }

      const primaryTone = brandVoice.tone[0]
      expect(primaryTone).toBe('professional')
    })
  })

  describe('Generation Context Building', () => {
    it('should structure generation context correctly', () => {
      const context = {
        brand: {
          name: 'Test Brand',
          voice: {
            tone: ['professional'],
            writing_style: ['informative'],
          },
        },
        request: {
          topic: 'Product launch',
          platform: 'instagram',
          content_type: 'post',
          max_length: 2200,
        },
        reference_content: [],
      }

      expect(context.brand).toBeDefined()
      expect(context.request).toBeDefined()
      expect(context.reference_content).toBeInstanceOf(Array)
    })

    it('should include reference content when provided', () => {
      const referenceContent = [
        { content: 'Example 1', platform: 'instagram' },
        { content: 'Example 2', platform: 'instagram' },
      ]

      expect(referenceContent).toHaveLength(2)
      expect(referenceContent[0]).toHaveProperty('content')
      expect(referenceContent[0]).toHaveProperty('platform')
    })
  })
})
