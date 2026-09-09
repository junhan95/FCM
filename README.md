# Frankonia Customer Management workspace

## 통합 진입

`start-frankonia.cmd`를 실행한 뒤 [시작 페이지](https://junhan95.github.io/FCM/) 또는 `http://127.0.0.1:3002/login`을 엽니다.

1. 기존 FCM ID/PW로 로그인합니다. 권한이 있는 활성 사업장 중 코드순 첫 사업장을 기본으로 선택하며 현재 사업장을 표시합니다.
2. **Frankonia Customer Management** 또는 **Frankonia Calculation Table**을 선택합니다.
3. FCT는 언어와 시작 화면을 설정한 뒤 진입합니다. FCM 세션으로 인증하므로 재로그인이 필요 없습니다.

첫 실행에 FCM DB가 비어 있으면 기존 개발용 초기 계정을 생성합니다. 계정 목록은 `fcm/README.md`의 시드 계정 항목을 참고하세요. 기존 계정이나 고객이 있으면 시드를 실행하지 않습니다.

Customer Management는 등록 고객에게 메일·뉴스를 전달하는 플랫폼입니다. 현재 고객 관리·업로드가 동작하며, **메일 발송 서비스는 아직 연결되지 않았습니다**. 실제 발송을 수행하지 않습니다.

### 로컬 서비스

| 서비스 | 주소 / 포트 |
| --- | --- |
| FCM 로그인 · 메뉴 · 고객 관리 | `http://127.0.0.1:3002` |
| 통합 FCT | `http://127.0.0.1:3001` |
| FCM PostgreSQL | `127.0.0.1:5433` |
| 소스 FCT PostgreSQL | `localhost:5434` |

`scripts/configure-local.mjs`는 기존 DB 접속 설정을 보존하고, 두 로컬 앱 사이의 무작위 인증 키를 `.env`에 저장합니다. 인증 키를 바꿨다면 실행 중인 두 서버를 종료한 후 다시 실행하세요. 기존 설치형 FCT(3000)는 별도로 유지합니다.

FCM 사용자 ID별로 별도의 FCT 계정을 연결하며 동명 기존 FCT 계정을 자동 병합하지 않습니다. FCM System Administrator는 FCT 관리자, 나머지는 일반 사용자로 연결됩니다. 비밀번호는 공유하거나 복사하지 않습니다. FCM 세션과 현재 권한을 요청마다 확인하며, 로그아웃·권한 회수는 FCT에도 반영됩니다. 연결된 계정의 비밀번호는 FCM에서 관리합니다.

### 검증

- `fcm/`: `npm test`, `npm run typecheck`, `npm run build`
- `fct/`: `npm run lint`, `npm run build`, `npm run verify:engine` (내부 데이터 필요)
- 통합 실행 후 `node scripts/verify-portal.mjs` (로컬 개발용 계정 대상, `PORTAL_TEST_ID` / `PORTAL_TEST_PASSWORD`로 지정 가능)

디자인은 Frankonia Korea의 흰색·붉은색과 챔버 사진 구성을 반영합니다. 로고·사진 출처는 `pages/assets/README.md`에 기록했습니다. 영어가 기본이며 한국어를 지원합니다.

## 기존 FCT 단독 실행 안내

- [FCT 시작 페이지](https://junhan95.github.io/FCM/): 로컬 FCT 접속 안내
- `fct/`: Frankonia Calculation Table 전체 앱 (Next.js + 로컬 PostgreSQL)
- `pages/`: GitHub Pages에 공개되는 정적 시작 페이지

## 로컬 실행

기존 설치본이 있다면 **Frankonia Calculation Table** 아이콘으로 실행한 뒤 시작 페이지의 **FCT 열기**를 누릅니다.

소스에서 실행하려면 Node.js 22 이상을 설치하고, 승인된 내부 배포본의 `prices.json`, `templates.json`, `expected.json`을 `fct/data/`에 복사한 뒤 `fct/start-fct.cmd`를 실행합니다. 첫 실행은 의존성 설치, 로컬 PostgreSQL 준비, DB 초기화, 빌드를 진행합니다. 기존 `.env`와 DB는 유지합니다.

앱은 `http://127.0.0.1:3000`, 소스 실행용 DB는 로컬 포트 5434를 사용합니다. 설치본은 별도 DB 포트 55432를 사용합니다. Pages에서 PC의 프로그램을 직접 시작할 수는 없습니다. 다른 PC에서는 그 PC에 FCT가 설치되어 있어야 합니다.

## 배포 및 데이터

`main`에 푸시하면 GitHub Actions가 `pages/`만 Pages에 배포합니다. 앱 서버, 로그인, 견적 저장, 가격 DB는 로컬에서 동작합니다. 실제 가격표·템플릿·견적 DB·환경설정·로그·설치 바이너리는 공개 저장소나 Pages에 포함하지 않습니다. 원본 로컬 Git 이력도 가져오지 않습니다.

`npm ci`, `npm run lint`, `npm run build`는 `fct/`에서 실행합니다. `npm run verify:engine`은 내부 데이터 파일이 있는 로컬에서 실행합니다. 설치 프로그램 제작 안내는 `fct/installer/README.md`를 참고하세요. 설치 프로그램에는 내부 데이터가 포함되므로 별도 내부 경로로 배포합니다.
