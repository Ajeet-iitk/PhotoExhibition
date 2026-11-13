import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: './src/main.js',
      output: {
        format: 'iife',
        name: 'PhotoExhibitionApp',
        entryFileNames: 'assets/index.js',
        assetFileNames: 'assets/[name].[ext]'
      }
    }
  }
});
