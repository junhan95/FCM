/**
 * 미들웨어(엣지 런타임)와 서버 양쪽에서 쓰이는 상수.
 *
 * 별도 파일로 두는 이유: session.ts 는 node:crypto 와 DB 드라이버를 쓰므로
 * 엣지 번들에 들어갈 수 없다. 미들웨어가 session.ts 에서 상수 하나만
 * 가져와도 모듈 전체가 딸려 들어와 빌드가 깨진다.
 */
export const SESSION_COOKIE = 'fcm_session'
