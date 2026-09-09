import type { NextConfig } from 'next'

const config: NextConfig = {
  reactStrictMode: true,
  // 정적 export 를 하지 않는다. FCM 은 매 요청마다 서버에서 인가를 검사해야 하며
  // (docs/05-인증접근제어.md §4), 정적 사이트로는 그것이 불가능하다.
  // GitHub Pages 에 올릴 수 없는 이유이기도 하다 (docs/08-개발흐름.md §1-2).
  poweredByHeader: false,
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        // Login form POSTs need an Origin for CSRF validation. Send only the
        // origin, never customer paths or query strings.
        { key: 'Referrer-Policy', value: 'origin' },
      ],
    }]
  },
}

export default config
