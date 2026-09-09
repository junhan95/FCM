# FCM — Frankonia Customer Management

## 통합 워크스페이스

이 저장소의 상위 `start-frankonia.cmd`로 실행합니다. FCM은 `127.0.0.1:3002`, FCT는 `127.0.0.1:3001`에서 실행됩니다. 로그인은 ID/PW만 입력하며 활성 멤버십에 따른 기본 사업장을 선택합니다. 로그인 후 `/workspace`에서 Customer Management 또는 FCT를 선택합니다. 자세한 통합 실행·인증 규칙은 상위 README를 참고하세요.

아래 문서의 3요소 로그인은 기존 인증 함수와 사업장별 권한 검증에 대한 설명입니다. 통합 진입은 그 검증을 재사용하며, 권한 없는 사업장을 자동 선택하지 않습니다. 고객 이메일·뉴스 발송은 아직 연결되지 않았습니다.

Frankonia 그룹 5개 사업장의 고객 데이터를 단일 원천으로 통합하고,
통제된 이메일 발송과 영업 팔로업 추적을 제공하는 사내 도구.

**현재 상태: Phase 1 (MVP) 완료** — 로그인·격리·고객 관리·스프레드시트 업로드

## 설계 문서

| 문서 | 내용 |
|---|---|
| [01 목적정의](docs/01-목적정의.md) | 무엇을 왜 만드는가 |
| [02 요구사항정의서](docs/02-요구사항정의서.md) | 기능 단위 요구사항 (A~G) |
| [03 데이터모델초안](docs/03-데이터모델초안.md) | 엔티티·필드·관계 |
| [04 사업장·권한구조](docs/04-사이트권한구조.md) | 사업장 정의, 권한 매트릭스 |
| [05 인증접근제어](docs/05-인증접근제어.md) | **최우선 설계 영역** |
| [06 관할별법령대응](docs/06-관할별법령대응.md) | EU/독일·중국·한국·인도 |
| [07 기술스택](docs/07-기술스택.md) | 스택 결정과 근거 |
| [08 개발흐름](docs/08-개발흐름.md) | 단계별 로드맵 |
| [09 Phase 0 검증](docs/09-phase0-검증.md) | 격리 계층 검증 기록 |
| [10 Phase 1 검증](docs/10-phase1-검증.md) | 인증·업로드 검증 기록 |

## 가장 중요한 성질

각 사업장 영업담당자는 **자기 사업장 고객만** 확인·관리할 수 있으며,
이 격리는 애플리케이션이 아니라 **데이터베이스가 강제**합니다.

격리는 조용히 깨지는 종류의 기능입니다. 화면은 멀쩡히 뜨고 에러도 나지 않으면서
남의 사업장 데이터가 섞여 나옵니다. 그래서 `tests/isolation.test.ts` 에 고정해 두었고,
CI 에서 이 테스트가 실패하면 병합할 수 없습니다.

데이터 접근은 반드시 `withSite()` 를 거칩니다. 거치지 않으면 예외가 발생합니다.

```ts
import { withSite } from '@/lib/tenancy'

// siteId 는 세션에서 온다. 요청 파라미터에서 오지 않는다.
const rows = await withSite(session.siteId, async (tx) =>
  tx.select().from(contact)      // 자기 사업장 데이터만 반환된다
)
```

## 로컬 개발

필요: Node.js 22+, Docker (또는 아래 §Docker 없는 환경)

```bash
cp .env.example .env
docker compose up -d          # PostgreSQL 17
npm install
npm run db:migrate            # 롤 생성 → 스키마 → RLS 정책
npm run db:seed               # 사업장 5곳 + 더미 고객
npm test                      # 격리 16 · 인증 17 · 업로드 13
npm run dev                   # http://localhost:3000 → 로그인 화면

# HTTP 레벨 확인 (서버 기동 후)
npm run build && npm start &
FCM_SMOKE_URL=http://127.0.0.1:3000 npm run test:smoke
```

### Docker 없는 환경 (Windows)

Docker Desktop 을 설치할 수 없거나 관리자 권한이 없는 경우, PostgreSQL 바이너리를
npm 으로 받아 사용자 프로필에서 실행하는 스크립트를 제공합니다.
저장소 폴더는 건드리지 않으며 관리자 권한도 필요 없습니다.

```powershell
.\scripts\pg-local.ps1 setup    # 최초 1회 — 바이너리 내려받기 + DB 초기화
npm run db:migrate
npm run db:seed
npm run dev
```

재부팅 후에는 `.\scripts\pg-local.ps1 start` 로 다시 띄웁니다.
`stop` / `status` / `reset` 도 지원합니다.

포트는 `docker compose` 와 동일한 **5433** 이므로 `.env` 를 바꿀 필요가 없습니다.

### DB 롤 셋

| 롤 | 용도 | RLS |
|---|---|---|
| `postgres` (슈퍼유저) | 부트스트랩 전용 | 항상 우회 |
| `fcm_owner` | 스키마 소유, 마이그레이션 | FORCE 로 적용됨 |
| `fcm_app` | **애플리케이션 런타임** | 적용됨 |

애플리케이션이 `fcm_owner` 나 슈퍼유저로 접속하면 격리가 통째로 무력화됩니다.
`DATABASE_URL_APP` 은 항상 `fcm_app` 이어야 합니다.

### 시드 계정

비밀번호는 전부 `devonly-Passw0rd!` 입니다. 개발 전용이며 운영에 사용하지 마십시오.

| 로그인 ID | 권한 |
|---|---|
| `sysadmin` | System Administrator |
| `frh.admin` | FRH Site Admin |
| `frh.staff` | FRH Staff |
| `frk.staff` | FRK Staff |
| `dual.user` | **겸직** — FRH Staff + FRK Site Admin |

`dual.user` 는 역할이 사용자가 아니라 사업장별 권한 부여에 붙는 이유를 보여주는 사례입니다.

## 주의

- **실고객 데이터를 로컬·스테이징에 복사하지 마십시오.** 개인정보를 개발 PC 에
  복사하는 순간 그 PC 가 규제 대상이 됩니다. 시드는 생성된 더미 데이터만 씁니다.
- `.env`, 자격증명, 고객 데이터 파일은 `.gitignore` 에 등록되어 있습니다.
- 이 저장소는 비공개입니다. 공개로 전환하지 마십시오.
