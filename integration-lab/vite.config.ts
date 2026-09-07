import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command }) => ({
  root: __dirname,
  base: command === "build" ? "/integration-lab/" : "/",
  plugins: [react()],
  build: { outDir: "../public/integration-lab", emptyOutDir: true },
  server: { host: "127.0.0.1", port: 3010, strictPort: true },
}));
