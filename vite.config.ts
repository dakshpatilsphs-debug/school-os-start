import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  server: {
    proxy: {
      '/smsgw': {
        target: 'http://10.205.244.156:8082',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/smsgw/, ''),
      },
    },
  },
  // Admin mode is env-driven (VITE_ADMIN_MODE). No extra vite config needed,
  // but defining mode makes `vite build --mode admin` load .env.admin.
  define: {
    // ensure admin flag is string-replaced if needed
  },
}));
