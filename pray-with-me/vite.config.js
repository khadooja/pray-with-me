import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

// Multi-page build: every HTML page must be listed here or it won't be in dist/.
const page = (p) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        main: page("./index.html"),
        labPose: page("./labs/pose.html"),
        labSpeech: page("./labs/speech.html"),
      },
    },
  },
  // The ASR worker is an ES module worker (it imports transformers.js).
  worker: {
    format: "es",
  },
  // transformers.js ships its own onnxruntime setup; pre-bundling it in dev breaks it.
  optimizeDeps: {
    exclude: ["@huggingface/transformers"],
  },
});
