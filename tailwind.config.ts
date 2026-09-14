import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        serif: ["'DM Serif Display'", 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', '-apple-system', "'Segoe UI'", 'sans-serif'],
      },
      colors: {
        cocm: {
          paper: '#faf7f0',
          ink: '#2d2f92',
          'ink-light': '#4a4dc0',
          'ink-pale': '#e4e5fb',
          blue: '#2d2f92',
          'blue-light': '#5b5ee0',
          'blue-pale': '#e4e5fb',
          red: '#e5444c',
          'red-dark': '#c9333b',
          'red-light': '#fbe0e1',
          slate: '#5d5f7d',
          sand: '#f5efdc',
          sky: '#e4e5fb',
        },
      },
      boxShadow: {
        card: 'rgba(31,33,71,0.04) 0px 0px 0px 1px, rgba(31,33,71,0.05) 0px 2px 8px, rgba(31,33,71,0.10) 0px 8px 24px',
        'card-hover': 'rgba(31,33,71,0.08) 0px 4px 16px',
        panel: '0 18px 60px rgba(31, 33, 71, 0.14)',
        'red-glow': '0 2px 8px rgba(229,68,76,0.25)',
      },
      borderRadius: {
        card: '20px',
        panel: '28px',
      },
    },
  },
  plugins: [],
};

export default config;
