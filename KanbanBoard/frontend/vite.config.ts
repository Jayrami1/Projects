import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173, // Vite's default port
    proxy: {
      // Intercept any request starting with /api
      '/api': {
        target: 'http://localhost:3000', // Your Express backend
        changeOrigin: true, // Changes the origin of the host header to the target URL
        secure: false, // Set to false if using plain HTTP
      },
    },
  },
});
