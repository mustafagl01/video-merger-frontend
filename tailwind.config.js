/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#0A0F1A",
        panel: "#111827",
        accent: "#22D3EE",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(34,211,238,0.2), 0 20px 60px rgba(2,6,23,0.7)",
      },
    },
  },
  plugins: [],
};
