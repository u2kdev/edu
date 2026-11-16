import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#1d4ed8",
          700: "#1e40af",
          800: "#1e3a8a",
          900: "#172554",
          950: "#0f172a",
        },
        slate: {
          850: "#131c2e",
          950: "#0b0f19",
        },
        edarschi: {
          bgLight: "#FFFFFF",
          bgLightAlt: "#F4F8FF",
          primaryLight: "#1D4ED8",
          accentLight: "#1E40AF",
          textLight: "#0F172A",
          bgDark: "#0B0F17",
          bgDarkAlt: "#111827",
          cardDark: "#111827",
          primaryDark: "#60A5FA",
          textDark: "#F1F5F9",
        },
        background: "hsl(var(--background-hsl) / <alpha-value>)",
        foreground: "hsl(var(--foreground-hsl) / <alpha-value>)",
        card: {
          DEFAULT: "hsl(var(--card-hsl) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground-hsl) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "hsl(var(--popover-hsl) / <alpha-value>)",
          foreground: "hsl(var(--popover-foreground-hsl) / <alpha-value>)",
        },
        primary: {
          DEFAULT: "hsl(var(--primary-hsl) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground-hsl) / <alpha-value>)",
          hover: "hsl(var(--primary-hover-hsl) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary-hsl) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground-hsl) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted-hsl) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground-hsl) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "hsl(var(--accent-hsl) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground-hsl) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive-hsl) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground-hsl) / <alpha-value>)",
          subtle: "hsl(var(--destructive-subtle-hsl) / <alpha-value>)",
          "subtle-foreground": "hsl(var(--destructive-subtle-foreground-hsl) / <alpha-value>)",
        },
        success: {
          DEFAULT: "hsl(var(--success-hsl) / <alpha-value>)",
          foreground: "hsl(var(--success-foreground-hsl) / <alpha-value>)",
          subtle: "hsl(var(--success-subtle-hsl) / <alpha-value>)",
          "subtle-foreground": "hsl(var(--success-subtle-foreground-hsl) / <alpha-value>)",
        },
        warning: {
          DEFAULT: "hsl(var(--warning-hsl) / <alpha-value>)",
          foreground: "hsl(var(--warning-foreground-hsl) / <alpha-value>)",
          subtle: "hsl(var(--warning-subtle-hsl) / <alpha-value>)",
          "subtle-foreground": "hsl(var(--warning-subtle-foreground-hsl) / <alpha-value>)",
        },
        info: {
          DEFAULT: "hsl(var(--info-hsl) / <alpha-value>)",
          foreground: "hsl(var(--info-foreground-hsl) / <alpha-value>)",
          subtle: "hsl(var(--info-subtle-hsl) / <alpha-value>)",
          "subtle-foreground": "hsl(var(--info-subtle-foreground-hsl) / <alpha-value>)",
        },
        border: "hsl(var(--border-hsl) / <alpha-value>)",
        input: "hsl(var(--input-hsl) / <alpha-value>)",
        ring: "hsl(var(--ring-hsl) / <alpha-value>)",
        scrim: "hsl(var(--scrim-hsl) / <alpha-value>)",
        chart: {
          1: "hsl(var(--chart-1-hsl) / <alpha-value>)",
          2: "hsl(var(--chart-2-hsl) / <alpha-value>)",
          3: "hsl(var(--chart-3-hsl) / <alpha-value>)",
          4: "hsl(var(--chart-4-hsl) / <alpha-value>)",
          5: "hsl(var(--chart-5-hsl) / <alpha-value>)",
          6: "hsl(var(--chart-6-hsl) / <alpha-value>)",
          7: "hsl(var(--chart-7-hsl) / <alpha-value>)",
          8: "hsl(var(--chart-8-hsl) / <alpha-value>)",
        },
        // Token-backed so the public shell can repaint them for the dark theme.
        // The hex fallback preserves the current look everywhere the tokens are
        // not defined (dashboards, admin panels, e-mails).
        ink: {
          DEFAULT: 'var(--ink, #0B1220)',
          soft: 'var(--ink-soft, #384258)',
          muted: 'var(--ink-muted, #5C6678)',
          faint: 'var(--ink-faint, #98A2B3)',
        },
        paper: {
          DEFAULT: 'var(--paper, #FFFFFF)',
          2: 'var(--paper-2, #F6F7FB)',
          3: 'var(--paper-3, #EEF1F7)',
        },
      },
      fontFamily: {
        sans: ['var(--font-wix-text)', 'var(--font-inter)', '"Wix Madefor Text"', 'Manrope', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['var(--font-wix-display)', 'var(--font-wix-text)', 'var(--font-inter)', '"Wix Madefor Display"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        'glow-blue': '0 0 25px -5px rgba(59, 130, 246, 0.4)',
        'glow-lg': '0 0 45px -8px rgba(59, 130, 246, 0.45)',
        'glow-card': '0 10px 30px -10px rgba(37, 99, 235, 0.2)',
        'premium': '0 1px 2px rgba(16, 24, 40, 0.04), 0 16px 44px -22px rgba(16, 24, 40, 0.24)',
        'premium-lg': '0 1px 2px rgba(16, 24, 40, 0.05), 0 30px 64px -26px rgba(29, 78, 216, 0.30)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out forwards',
        'slide-up': 'slideUp 0.4s ease-out forwards',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float-slow': 'float 18s ease-in-out infinite',
        'shine': 'shine 2.5s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translate(0px, 0px) scale(1)' },
          '50%': { transform: 'translate(20px, -25px) scale(1.08)' },
        },
        shine: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(200%)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
