import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path' // 👈 Make sure to import 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'ossos': path.resolve(__dirname, './node_modules/ossos/src/ossos.ts')
    }
  }
})
