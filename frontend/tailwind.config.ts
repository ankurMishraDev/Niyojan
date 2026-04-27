import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: "#121414",
        "surface-dim": "#121414",
        "surface-bright": "#383939",
        "surface-container-lowest": "#0d0e0f",
        "surface-container-low": "#1b1c1c",
        "surface-container": "#1f2020",
        "surface-container-high": "#292a2a",
        "surface-container-highest": "#343535",
        outline: "#899484",
        "outline-variant": "#3f4a3c",
        primary: "#78dc77",
        "primary-strong": "#4caf50",
        "on-primary": "#00390a",
        "on-surface": "#e3e2e2",
        "on-surface-variant": "#becab9",
        danger: "#ff4d4d",
        warning: "#ffc107",
        success: "#4caf50",
      },
      fontFamily: {
        display: ["Inter", "ui-sans-serif", "system-ui"],
        body: ["Inter", "ui-sans-serif", "system-ui"],
      },
      boxShadow: {
        panel: "0 20px 50px rgba(0,0,0,0.28)",
      },
      borderRadius: {
        panel: "0.5rem",
      },
    },
  },
  plugins: [],
};

export default config;
