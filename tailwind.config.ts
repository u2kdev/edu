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
          50: "#f0f5ff",
          100: "#e5edff",
          200: "#cddbfe",
          300: "#b4c9fe",
          400: "#809ffe",
          500: "#4f6ef7",
          600: "#3b52e6",
          700: "#2d3cc3",
          800: "#27319e",
          900: "#242c7e",
          950: "#14174b",
        },
        slate: {
          850: "#131c2e",
          950: "#0b0f19",
        },
        edarschi: {
          bgLight: "#FFFFFF",
          bgLightAlt: "#F4F8FF",
          primaryLight: "#2563EB",
          accentLight: "#1E3A8A",
          textLight: "#0F172A",
          bgDark: "#0A1128",
          bgDarkAlt: "#0F1B3D",
          cardDark: "#13224D",
          primaryDark: "#3B82F6",
          textDark: "#E2E8F0",
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
        display: ['"Wix Madefor Display"', '"Wix Madefor Text"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
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
