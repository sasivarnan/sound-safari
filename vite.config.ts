import { defaultClientConditions, defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    // Use ONNX Runtime's supported external-WASM entrypoint. Transformers.js
    // downloads its version-matched runtime from jsDelivr instead of emitting
    // an unused 26 MB binary that exceeds the host's per-asset limit.
    conditions: ["onnxruntime-web-use-extern-wasm", ...defaultClientConditions],
  },
  worker: { format: "es" },
});
