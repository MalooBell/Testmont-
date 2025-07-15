import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    // Cette configuration est correcte et permet au frontend de trouver l'API et le WebSocket
    'import.meta.env.VITE_API_BASE_URL': JSON.stringify(
      process.env.PORT_3001 ? `https://${process.env.PORT_3001}` : 'http://localhost:3001'
    ),
    'import.meta.env.VITE_WS_URL': JSON.stringify(
      process.env.PORT_3001 ? `wss://${process.env.PORT_3001}` : 'ws://localhost:3001'
    ),
  },
  server: {
    port: 4200,
    host: true,
    open: true
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
})