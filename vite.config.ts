import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'
import path from 'path'

// Release version comes from the VERSION file at the repo root, so the site,
// the build metadata and the Discord bot never disagree about it.
const version = fs.existsSync(path.resolve(__dirname, 'VERSION'))
  ? fs.readFileSync(path.resolve(__dirname, 'VERSION'), 'utf-8').trim()
  : '0.0.0'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  plugins: [
    react(),
    tailwindcss()
  ]
})
