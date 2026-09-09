# 로컬 전용 데이터

내부 배포본의 `prices.json`, `templates.json`, `expected.json`을 이 폴더에 복사하세요.
현재 작업 PC의 원본은 `D:\FRANKONIA\FCT\fct-app\data`에 있습니다.
이 파일들은 실제 가격과 계산 템플릿을 포함하므로 Git에서 제외합니다.

DB 초기화: `npm run db:setup`
계산 검증: `npm run verify:engine`
