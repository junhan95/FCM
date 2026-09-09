# Frankonia Calculation Table (FCT)

공개 저장소에는 앱 소스만 포함됩니다. 가격표와 계산 템플릿은 내부 배포본에서 `data/`에 복사하세요 (`data/README.md` 참고). GitHub Pages는 로컬 앱을 여는 시작 페이지이며 앱 서버와 DB를 호스팅하지 않습니다.

Frankonia EMC 챔버 견적 계산 엑셀(`Global calculation table template_rev-x3.10.xlsx`)을
로컬에서 구동하는 웹앱으로 옮긴 것입니다.

- 로그인(ID/PW) · 관리자/일반 2단계 권한
- 견적 프로젝트별로 Total 집계 + 챔버/룸/옵션 시트(41개) 입력, 자동 저장, 스냅샷
- 가격 DB(2,194행)를 관리자가 웹에서 직접 수정 (변경 이력 기록)
- 계산 엔진은 엑셀 수식을 그대로 해석하는 TypeScript 구현 — 엑셀 캐시값 36,597개 셀과 100% 일치 검증

## 1. 요구 사항

- Node.js 22 이상, npm 10 이상
- PostgreSQL 14 이상 (아래 3항의 스크립트로 관리자 권한 없이 로컬 설치 가능)

## 2. 설치

```powershell
cd D:\FRANKONIA\FCT\fct-app
npm install
copy .env.example .env      # 필요 시 DATABASE_URL, SESSION_SECRET, ADMIN_PASSWORD 수정
```

## 3. 로컬 PostgreSQL (관리자 권한 불필요)

FCM 과 같은 방식으로 PostgreSQL 바이너리를 npm 패키지로 받아 `%LOCALAPPDATA%\fct-pg` 에 둡니다.
포트는 FCM(5433)과 겹치지 않도록 **5434** 를 씁니다.

```powershell
.\scripts\pg-local.ps1 setup     # 최초 1회 (바이너리 다운로드 + 초기화 + 서버 시작)
.\scripts\pg-local.ps1 start     # 이후 PC 재시작 후마다
.\scripts\pg-local.ps1 stop
.\scripts\pg-local.ps1 status
```

`.env` 의 `DATABASE_URL` 은 `postgresql://fct:fct@localhost:5434/fct` 로 맞춥니다.
(이미 PostgreSQL 이 있다면 그 접속 문자열을 넣으면 되고, `fct` 데이터베이스는 다음 단계에서 자동 생성됩니다.)

## 4. DB 초기화 (최초 1회)

```powershell
npm run db:setup
```

스키마 적용 → 가격 DB 시드(`data/prices.json`) → 계산 템플릿 시드(`data/templates.json`) → 관리자 계정 생성
(기본 `admin` / `admin1234`, `.env` 의 `ADMIN_USERNAME`/`ADMIN_PASSWORD` 로 변경 가능).
**로그인 후 "내 계정"에서 비밀번호를 꼭 바꾸세요.**

## 5. 실행

```powershell
npm run dev            # 개발 모드  http://localhost:3000
# 또는
npm run build && npm start     # 운영 모드 (빠름)
```

`start-fct.cmd`를 더블클릭하면 실행 중인 FCT를 먼저 확인합니다. 없으면 의존성 설치 → 로컬 PostgreSQL 준비 → DB 초기화 → 빌드 → 서버 시작을 진행합니다. 서버는 `127.0.0.1`에서만 연결을 받습니다. 포트 변경은 `powershell -ExecutionPolicy Bypass -File scripts/start-local.ps1 -Port 3001`로 실행하고 Pages의 포트도 변경하세요.

## 6. 사용 흐름

1. 로그인 → 프로젝트 목록에서 **새 프로젝트** 생성 (고객·국가·견적번호)
2. 프로젝트 화면(= 엑셀 `Total` 시트): 좌측 **공통 설정**(감독자/작업자 유형, 출장 지역, 운송 조건, 환율, DDP 등)과
   **챔버·룸 집계** 표에서 수량(`Incl.`)·Factor·인원·컨테이너 수 입력. 옵션(최종 검증시험, A2 흡수체, 번역, 액세서리)과 견적 조건은 아래 접이식 블록.
3. 챔버 이름을 클릭하면 해당 계산 시트로 이동: 치수·상승바닥 등 기본값, 각 라인의 Y/N·수량·단가 입력.
   파란 배경 = 입력 가능, 회색 = 자동 계산, 주황 = 수동 덮어쓰기(자동 계산 셀도 ✎ 로 수동 입력 가능, ↺ 로 복원).
4. 입력은 0.9초 후 자동 저장(우측 상단 배지). **스냅샷 저장**으로 시점별 버전을 남기고 복원할 수 있습니다.
5. 관리자: **가격 DB** 에서 단가·설명 수정, 품목 추가 / **사용자** 에서 계정 생성·권한·비활성화.

## 7. 구조

```
data/        prices.json, templates.json, expected.json  ← tools/extract_template.py 가 엑셀에서 생성
db/          schema.sql
scripts/     db_setup.ts (DB 초기화), pg-local.ps1 (로컬 PostgreSQL)
src/engine/  parser.ts (엑셀 수식 파서), workbook.ts (평가기), layout.ts (시트 화면 구조 분석)
src/app/     Next.js App Router 페이지·서버 액션·API
src/components/  ProjectStore (엔진+자동저장), TotalView, SheetEditor, CellGrid, cells
tools/       extract_template.py, verify_engine.ts (엑셀 캐시값 대조), e2e.mjs (Playwright 스모크)
```

### 엑셀 템플릿을 새 리비전으로 교체하려면

```powershell
pip install openpyxl
python tools/extract_template.py "새 템플릿.xlsx" data
npm run verify:engine                  # 100% 일치 확인
$env:TEMPLATE_VERSION="rev-x3.11"; npm run db:setup   # 새 버전 템플릿을 기본으로 등록 (가격 DB는 유지)
```

기존 프로젝트는 생성 당시 템플릿 버전을 계속 사용하고, 새 프로젝트부터 새 템플릿이 적용됩니다.

## 8. 알아둘 점

- 엑셀 원본의 `#REF!` 2곳(1.2 SIS 검증시험 "Europe" 분기), `Reverberation Chamber` 숨김 시트(#N/A)는 그대로 재현됩니다(원본 오류).
- 가격 DB 에서 단가를 바꾸면 모든 프로젝트 계산에 즉시 반영됩니다(엑셀과 동일). 과거 견적 금액을 고정하려면 스냅샷을 남기세요.
- 세션은 12시간 후 만료. 주소창에 경로를 직접 입력해도 로그인 없이는 접근할 수 없습니다.
