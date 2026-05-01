import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: "#ffffff",
        "surface-dim": "#f8f7f4",
        "surface-bright": "#ffffff",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#f8f7f4",
        "surface-container": "#f4f3f0",
        "surface-container-high": "#eeece7",
        "surface-container-highest": "#e6e2da",
        outline: "#c8c4bb",
        "outline-variant": "#e4e2dc",
        primary: "#1a6b3c",
        "primary-strong": "#155730",
        "on-primary": "#ffffff",
        "on-surface": "#1a1916",
        "on-surface-variant": "#6b6660",
        danger: "#b91c1c",
        warning: "#92690e",
        success: "#1a6b3c",
      },
      fontFamily: {
        display: ["\"DM Sans\"", "ui-sans-serif", "system-ui"],
        body: ["\"DM Sans\"", "ui-sans-serif", "system-ui"],
        mono: ["\"DM Mono\"", "ui-monospace", "monospace"],
      },
      boxShadow: {
        panel: "0 1px 3px rgba(26,25,22,0.07), 0 1px 2px rgba(26,25,22,0.05)",
      },
      borderRadius: {
        panel: "0.75rem",
      },
    },
  },
  plugins: [],
};

export default config;
