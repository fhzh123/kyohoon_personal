/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      keyframes: {
        backgroundPulse: {
          '0%, 100%': { 'background-size': '200% 200%', 'background-position': '0% 0%' },
          '50%': { 'background-size': '250% 250%', 'background-position': '100% 100%' },
        },
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        tabContentFadeIn: {
          from: { opacity: '0', transform: 'translateX(10px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        glowPulse: {
          '0%, 100%': { 'box-shadow': '0 0px 10px rgba(96, 165, 250, 0.4)' },
          '50%': { 'box-shadow': '0 0px 20px rgba(96, 165, 250, 0.8)' },
        },
      },
      animation: {
        backgroundPulse: 'backgroundPulse 120s ease-in-out infinite',
        fadeIn: 'fadeIn 0.8s ease-out forwards',
        tabContentFadeIn: 'tabContentFadeIn 0.4s ease-out forwards',
        glowPulse: 'glowPulse 2s infinite alternate',
      }
    },
  },
  plugins: [],
}