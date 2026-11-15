/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { 900: "#0e1a26", 800: "#15263a", 700: "#1f3550" },
        paper: "#f4f5f2",
        gain: "#0a8f5b",
        loss: "#c93c37",
        brand: { DEFAULT: "#0f766e", dark: "#0b5a54" },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};
