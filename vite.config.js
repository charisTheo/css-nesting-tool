import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    outDir: "build"
  },
  base: process.env.NODE_ENV === 'development' ? '' : 'https://charistheo.github.io/css-nesting-tool/',
  server: {
    host:"0.0.0.0",
    port:3000,
    strictPort: true,
  }
});
