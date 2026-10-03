import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Relative asset paths: the build works under /MemoMap/ on GitHub Pages (or any other sub-path).
  base: './',
  // host: true listens on IPv4 and IPv6, so http://localhost:5173 works whichever way the browser resolves it.
  server: { host: true, port: 5173 },
})
