import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // 'server-only' 는 클라이언트 번들 유입을 막는 빌드 타임 가드다.
      // Node 에서 도는 테스트에는 해당하지 않으므로 스텁으로 대체한다.
      'server-only': fileURLToPath(new URL('./tests/stubs/server-only.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 30_000,
    fileParallelism: false,
  },
})
