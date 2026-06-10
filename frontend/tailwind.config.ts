import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#171717",
        "on-primary": "#ffffff",
        ink: "#171717",
        body: "#4d4d4d",
        mute: "#888888",
        canvas: "#ffffff",
        "canvas-soft": "#fafafa",
        "canvas-soft-2": "#f5f5f5",
        hairline: "#ebebeb",
        "hairline-strong": "#a1a1a1",
        link: "#0070f3",
        "link-bg-soft": "#d3e5ff",
        cyan: "#50e3c2",
        violet: "#7928ca",
        magenta: "#ff0080",
        danger: "#ee0000",
        warning: "#f5a623",
        success: "#0070f3",
      },
      fontFamily: {
        sans: ["Geist", "Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["Geist Mono", "ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "monospace"],
      },
      boxShadow: {
        "card-soft": "0px 1px 1px #00000005, 0px 2px 2px #0000000a, inset 0 0 0 1px #ebebeb",
        "card-medium": "0px 2px 2px #0000000a, 0px 8px 8px -8px #0000000a, inset 0 0 0 1px #ebebeb",
        "card-float": "0px 2px 2px #0000000a, 0px 8px 16px -4px #0000000a, inset 0 0 0 1px #ebebeb",
        "modal": "0px 1px 1px #00000005, 0px 8px 16px -4px #0000000a, 0px 24px 32px -8px #0000000f, inset 0 0 0 1px #ebebeb",
      },
      borderRadius: {
        "pill": "100px",
        "sm": "6px",
        "md": "8px",
        "lg": "12px",
      },
      backgroundImage: {
        "mesh-hero": "radial-gradient(at 0% 0%, hsla(160, 73%, 60%, 0.4) 0px, transparent 50%), radial-gradient(at 100% 0%, hsla(211, 100%, 47%, 0.4) 0px, transparent 50%), radial-gradient(at 100% 100%, hsla(330, 100%, 50%, 0.4) 0px, transparent 50%)",
      }
    },
  },
  plugins: [],
};

export default config;
