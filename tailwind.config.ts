import type { Config } from "tailwindcss";

const config: Config = {
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
          dark: "#010120",
          soft: "#f9f9fa",
        },
        surface: {
          dark: "#010120",
          "dark-soft": "#191932",
          "dark-card": "#0c0c28",
        },
        brand: {
          orange: "#fc4c02",
          magenta: "#ef2cc1",
          periwinkle: "#bdbbff",
          mint: "#c8f6f9",
        },
        ink: {
          DEFAULT: "#000000",
          muted: "#999999",
          soft: "#666666",
        },
        hairline: {
          DEFAULT: "#ebebeb",
          dark: "rgba(255, 255, 255, 0.12)",
          subtle: "rgba(0, 0, 0, 0.08)",
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
      backgroundImage: {
        "together-gradient": "linear-gradient(90deg, #fc4c02 0%, #ef2cc1 50%, #bdbbff 100%)",
        "together-gradient-vertical": "linear-gradient(180deg, #fc4c02 0%, #ef2cc1 50%, #bdbbff 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
