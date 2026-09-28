/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Azul marino oficial de Blueground (del logo), en escala completa.
        brand: {
          50: '#eef1f7',
          100: '#d7deea',
          200: '#b0bfd6',
          300: '#8496b9',
          400: '#5c6f99',
          500: '#3d5077',
          600: '#2c3f63',
          700: '#273756',
          800: '#1d2a42',
          900: '#141c2e',
        },
        // Acento cálido para darle vida a botones y estados activos.
        accent: {
          50: '#fff8ec',
          100: '#ffedc7',
          200: '#ffd98a',
          300: '#ffc14d',
          400: '#ffab24',
          500: '#f6960f',
          600: '#d97a06',
          700: '#b25c07',
        },
      },
    },
  },
  plugins: [],
};
