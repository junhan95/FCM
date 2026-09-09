-- 슈퍼유저로 실행. 롤 생성과 스키마 소유권 이전만 담당한다.
--
-- 롤을 셋으로 나누는 이유:
--   postgres  (슈퍼유저)  — 부트스트랩 전용. 슈퍼유저는 RLS 를 항상 우회한다.
--   fcm_owner (비슈퍼유저) — 스키마 소유, 마이그레이션 실행
--   fcm_app   (비소유)     — 애플리케이션 런타임. RLS 가 적용되는 유일한 롤.
--
-- 애플리케이션이 owner 나 superuser 로 접속하면 격리가 통째로 무력화된다.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'fcm_owner') THEN
    CREATE ROLE fcm_owner LOGIN PASSWORD 'devonly'
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'fcm_app') THEN
    CREATE ROLE fcm_app LOGIN PASSWORD 'devonly'
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END $$;

-- 마이그레이션 도구가 자체 스키마(drizzle)를 만들 수 있어야 한다.
DO $$
BEGIN
  EXECUTE format('GRANT CONNECT, CREATE ON DATABASE %I TO fcm_owner', current_database());
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO fcm_app', current_database());
END $$;

ALTER SCHEMA public OWNER TO fcm_owner;
GRANT USAGE ON SCHEMA public TO fcm_app;
