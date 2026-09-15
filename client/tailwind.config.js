/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta de Columbia's: teal profundo de marca sobre grises cálidos
        marca: {
          50: '#effefb',
          100: '#c7fff4',
          200: '#90ffe9',
          300: '#51f7dc',
          400: '#1de4c9',
          500: '#04c8b0',
          600: '#00a190',
          700: '#058074',
          800: '#0a655e',
          900: '#0d544e',
          950: '#003330',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
