import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  base: loadEnv(mode, process.cwd()).VITE_BASE_PATH || "/",
  plugins: [react(), tailwindcss()],
  build: {
    outDir: fileURLToPath(new URL("../ProjectManagement/wwwroot", import.meta.url)),
    // Recreate wwwroot on each build; static source files belong in public/.
    emptyOutDir: true,
  },
}));
