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
      colors: {
        canvas: {
          DEFAULT: "#ffffff",
          dark: "#090a0f",
          soft: "#f8fafc",
          "soft-dark": "#0f1016",
        },
        surface: {
          DEFAULT: "#ffffff",
          dark: "#13151c",
          "dark-subtle": "#171922",
          "dark-card": "#13151c",
          "dark-well": "#0c0d12",
        },
        brand: {
          rose: "#f43f5e",
          "rose-hover": "#e11d48",
          orange: "#fc4c02",
          magenta: "#ef2cc1",
          periwinkle: "#bdbbff",
          mint: "#c8f6f9",
        },
        ink: {
          DEFAULT: "#111827",
          dark: "#f4f4f5",
          muted: "#9ca3af",
          soft: "#6b7280",
        },
        hairline: {
          DEFAULT: "#e5e7eb",
          dark: "rgba(255, 255, 255, 0.08)",
        },
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SF Mono", "Menlo", "monospace"],
      },
      borderRadius: {
        xs: "3.25px",
        sm: "4px",
        md: "8px",
      },
    },
  },
  plugins: [],
};

export default config;
