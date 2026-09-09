-- fcm_owner 로 실행. 마이그레이션 이후에 적용한다.
-- 문서: docs/07-기술스택.md §3

-- ── 런타임 롤 권한 ────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO fcm_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO fcm_app;
ALTER DEFAULT PRIVILEGES FOR ROLE fcm_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO fcm_app;

-- ── 현재 세션의 사업장 ────────────────────────────────────────────
-- fail-closed 가 목표다. 사업장 컨텍스트 없이 들어온 접근은 0건을 조용히
-- 반환하는 것이 아니라 예외로 막아야 한다. 조용히 0건이면 버그가
-- "데이터가 없네" 로 위장되어 배포까지 살아남는다.
--
-- 주의: current_setting('app.site_id') 를 그냥 쓰면 안 된다.
-- PostgreSQL 은 접두사가 붙은 사용자 정의 파라미터를 세션에 한 번이라도
-- 설정하면 플레이스홀더를 만들어 두며, SET LOCAL 이 끝난 뒤에는 파라미터가
-- 사라지는 것이 아니라 '' (빈 문자열) 로 되돌아간다. 즉 "미설정 시 예외"가
-- 성립하지 않고 ''::uuid 캐스팅 오류로 우연히 막히는 상태가 된다.
-- 우연에 기대지 않고 직접 검사한다.
CREATE OR REPLACE FUNCTION current_site_id() RETURNS uuid
  LANGUAGE plpgsql STABLE
  AS $$
DECLARE
  v text;
BEGIN
  v := current_setting('app.site_id', true);
  IF v IS NULL OR v = '' THEN
    RAISE EXCEPTION
      'app.site_id 가 설정되지 않았습니다 — withSite() 를 거치지 않은 데이터 접근입니다'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN v::uuid;
END
$$;

-- ── 사업장 격리 정책 ──────────────────────────────────────────────
-- FORCE 가 없으면 테이블 소유자는 정책을 무시한다. 반드시 함께 켠다.

ALTER TABLE company ENABLE ROW LEVEL SECURITY;
ALTER TABLE company FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS site_isolation ON company;
CREATE POLICY site_isolation ON company
  USING (site_id = current_site_id())
  WITH CHECK (site_id = current_site_id());

ALTER TABLE contact ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS site_isolation ON contact;
CREATE POLICY site_isolation ON contact
  USING (site_id = current_site_id())
  WITH CHECK (site_id = current_site_id());


ALTER TABLE import_batch ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_batch FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS site_isolation ON import_batch;
CREATE POLICY site_isolation ON import_batch
  USING (site_id = current_site_id())
  WITH CHECK (site_id = current_site_id());

-- ── 감사 로그 ─────────────────────────────────────────────────────
-- 읽기는 target_site_id 기준이다. Site Admin 은 "자기 사업장 데이터에
-- 무슨 일이 있었는가" 를 봐야 하며, 여기에 System Admin 의 타 사업장
-- 접근 기록이 포함되어야 감시가 성립한다.
--
-- 쓰기는 WITH CHECK (true) 다. 사업장 경계를 넘는 행위를 기록하는 것이
-- 목적이므로, 기록 자체를 격리하면 우회 접근이 기록되지 못한다.
--
-- UPDATE/DELETE 정책이 없다 = RLS 가 거부한다 = append-only.
-- FORCE 때문에 소유자도 수정·삭제할 수 없다.
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_read ON audit_log;
CREATE POLICY audit_read ON audit_log FOR SELECT
  USING (target_site_id = current_site_id());
DROP POLICY IF EXISTS audit_write ON audit_log;
CREATE POLICY audit_write ON audit_log FOR INSERT
  WITH CHECK (true);
