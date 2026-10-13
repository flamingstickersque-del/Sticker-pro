import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://v2.tauri.app/start/frontend/vite/
export default defineConfig({
  plugins: [react()],

  // Vite options tailored for Tauri development
  // Prevent vite from obscuring rust errors
  clearScreen: false,

  server: {
    port: 5173,
    // Tauri expects a fixed port; fail if that port is not available
    strictPort: true,
    host: true,
    // Enable HMR with Tauri dev
    hmr: {
      protocol: 'ws',
      host: 'localhost',
    },
    watch: {
      // Ignore watching Tauri's Rust source during frontend HMR
      ignored: ['**/src-tauri/**'],
    },
  },

  // Environment variables prefixed with VITE_ are exposed to the frontend
  envPrefix: ['VITE_'],

  build: {
    // Tauri uses Chromium on Windows and WebKit on macOS/Linux
    target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari14',
    // Don't minify for debug builds
    minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
    // Produce sourcemaps for debug builds
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
});
