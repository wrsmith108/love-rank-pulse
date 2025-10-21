import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      external: [
        // Exclude backend/server-side dependencies from frontend build
        /^node:/,
        'express',
        'express-rate-limit',
        '@prisma/client',
        'bcrypt',
        'bcryptjs',
        'jsonwebtoken',
        'ioredis',
      ],
    },
  },
  optimizeDeps: {
    exclude: [
      // Exclude backend packages from optimization
      '@prisma/client',
      'bcryptjs',
      'express-rate-limit',
    ],
  },
}));
