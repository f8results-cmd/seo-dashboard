import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#1B2B6B',
          50: '#E8EBF5',
          100: '#C5CBEA',
          200: '#8F9DD4',
          300: '#5A70BF',
          400: '#2E4AAD',
          500: '#1B2B6B',
          600: '#162358',
          700: '#111B44',
          800: '#0B1230',
          900: '#060A1C',
        },
        orange: {
          DEFAULT: '#E8622A',
          50: '#FDF0EA',
          100: '#FAD9C9',
          200: '#F4B397',
          300: '#EE8C64',
          400: '#E8622A',
          500: '#D14E19',
          600: '#A83D14',
          700: '#7F2D0F',
          800: '#551E0A',
          900: '#2C0F05',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
