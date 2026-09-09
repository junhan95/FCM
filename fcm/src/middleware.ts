import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE } from '@/lib/auth/constants'

/**
 * 1차 걸러내기일 뿐이다.
 *
 * 미들웨어는 엣지에서 실행되어 DB 에 접근할 수 없으므로, 쿠키의 "존재" 만
 * 확인하고 유효성은 보지 않는다. 실제 인가는 requireSession() 이 서버에서
 * 매 요청마다 수행한다.
 *
 * 이 파일 하나로 보안이 성립한다고 생각하면 안 된다. matcher 에서 경로 하나만
 * 빠져도 그 경로가 무방비가 되는 구조이기 때문이다. 방어선은 각 페이지·핸들러의
 * requireSession() 이며, 미들웨어는 불필요한 렌더링을 줄이는 최적화에 가깝다.
 *
 * 문서: docs/05-인증접근제어.md §5-2
 */
export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl
  const hasCookie = req.cookies.has(SESSION_COOKIE)

  if (!hasCookie) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    // 로그인 후 원래 목적지로 복귀시키되, 오픈 리다이렉트를 막기 위해
    // 내부 경로만 허용한다.
    if (pathname !== '/' && isInternalPath(pathname)) {
      url.searchParams.set('next', pathname + search)
    } else {
      url.search = ''
    }
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}

function isInternalPath(p: string): boolean {
  return p.startsWith('/') && !p.startsWith('//') && !p.includes(':')
}

export const config = {
  // 로그인 화면, 정적 자산, 헬스체크를 제외한 전부.
  matcher: ['/((?!login|entry/login|api/integration/session|api/health|assets/|_next/static|_next/image|favicon.ico).*)'],
}
