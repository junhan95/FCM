-- Frankonia Calculation Table (FCT) — PostgreSQL 스키마
-- 적용: npm run db:setup  (scripts/db_setup.ts 가 이 파일을 실행)

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL DEFAULT '',
  role          TEXT NOT NULL DEFAULT 'USER' CHECK (role IN ('ADMIN','USER')),
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 가격 DB (엑셀 'Prices resume' 시트의 행 단위). row 는 엑셀 행 번호(계산 템플릿의 범위 참조 유지용)
CREATE TABLE IF NOT EXISTS price_items (
  id            SERIAL PRIMARY KEY,
  row           INTEGER NOT NULL UNIQUE,
  ref           JSONB,             -- 숫자 또는 문자열 (예: 304, "304_CN")
  sage          TEXT,
  item          TEXT,
  description   TEXT,
  unit          TEXT,
  price         DOUBLE PRECISION,
  delivery      JSONB,
  col_h         JSONB,
  col_i         JSONB,
  col_j         JSONB,
  col_k         JSONB,
  price_date    TEXT,
  category      TEXT,
  is_header     BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by    INTEGER REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS price_items_ref_idx ON price_items ((ref::text));
CREATE INDEX IF NOT EXISTS price_items_category_idx ON price_items (category);

-- 가격 변경 이력
CREATE TABLE IF NOT EXISTS price_history (
  id            SERIAL PRIMARY KEY,
  price_item_id INTEGER NOT NULL REFERENCES price_items(id) ON DELETE CASCADE,
  old_price     DOUBLE PRECISION,
  new_price     DOUBLE PRECISION,
  changed_by    INTEGER REFERENCES users(id),
  changed_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 계산 템플릿 (엑셀에서 추출한 시트 셀 모델). 버전별로 보관
CREATE TABLE IF NOT EXISTS templates (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  version       TEXT NOT NULL,
  json          JSONB NOT NULL,
  is_default    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 견적 프로젝트
CREATE TABLE IF NOT EXISTS projects (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  customer      TEXT NOT NULL DEFAULT '',
  country       TEXT NOT NULL DEFAULT '',
  quotation_no  TEXT NOT NULL DEFAULT '',
  revision      TEXT NOT NULL DEFAULT '',
  editor        TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','OFFERED','ORDERED','LOST','ARCHIVED')),
  template_id   INTEGER NOT NULL REFERENCES templates(id),
  overrides     JSONB NOT NULL DEFAULT '{}'::jsonb,   -- { sheet: { coord: value } }
  notes         TEXT NOT NULL DEFAULT '',
  created_by    INTEGER REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 프로젝트 공동 작업자 — 생성자가 다른 계정에 편집 권한을 준다.
-- 여기에 없는 USER 는 열람만 가능하다 (ADMIN 과 생성자는 항상 편집 가능).
CREATE TABLE IF NOT EXISTS project_members (
  project_id    INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  can_edit      BOOLEAN NOT NULL DEFAULT TRUE,
  added_by      INTEGER REFERENCES users(id),
  added_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);
CREATE INDEX IF NOT EXISTS project_members_user_idx ON project_members (user_id);

-- 프로젝트 저장 스냅샷 (버전 기록)
CREATE TABLE IF NOT EXISTS project_snapshots (
  id            SERIAL PRIMARY KEY,
  project_id    INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  label         TEXT NOT NULL DEFAULT '',
  overrides     JSONB NOT NULL,
  summary       JSONB,
  created_by    INTEGER REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER REFERENCES users(id),
  action        TEXT NOT NULL,
  target        TEXT NOT NULL DEFAULT '',
  detail        JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 가격 DB 업로드 이력 (엑셀 파일로 한꺼번에 갱신한 기록)
CREATE TABLE IF NOT EXISTS price_imports (
  id           SERIAL PRIMARY KEY,
  version      TEXT,                 -- 파일에 적힌 견적 버전 (예: rev-x3.10)
  file_name    TEXT,
  rows         INTEGER NOT NULL DEFAULT 0,
  added        INTEGER NOT NULL DEFAULT 0,
  changed      INTEGER NOT NULL DEFAULT 0,
  removed      INTEGER NOT NULL DEFAULT 0,
  uploaded_by  INTEGER REFERENCES users(id),
  uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 업로드로 바뀐 항목 (신규 추가·가격 변동·삭제)
CREATE TABLE IF NOT EXISTS price_import_changes (
  id          SERIAL PRIMARY KEY,
  import_id   INTEGER NOT NULL REFERENCES price_imports(id) ON DELETE CASCADE,
  row         INTEGER NOT NULL,
  ref         TEXT,
  item        TEXT,
  kind        TEXT NOT NULL,        -- added | price | text | removed
  old_price   DOUBLE PRECISION,
  new_price   DOUBLE PRECISION
);
CREATE INDEX IF NOT EXISTS price_import_changes_idx ON price_import_changes (import_id, kind);
