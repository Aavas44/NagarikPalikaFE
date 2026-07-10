/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        devanagari: [
          "var(--font-devanagari)",
          "Noto Sans Devanagari",
          "system-ui",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
