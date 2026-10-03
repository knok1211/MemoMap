import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// host: true listens on IPv4 and IPv6, so http://localhost:5173 works whichever way the browser resolves it.
export default defineConfig({ plugins: [react()], server: { host: true, port: 5173 } })
