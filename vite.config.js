import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  root: "./client",
  plugins: [react()],
  server: {
    proxy: {
      "/socket.io": {
        target: "http://localhost:5002",
        ws: true
      }
    }
  },
  build: {
    // Output the client build to the server's public folder
    outDir: path.resolve(__dirname, 'server', 'public'),
    emptyOutDir: true
  }
});
