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
    resolve: {
      dedupe: ['react','react-dom'],
    },
  build: {
    outDir: 'build',
    rollupOptions : {
      input: {
          main: './index.html',
          background: resolve(__dirname, 'src/code/background/background.js'),
          injected: resolve(__dirname, 'src/code/injected.js'),
      },
        output: {
          entryFileNames: (chunkInfo) => {
              return ['background', 'injected'].includes(chunkInfo.name)
              ? '[name].js'
                  :'assets/[name]-[hash].js';
          },
        }
    }
  }
})
