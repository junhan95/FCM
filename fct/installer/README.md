# Frankonia Calculation Table — 설치 프로그램

## 만들기 (Windows)

```powershell
cd D:\FRANKONIA\FCT\fct-app
powershell -ExecutionPolicy Bypass -File installer\build.ps1
```

하는 일

1. `npm install` (필요할 때) → `next build` (standalone 출력)
2. `installer\payload` 에 배포할 내용을 모은다
   - `.next\standalone` + `.next\static` + `public` — 앱과 필요한 모듈만
   - `data\prices.json`, `data\templates.json`, `db\schema.sql` — 첫 실행에 넣을 기초 데이터
   - `scripts\db_setup.cjs` — 초기화 스크립트를 단독 실행 가능한 JS 로 묶은 것
   - 실행·설치 스크립트와 아이콘
   - 개발용 `.env` 는 넣지 않는다
3. Inno Setup 으로 `installer\out\FCT-Setup-<버전>.exe` 를 만든다
   (Inno Setup 이 없으면 winget 으로 설치를 시도한다)

옵션: `-SkipBuild` 앱 빌드 건너뛰기 · `-PayloadOnly` 컴파일 없이 payload 만

## 설치 프로그램이 하는 일

1. 앱 파일을 `C:\Program Files\Frankonia Calculation Table` 에 넣는다
2. **필수 프로그램 자동 설치** (`scripts\prereqs.ps1`)
   - Node.js — 없거나 v20 미만이면 공식 LTS MSI 를 조용히 설치
   - PostgreSQL — **이 앱 전용**으로 설치 폴더 안(`pgsql\`)에만 둔다.
     시스템에 이미 깔린 PostgreSQL 이 있어도 건드리지 않는다.
3. **데이터베이스 준비** (`scripts\postinstall.ps1`)
   - `C:\ProgramData\FrankoniaCT\pgdata` 에 전용 인스턴스를 만들고 포트 **55432**, 127.0.0.1 로만 연다
   - 무작위 비밀번호와 `AUTH_SECRET` 을 만들어 `C:\ProgramData\FrankoniaCT\.env` 에 쓴다
   - 스키마 · 가격 DB(2,194행) · 템플릿 · 관리자 계정(admin / admin1234)을 넣는다
4. **바탕화면과 시작 메뉴에 아이콘**을 만든다

## 실행

바탕화면의 **Frankonia Calculation Table** 아이콘을 누르면 (`FCT.vbs`)

1. 전용 PostgreSQL 이 꺼져 있으면 켜고
2. 앱 서버를 띄우고 (기본 3000 포트, 이미 쓰고 있으면 빈 포트를 찾는다)
3. 준비가 끝나면 기본 브라우저로 연다

검은 콘솔 창은 뜨지 않는다. 시작 메뉴의 **… 종료** 를 누르면 앱과 DB 를 함께 내린다.

## 폴더

| 위치 | 내용 |
| --- | --- |
| `C:\Program Files\Frankonia Calculation Table` | 앱 · 실행 스크립트 · 전용 PostgreSQL 바이너리 |
| `C:\ProgramData\FrankoniaCT\pgdata` | 데이터베이스 (견적 · 가격 DB) |
| `C:\ProgramData\FrankoniaCT\.env` | 접속 정보 — **백업해 두세요** |
| `C:\ProgramData\FrankoniaCT\logs` | 설치·실행 로그 |

## 제거

제어판에서 제거하면 앱 서버와 DB 를 내린 뒤 프로그램 파일을 지운다.
견적 데이터를 함께 지울지 묻는다 — "아니요" 를 고르면 다시 설치할 때 그대로 이어진다.

## 알아 둘 점

- 첫 설치는 Node.js 와 PostgreSQL 을 내려받으므로 **인터넷 연결**이 필요하고 몇 분 걸린다.
- 설치에는 관리자 권한이 필요하다.
- 초기 관리자 계정은 `admin` / `admin1234` — **로그인 후 바로 바꿔야 한다.**
