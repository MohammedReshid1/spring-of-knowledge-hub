import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import os from "os";

export default defineConfig({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      // Proxy auth API endpoints (but not the frontend /auth route)
      '^/auth/': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
      },
      // Proxy other API endpoints
      '^/(api|users|students|teachers|classes|attendance|payments|branches|subjects|exams|discipline|inventory|notifications|parents|timetable|calendar|reports|backups|system-.*|rbac|admin-users|uploads|grade-.*)/': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  cacheDir: os.tmpdir() + '/vite-cache-' + Math.random().toString(36).substring(7),
  optimizeDeps: {
    include: ['react', 'react-dom', 'react/jsx-runtime'],
  },
});