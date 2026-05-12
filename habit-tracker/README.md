# 오늘습관 / Habit Tracker

토스 인앱(Apps in Toss WebView)에서 매일 3초 만에 습관을 체크하는 미니앱입니다. 최신 버전은 서버 API와 SQLite 의존성을 제거하고, 정적 번들 + Apps in Toss Storage 기반으로 동작하도록 출시 준비 상태로 정리했습니다.

## 출시 기준 핵심 변경

- Apps in Toss SDK 연결: `@apps-in-toss/web-framework`
- 정적 export 빌드: `next.config.ts`의 `output: "export"`
- 앱인토스 업로드 설정: `granite.config.ts`
- 서버 API 제거: `/api/habit`, `/api/check/today` 제거
- SQLite 제거: `better-sqlite3`, `.data` 저장소 제거
- 클라이언트 저장소 전환: Toss WebView `Storage`, 일반 브라우저는 `localStorage` fallback
- 햅틱 피드백 적용: 추가/수정/체크/중단 액션
- 데이터 복구성 강화: 저장 데이터 파싱/정규화, 잘못된 값 방어

## 주요 기능

- 여러 습관 추가/수정/중단
- 오늘 완료 체크/취소
- 금융/건강/학습/생활 카테고리 자동 분류
- 주간 진행률, 연속 달성일, 총 완료 수
- 월간/연간 잔디 보기
- Toss Point 미션 컨셉 화면
- 토스 맥락의 금융 습관 추천

## 실행

```bash
npm install
npm run dev
```

브라우저 확인 주소:

```text
http://localhost:3000
```

## 검증/빌드

```bash
npm run lint
npm run build
npm run ait:build
```

`npm run ait:build` 성공 시 `appintoss-habit-tracker.ait`가 생성됩니다.

## 앱인토스 설정

`granite.config.ts` 기준값:

```ts
appName: "appintoss-habit-tracker"
brand.displayName: "오늘습관"
brand.primaryColor: "#3182F6"
outdir: "out"
```

콘솔 등록 후 실제 앱 이름이 다르면 `appName`을 맞춰야 합니다. 앱 아이콘 URL이 확정되면 `brand.icon`에 넣어주세요.

## 저장 방식

현재 기록은 서버로 전송하지 않고 기기 내 저장소에만 보관합니다.

- Toss/Sandbox: `Storage.getItem`, `Storage.setItem`
- 일반 브라우저 개발 환경: `window.localStorage`
- key: `appintoss:today-habit:v1`

## 출시 전 남은 외부 확인 항목

- Apps in Toss 콘솔의 실제 `appName` 확인
- 앱 아이콘 URL 확정 후 `brand.icon` 입력
- 실제 Toss Sandbox/콘솔 업로드 후 WebView 저장소와 햅틱 실기기 확인
- 포인트 미션은 아직 컨셉 문구이므로 실제 지급/프로모션으로 오해되지 않게 정책 확정 전 유지
