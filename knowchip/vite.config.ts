import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { resolve } from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
      react(),
      tailwindcss(),
      viteStaticCopy({
        targets: [
          {
            src: './manifest.json',
            dest: '.'
          }
        ]
      })
  ],
  build: {
    outDir: 'build',
    rollupOptions : {
      input: {
          main: './index.html',
          background: resolve(__dirname, 'src/code/background/background.js'),
      },
        output: {
          entryFileNames: (chunkInfo) => {
              return chunkInfo.name == 'background'
              ? '[name].js'
                  :'assets/[name]-[hash].js';
          },
        }
    }
  }
})
