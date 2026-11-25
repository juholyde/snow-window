/// <reference types="vitest/config" />
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {}

export default defineConfig({
  plugins: [vue()],
  // GitHub Pages serves the repo under /snow-window/.
  base: env.GITHUB_ACTIONS ? '/snow-window/' : '/',
  server: { port: 5191, strictPort: true },
  test: {
    environment: 'node',
    globals: true,
    exclude: ['**/node_modules/**', '**/dist/**', '**/.claude/worktrees/**'],
  },
})
