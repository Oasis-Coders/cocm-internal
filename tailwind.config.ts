import type { Config } from 'tailwindcss';

// Shared COCM design tokens — single source of truth lives in @cocm/theme
// (Oasis-Coders/cocm-theme). Edit there; both apps update on next build.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const themePreset = require('@cocm/theme/tailwind.preset.cjs');

const config: Config = {
  presets: [themePreset],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  plugins: [],
};

export default config;
