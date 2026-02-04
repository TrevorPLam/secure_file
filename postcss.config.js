// AI-META-BEGIN
// AI-META: PostCSS configuration - enables Tailwind CSS and Autoprefixer processing
// OWNERSHIP: config/styling
// ENTRYPOINTS: Used by Vite/build tools to process CSS
// DEPENDENCIES: tailwindcss, autoprefixer
// DANGER: None - standard PostCSS plugin setup
// CHANGE-SAFETY: Safe to add new PostCSS plugins
// TESTS: Verify CSS output after build
// AI-META-END

export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
