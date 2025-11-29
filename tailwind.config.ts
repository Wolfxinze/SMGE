import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // ========================================
      // SMGE Design System Foundation (UI-001)
      // Premium SaaS Design inspired by Singapore Airlines
      // ========================================

      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        // Semantic colors
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
      },

      // Typography Scale (Inter font family)
      fontSize: {
        // Display sizes
        "display-2xl": ["72px", { lineHeight: "80px", letterSpacing: "-0.02em" }],
        "display-xl": ["60px", { lineHeight: "68px", letterSpacing: "-0.02em" }],
        "display-lg": ["48px", { lineHeight: "56px", letterSpacing: "-0.02em" }],

        // Heading sizes
        "heading-xl": ["48px", { lineHeight: "56px", letterSpacing: "-0.02em" }],
        "heading-lg": ["36px", { lineHeight: "44px", letterSpacing: "-0.01em" }],
        "heading-md": ["24px", { lineHeight: "32px", letterSpacing: "0" }],
        "heading-sm": ["20px", { lineHeight: "28px", letterSpacing: "0" }],

        // Body sizes
        "body-lg": ["18px", { lineHeight: "28px", letterSpacing: "0" }],
        "body-md": ["16px", { lineHeight: "24px", letterSpacing: "0" }],
        "body-sm": ["14px", { lineHeight: "20px", letterSpacing: "0" }],

        // Caption/Label sizes
        "caption": ["12px", { lineHeight: "16px", letterSpacing: "0.01em" }],
        "overline": ["11px", { lineHeight: "16px", letterSpacing: "0.05em" }],
      },

      // Font weights for typography
      fontWeight: {
        normal: "400",
        medium: "500",
        semibold: "600",
        bold: "700",
      },

      // Spacing System (8px Grid)
      spacing: {
        "0.5": "2px",    // space-0.5
        "1": "4px",      // space-1
        "2": "8px",      // space-2
        "3": "12px",     // space-3
        "4": "16px",     // space-4
        "5": "20px",     // space-5
        "6": "24px",     // space-6
        "7": "28px",     // space-7
        "8": "32px",     // space-8
        "9": "36px",     // space-9
        "10": "40px",    // space-10
        "11": "44px",    // space-11
        "12": "48px",    // space-12
        "14": "56px",    // space-14
        "16": "64px",    // space-16
        "20": "80px",    // space-20
        "24": "96px",    // space-24
        "28": "112px",   // space-28
        "32": "128px",   // space-32
      },

      // Shadow System (Premium depth perception)
      boxShadow: {
        "xs": "0 1px 2px rgba(0, 0, 0, 0.05)",
        "sm": "0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)",
        "md": "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
        "lg": "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
        "xl": "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
        "2xl": "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
        // Premium gold glow for accent elements
        "glow": "0 0 20px rgba(245, 158, 11, 0.15)",
        "glow-sm": "0 0 10px rgba(245, 158, 11, 0.1)",
        "glow-lg": "0 0 40px rgba(245, 158, 11, 0.2)",
        // Primary glow for interactive states
        "glow-primary": "0 0 20px rgba(15, 23, 42, 0.15)",
        // Success glow
        "glow-success": "0 0 20px rgba(16, 185, 129, 0.15)",
        // Card shadows
        "card": "0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04)",
        "card-hover": "0 4px 12px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06)",
        // Inner shadows
        "inner-sm": "inset 0 1px 2px rgba(0, 0, 0, 0.05)",
        "inner": "inset 0 2px 4px rgba(0, 0, 0, 0.06)",
      },

      // Border Radius (Consistent rounding)
      borderRadius: {
        "none": "0",
        "sm": "4px",
        "DEFAULT": "6px",
        "md": "8px",
        "lg": "12px",
        "xl": "16px",
        "2xl": "20px",
        "3xl": "24px",
        "full": "9999px",
      },

      // Animation Keyframes
      keyframes: {
        // Fade animations
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "fade-out": {
          "0%": { opacity: "1" },
          "100%": { opacity: "0" },
        },
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in-down": {
          "0%": { opacity: "0", transform: "translateY(-10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        // Slide animations
        "slide-up": {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "slide-down": {
          "0%": { transform: "translateY(-10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "slide-in-left": {
          "0%": { transform: "translateX(-10px)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        "slide-in-right": {
          "0%": { transform: "translateX(10px)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        // Scale animations
        "scale-in": {
          "0%": { transform: "scale(0.95)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "scale-out": {
          "0%": { transform: "scale(1)", opacity: "1" },
          "100%": { transform: "scale(0.95)", opacity: "0" },
        },
        // Spin animation
        "spin-slow": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        // Pulse animation for loading states
        "pulse-subtle": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
        // Shimmer for skeleton loading
        "shimmer": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        // Bounce subtle
        "bounce-subtle": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-5px)" },
        },
      },

      // Animation utilities
      animation: {
        "fade-in": "fade-in 0.2s ease-out",
        "fade-out": "fade-out 0.2s ease-out",
        "fade-in-up": "fade-in-up 0.3s ease-out",
        "fade-in-down": "fade-in-down 0.3s ease-out",
        "slide-up": "slide-up 0.3s ease-out",
        "slide-down": "slide-down 0.3s ease-out",
        "slide-in-left": "slide-in-left 0.3s ease-out",
        "slide-in-right": "slide-in-right 0.3s ease-out",
        "scale-in": "scale-in 0.2s ease-out",
        "scale-out": "scale-out 0.2s ease-out",
        "spin-slow": "spin-slow 3s linear infinite",
        "pulse-subtle": "pulse-subtle 2s ease-in-out infinite",
        "shimmer": "shimmer 2s linear infinite",
        "bounce-subtle": "bounce-subtle 2s ease-in-out infinite",
      },

      // Transition timing
      transitionTimingFunction: {
        "ease-premium": "cubic-bezier(0.4, 0, 0.2, 1)",
        "ease-bounce": "cubic-bezier(0.34, 1.56, 0.64, 1)",
        "ease-smooth": "cubic-bezier(0.25, 0.1, 0.25, 1)",
      },

      // Transition durations
      transitionDuration: {
        "75": "75ms",
        "100": "100ms",
        "150": "150ms",
        "200": "200ms",
        "250": "250ms",
        "300": "300ms",
        "400": "400ms",
        "500": "500ms",
      },

      // Background images for gradients
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic": "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        "gradient-premium": "linear-gradient(135deg, var(--tw-gradient-stops))",
        "shimmer-gradient": "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)",
      },
    },
  },
  plugins: [],
};

export default config;
