import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  plugins: [react(), ...(process.env.PLAYGROUND_HTTPS === '1' ? [basicSsl()] : [])],
  server: {
    port: 5173, strictPort: true,
    allowedHosts: process.env.PLAYGROUND_ALLOWED_HOSTS?.split(',').filter(Boolean),
  },
  preview: { port: 4173, strictPort: true },
  build: { target: 'es2022' },
});
