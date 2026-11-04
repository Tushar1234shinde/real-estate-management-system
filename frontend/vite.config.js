import path from "node:path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

const host = process.env.HOST || "0.0.0.0"
const port = parseInt(process.env.PORT || "8443", 10)

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  server: {
    host,
    port,
    strictPort: true,
  },
  preview: {
    host,
    port,
  },
})
