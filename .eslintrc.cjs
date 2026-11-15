module.exports = {
  root: true,
  plugins: ['@typescript-eslint'],
  extends: ['next/core-web-vitals', 'prettier'],
  rules: {
    '@next/next/no-html-link-for-pages': 'off',
  },
};
