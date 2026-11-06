/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}"
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#EEF2FF",
          100: "#E0E7FF",
          500: "#6366F1",
          600: "#4F46E5",
          700: "#4338CA",
          900: "#312E81",
        },
        surface: {
          light: "#FFFFFF",
          dark: "#1E293B",
          subtle: "#F1F5F9",
        },
        ink: {
          primary: "#0F172A",
          muted: "#64748B",
          faint: "#94A3B8",
        }
      },
    },
  },
  plugins: [],
};
