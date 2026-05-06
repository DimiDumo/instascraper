/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: token("bg"),
        panel: token("panel"),
        border: token("border"),
        muted: token("muted"),
        accent: token("accent"),
        fg: token("fg"),
        "fg-soft": token("fg-soft"),
        "surface-2": token("surface-2"),
        "surface-3": token("surface-3"),
      },
    },
  },
  plugins: [],
};
