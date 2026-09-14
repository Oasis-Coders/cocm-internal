import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'COCM Internal',
    short_name: 'COCM',
    description: 'COCM 内部系统 — 用餐报名、人数统计与月底结算',
    start_url: '/',
    display: 'standalone',
    background_color: '#faf7f0',
    theme_color: '#2d2f92',
    icons: [
      {
        src: '/cocm-logo.png',
        sizes: 'any',
        type: 'image/png',
      },
    ],
  };
}
