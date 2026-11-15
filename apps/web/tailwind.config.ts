import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        app: {
          primary: 'var(--app-primary)',
          hover: 'var(--app-primary-hover)',
          light: 'var(--app-primary-light)',
          border: 'var(--app-primary-border)',
          background: 'var(--app-background)',
          sidebar: 'var(--app-sidebar)',
          card: 'var(--app-card)',
          hoverSurface: 'var(--app-hover)',
          selected: 'var(--app-selected)',
          text: 'var(--app-text)',
          secondary: 'var(--app-text-secondary)',
          muted: 'var(--app-text-muted)',
          borderDefault: 'var(--app-border)',
          focus: 'var(--app-focus)',
          success: 'var(--app-success)',
          warning: 'var(--app-warning)',
          error: 'var(--app-error)',
          info: 'var(--app-info)',
        },
      },
    },
  },
  plugins: [],
};

export default config;
