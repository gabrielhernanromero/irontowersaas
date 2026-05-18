import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          orange: "#E8721C",
          "orange-dark": "#cf6318",
          blue: "#1a6fa8",
          "blue-dark": "#0e4d7a",
          dark: "#0a3a5c",
          ink: "#1a2d42",
          mid: "#3a5a7a",
          muted: "#6a8aaa",
          "light-bg": "#f0f6fb",
          "light-border": "#d0e8f7",
          success: "#16a34a",
          danger: "#dc2626",
        },
      },
      fontFamily: {
        condensed: ["'Barlow Condensed'", "sans-serif"],
        body: ["'Barlow'", "sans-serif"],
      },
      maxWidth: {
        content: "1200px",
      },
    },
  },
  plugins: [],
};
export default config;
