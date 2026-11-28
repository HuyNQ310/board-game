import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true,
      },
      '/api': 'http://localhost:3000',
      '/luat-choi': 'http://localhost:3000',
      '/en/rules': 'http://localhost:3000',
      '/robots.txt': 'http://localhost:3000',
      '/sitemap.xml': 'http://localhost:3000',
      '/llms.txt': 'http://localhost:3000',
    },
  },
});
