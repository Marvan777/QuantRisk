/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#F7F5F0", // warm beige canvas
          900: "#FFFFFF", // cards
          850: "#FBFAF7", // elevated surfaces
          800: "#EEEAE1", // input / hover surfaces
          700: "#DED8CD", // dividers
        },
        line: "#E5E1D8",
        paper: "#1B2926", // primary text
        mute: "#727B76", // secondary text
        pine: {
          400: "#39846D",
          500: "#216B55",
          600: "#174E40",
        },
        rust: "#B34F48",
      },
      fontFamily: {
        sans: ["Inter", "Segoe UI", "sans-serif"],
        mono: ["IBM Plex Mono", "Consolas", "monospace"],
        display: ["Inter", "Segoe UI", "sans-serif"],
      },
      boxShadow: {
        panel: "0 4px 24px rgba(33, 45, 39, 0.045)",
      },
    },
  },
  plugins: [],
};
