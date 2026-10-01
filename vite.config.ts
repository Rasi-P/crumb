import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  build: { chunkSizeWarningLimit: 1500 },
  // Loaded lazily with the 3D studio. Declared up front so the dev server
  // does not discover them mid-session and reload the page.
  optimizeDeps: {
    include: [
      "three",
      "three-stdlib",
      "three-mesh-bvh",
      "@react-three/fiber",
      "@react-three/drei",
    ],
  },
});
