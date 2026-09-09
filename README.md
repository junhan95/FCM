# Frankonia tools

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
