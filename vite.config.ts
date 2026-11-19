import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 5174 para no chocar con la web (5173); está en los orígenes permitidos del servidor
export default defineConfig({
  server: { host: true, port: 5174, strictPort: true },
  preview: { host: true },
  plugins: [react()],
});
