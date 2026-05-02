import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#0a0a0f',
          elev: '#13131a',
          card: '#1a1a24',
        },
        brand: {
          50: '#f5f0ff',
          100: '#ede1ff',
          200: '#dcc7ff',
          300: '#c39dff',
          400: '#a66bff',
          500: '#8b3dff',
          600: '#7a25e6',
          700: '#6618c2',
          800: '#54169e',
          900: '#46167f',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'gradient': 'gradient 8s ease infinite',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
      },
      keyframes: {
        gradient: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
      },
    },
  },
  plugins: [],
};
export default config;
