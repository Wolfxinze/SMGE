/**
 * Social Scheduler Configuration
 *
 * Central configuration for the social scheduler feature.
 * Controls which platforms are enabled and their rate limits.
 */

/**
 * List of currently supported platforms.
 * Only Twitter is fully implemented in this release.
 * Other platforms have stub implementations pending API integration.
 */
export const SUPPORTED_PLATFORMS = ['twitter'] as const;

export type SupportedPlatform = typeof SUPPORTED_PLATFORMS[number];

/**
 * Check if a platform is currently supported
 */
export function isPlatformSupported(platform: string): boolean {
  return SUPPORTED_PLATFORMS.includes(platform as any);
}

/**
 * Platform display configuration
 */
export const PLATFORM_CONFIG = {
  twitter: {
    name: 'Twitter',
    icon: '𝕏',
    color: '#1DA1F2',
    supported: true,
    maxChars: 280,
    maxImages: 4,
    maxVideos: 1,
    rateLimit: 300,
    rateLimitWindow: 180, // minutes
  },
  instagram: {
    name: 'Instagram',
    icon: '📷',
    color: '#E4405F',
    supported: false,
    comingSoon: true,
    maxChars: 2200,
    maxImages: 10,
    maxVideos: 1,
    rateLimit: 25,
    rateLimitWindow: 1440,
  },
  linkedin: {
    name: 'LinkedIn',
    icon: '💼',
    color: '#0077B5',
    supported: false,
    comingSoon: true,
    maxChars: 3000,
    maxImages: 20,
    maxVideos: 1,
    rateLimit: 100,
    rateLimitWindow: 1440,
  },
  tiktok: {
    name: 'TikTok',
    icon: '🎵',
    color: '#000000',
    supported: false,
    comingSoon: true,
    maxChars: 150,
    maxImages: 0,
    maxVideos: 1,
    rateLimit: 50,
    rateLimitWindow: 1440,
  },
  facebook: {
    name: 'Facebook',
    icon: '👍',
    color: '#1877F2',
    supported: false,
    comingSoon: true,
    maxChars: 63206,
    maxImages: 50,
    maxVideos: 1,
    rateLimit: 60,
    rateLimitWindow: 60,
  },
} as const;

/**
 * Get list of available platforms for UI
 */
export function getAvailablePlatforms() {
  return Object.entries(PLATFORM_CONFIG)
    .filter(([_, config]) => config.supported)
    .map(([key]) => key);
}

/**
 * Get platform configuration
 */
export function getPlatformConfig(platform: string) {
  return PLATFORM_CONFIG[platform as keyof typeof PLATFORM_CONFIG];
}