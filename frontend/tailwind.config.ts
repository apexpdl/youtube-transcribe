import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./hooks/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "rgb(var(--background) / <alpha-value>)",
        foreground: "rgb(var(--foreground) / <alpha-value>)",
        card: "rgb(var(--card) / <alpha-value>)",
        "card-foreground": "rgb(var(--card-foreground) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        "muted-foreground": "rgb(var(--muted-foreground) / <alpha-value>)",
        border: "rgb(var(--border) / <alpha-value>)",
        input: "rgb(var(--input) / <alpha-value>)",
        ring: "rgb(var(--ring) / <alpha-value>)",
        primary: {
          DEFAULT: "rgb(var(--primary) / <alpha-value>)",
          foreground: "rgb(var(--primary-foreground) / <alpha-value>)",
          50: "#fff1f1",
          100: "#ffe1e1",
          200: "#ffc7c7",
          300: "#ffa0a0",
          400: "#ff6b6b",
          500: "#ff3b3b",
          600: "#ed1c1c",
          700: "#c81212",
          800: "#a51313",
          900: "#881717",
          950: "#4b0606",
        },
        accent: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          foreground: "rgb(var(--accent-foreground) / <alpha-value>)",
        },
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.125rem",
      },
      boxShadow: {
        card: "0 1px 3px 0 rgb(0 0 0 / 0.08), 0 1px 2px -1px rgb(0 0 0 / 0.08)",
        "card-hover":
          "0 10px 30px -12px rgb(0 0 0 / 0.20), 0 4px 8px -4px rgb(0 0 0 / 0.10)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "highlight-pulse": {
          "0%": { backgroundColor: "rgb(var(--primary) / 0.20)" },
          "100%": { backgroundColor: "transparent" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "progress-stripes": {
          "0%": { backgroundPosition: "1rem 0" },
          "100%": { backgroundPosition: "0 0" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.35s ease-out",
        "highlight-pulse": "highlight-pulse 2s ease-out forwards",
        shimmer: "shimmer 1.6s infinite",
        "progress-stripes": "progress-stripes 1s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
