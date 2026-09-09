import { hash, verify } from '@node-rs/argon2'

/**
 * OWASP 권장 Argon2id 파라미터.
 * 비밀번호 해싱은 직접 구현하지 않는다 — 인증 로직만 직접 만든다.
 * 문서: docs/07-기술스택.md §5
 */
const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, OPTIONS)
}

export async function verifyPassword(stored: string, plain: string): Promise<boolean> {
  try {
    return await verify(stored, plain, OPTIONS)
  } catch {
    return false
  }
}
