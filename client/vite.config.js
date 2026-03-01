import { defineConfig } from 'vite'
import { configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'

const isTest = process.env.VITEST === 'true'

// https://vite.dev/config/
export default defineConfig(async () => {
  const plugins = [react()]

  if (!isTest) {
    const tailwindcss = (await import('@tailwindcss/vite')).default
    plugins.push(tailwindcss())
  }

  return {
    plugins,
    server: {
      proxy: {
        '/api': 'http://localhost:5000',
      },
    },
    test: {
      globals: true,
      environment: 'happy-dom',
      setupFiles: './src/test/setup.js',
      css: false,
      pool: 'forks',
      exclude: [...configDefaults.exclude],
      server: {
        deps: {
          inline: ['@asamuzakjp/css-color'],
        },
      },
    },
  }
})
