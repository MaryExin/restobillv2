/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      screens: {
        wide: "1200px",
      },
      colors: {
        // Variable Colors
        darkerPrimary: "var(--color-darkerPrimary)",
        darkPrimary: "var(--color-darkPrimary)",
        medPrimary: "var(--color-medPrimary)",
        softPrimary: "var(--color-softPrimary)",
        softerPrimary: "var(--color-softerPrimary)",
        colorBrand: "var(--color-brandPrimary)",
        colorBrandSecondary: "var(--color-brandSecondary)",
        colorBrandTertiary: "var(--color-brandTertiary)",
        colorBrandLighter: "var(--color-lighter)",
        colorBrandLight: "var(--color-light)",
        redAccent: "var(--color-redaccent)",

        //Legacy colors
        softWhite: "hsl(0, 0%, 100%)",
        yellowWhite: "hsl(37, 80%, 98%)",
        pinkWhite: "hsl(340, 18%, 97%)",
        softBlue: "hsl(211, 79%, 70%)",
        medBlue: "hsl(205, 78%, 63%)",
        darkBlue: "hsl(206, 85%, 61%)",
        softAccent: "hsl(120, 45%, 39%)",
        darkerAccent: "	hsl(237, 19%, 21%)",
        darkAccent: "	#2C293A",
        darkMedAccent: "	#2D2A32",
        darkestAccent: "	#1D1B29",
        colorTextPrimary: "hsl(240,2%,64%)",
        colorTextSecondary: "hsl(0,0%,38%)",
        colorTextTertiary: "hsl(200,36%,90%)",
        colorBoxPrimary: "hsl(200,36%,90%)",
        colorBoxSecondary: "hsl(200,36%,90%)",
        colorYellowAccent: "HSL(46, 87%, 45%)",
        colorActive: "hsl(105, 100%, 80%)",
      },
      fontFamily: {
        sans: ["Poppins", "sans-serif"],
      },
      backgroundImage: () => ({
        dots: "url('../images/bg-dots.svg')",
      }),
      animation: {
        bounce_light: "bounce_light 1s infinite",
        "spin-slow": "spin 5s linear infinite",
        "spin-medium": "spin 2s linear infinite",
      },
      keyframes: {
        bounce_light: {
          "0%, 100%": { transform: "translateY(-2%)" },
          "50%": { transform: "translateY(0)" },
        },
      },
    },
  },

  plugins: [],
};
