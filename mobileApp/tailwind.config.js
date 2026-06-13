/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
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
      borderRadius: {
        "pill": "100px",
        "sm": "6px",
        "md": "8px",
        "lg": "12px",
      },
    },
  },
  plugins: [],
}