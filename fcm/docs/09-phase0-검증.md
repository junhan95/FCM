# Phase 0 검증 기록

> 실행일 2026-08-26 · PostgreSQL 16.13 · Node.js 22.22.2
> 재현: `npm run db:migrate && npm run db:seed && npm run test:isolation`

## 1. 결과

DB 를 완전히 삭제한 상태에서 부트스트랩 → 마이그레이션 → RLS → 시드 → 테스트를
처음부터 실행해 **격리 테스트 15개 전부 통과**했습니다.

| 그룹 | 테스트 | 검증 내용 |
|---|---|---|
| 전제 조건 | 3 | 앱 롤이 슈퍼유저·소유자가 아님, `BYPASSRLS` 없음, `FORCE RLS` 활성 |
| 조회 격리 | 3 | 자기 사업장만 조회, **ID 직접 지정 차단(IDOR)**, 집계도 격리 |
| fail-closed | 2 | 컨텍스트 없으면 예외, 트랜잭션 종료 후 값 미잔존 |
| 쓰기 격리 | 3 | 타 사업장 INSERT 거부, UPDATE·DELETE 0건 |
| 완전 격리의 귀결 | 1 | 동일 이메일이 사업장별로 독립 공존 |
| 감사 로그 | 3 | 경계 넘는 기록 가능, 타 사업장 대상 기록 비노출, append-only |

## 2. 테스트가 잡아낸 실제 문제

설계 문서(`07-기술스택.md` §3)는 다음을 권장했습니다.

```sql
-- 문서의 원래 권장안
CREATE POLICY site_isolation ON contact
  USING (site_id = current_setting('app.site_id')::uuid);
-- "두 번째 인자를 생략하면 미설정 시 예외가 발생한다"
```

**이 전제가 틀렸습니다.**

PostgreSQL 은 접두사가 붙은 사용자 정의 파라미터(`app.site_id`)를 세션에서 한 번이라도
설정하면 플레이스홀더를 만들어 둡니다. `SET LOCAL`(또는 `set_config(..., true)`) 이
끝난 뒤 파라미터는 **사라지지 않고 `''`(빈 문자열)로 되돌아갑니다.**

결과적으로 `current_setting('app.site_id')` 는 예외를 던지지 않고 `''` 를 반환하며,
`''::uuid` 캐스팅 오류로 **우연히** 막히는 상태가 됩니다. 막히긴 하지만 의도한
메커니즘이 아니고, 오류 메시지도 원인을 알려주지 않습니다
(`invalid input syntax for type uuid: ""`).

→ 명시적 검사로 교체했습니다.

```sql
CREATE OR REPLACE FUNCTION current_site_id() RETURNS uuid
  LANGUAGE plpgsql STABLE AS $$
DECLARE v text;
BEGIN
  v := current_setting('app.site_id', true);
  IF v IS NULL OR v = '' THEN
    RAISE EXCEPTION 'app.site_id 가 설정되지 않았습니다 — withSite() 를 거치지 않은 데이터 접근입니다'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN v::uuid;
END $$;
```

이제 컨텍스트 없는 접근은 원인을 명시한 예외로 즉시 실패합니다.

> 이것이 Phase 0 에서 격리 테스트를 먼저 만든 이유입니다. 이 문제는 화면을 만들고
> 데이터가 안 보일 때 발견됐다면 원인 추적에 한참 걸렸을 것이고, 반대로 정책이
> 우연히 통과하는 방향으로 어긋났다면 **아무도 모르는 채 배포됐을 것입니다.**

## 3. 그 외 확인된 사항

- **`SET LOCAL` 은 파라미터 바인딩을 지원하지 않습니다.** 문자열 결합으로 만들면
  SQL 인젝션 경로가 되므로 `set_config('app.site_id', $1, true)` 를 사용합니다
  (`src/lib/tenancy.ts`).
- **`FORCE ROW LEVEL SECURITY` 는 소유자에게도 적용됩니다.** 시드 스크립트조차
  사업장 컨텍스트를 설정해야 INSERT 가 됩니다 — 정책이 실제로 살아 있다는 증거입니다.
- **`fcm_owner` 는 데이터베이스에 `CREATE` 권한이 필요합니다.** 마이그레이션 도구가
  자체 스키마(`drizzle`)를 생성하기 때문입니다.
- **감사 로그의 쓰기는 격리하지 않습니다.** 사업장 경계를 넘는 행위를 기록하는 것이
  목적이므로, 기록까지 격리하면 우회 접근이 기록되지 못합니다.
  읽기만 `target_site_id` 기준으로 제한합니다.

## 4. 환경 관련 주석

검증은 PostgreSQL **16.13** 에서 수행했습니다. Docker Hub 접근이 차단된 환경이라
`postgres:17-alpine` 이미지를 받지 못해 시스템 패키지로 대체했습니다.

RLS·`FORCE RLS`·`set_config` 는 16 과 17 의 동작이 동일하므로 결과는 유효하지만,
**실제 개발 환경(`docker-compose.yml`, PostgreSQL 17)에서 한 번 더 확인하는 것을
권장합니다.** `npm run db:migrate && npm run db:seed && npm run test:isolation` 만
실행하면 됩니다.

## 5. 남은 작업 (Phase 1 로 이월)

- `app_user` / `user_site_membership` 조회가 현재 모든 사업장에 열려 있습니다.
  로그인에 필요하기 때문이나, Phase 1 에서 조회 범위를 좁혀야 합니다.
- `system_setting` 의 비밀값 되읽기 차단은 API 계층에서 구현합니다 (Phase 2).
- `email_template`, `data_subject_request` 등 나머지 격리 대상 테이블은
  해당 Phase 에서 생성 시 동일한 RLS 정책을 함께 적용합니다.
