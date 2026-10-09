import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const shared = resolve('shared')

export default defineConfig({
  main: {
    resolve: {
      alias: {
        '@shared': shared
      }
    }
  },
  preload: {
    resolve: {
      alias: {
        '@shared': shared
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': shared
      }
    },
    plugins: [react(), tailwindcss()]
  }
})
