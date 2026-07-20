# mailmeilmheilmueil

가상의 공용 메일을 수신하고, Firebase Cloud Firestore에 저장한 뒤, Codex CLI를 통해 홍보용 사실을 추출하여 직원이 검토하는 프로토타입입니다.

## 구성

```text
로컬 SMTP 테스트 메일
        ↓
Node.js + Hono
        ↓
Firebase Cloud Firestore
        ↓
Codex CLI (gpt-5.4-mini)
        ↓
React/Preact 검토 화면
```

현재 범위에는 인증, 실제 조직 메일함 연동, 첨부파일 처리, 자동 발송, 자동 승인 기능이 포함되지 않습니다.

## 요구 사항

- Node.js 22 이상
- pnpm
- Cloud Firestore 프로젝트 또는 Firebase Emulator
- AI 분석을 실행할 때 인증된 Codex CLI 또는 지원되는 API 인증

## 로컬 실행

```bash
pnpm install
Copy-Item .env.example .env # PowerShell
pnpm dev
```

브라우저에서 `http://127.0.0.1:5173`을 열고, 별도 터미널에서 샘플 메일을 보냅니다.

```bash
pnpm demo:send-sample
```

Cloud Firestore를 사용하는 경우 `.env`에 Firebase Web App 설정과 서버용 `GOOGLE_APPLICATION_CREDENTIALS` 경로를 넣습니다. 서비스 계정 JSON과 `.env`는 저장소에 커밋하지 않습니다.

Emulator를 사용하는 경우 Java 21 이상이 필요합니다.

```bash
pnpm emulators
pnpm dev
```

## 명령어

```bash
pnpm dev                 # 클라이언트와 서버 개발 실행
pnpm dev:client         # Vite 클라이언트만 실행
pnpm dev:server         # Hono API와 로컬 SMTP만 실행
pnpm demo:send-sample   # 결정적인 샘플 메일 전송
pnpm test                # Vitest 테스트
pnpm lint                # oxlint
pnpm build               # 운영용 프론트엔드 빌드
```

## 운영 주의사항

- 현재 SMTP 서버는 테스트용으로 `127.0.0.1:2525`에만 바인딩되며 외부 메일 수신용이 아닙니다.
- 브라우저 Firestore 읽기 규칙은 가상 데이터 프로토타입을 위해 공개되어 있습니다. 실제 메일을 저장하기 전에는 인증과 최소 권한 규칙으로 교체해야 합니다.
- 서비스 계정 JSON, `.env`, Codex 인증 파일은 절대 공개 저장소에 넣지 않습니다.
- 현재 애플리케이션은 HTTPS 전용 브라우저 API를 사용하지 않으므로 직접 IP의 HTTP 배포에서도 동작합니다. Web Crypto `crypto.subtle`, Service Worker, Geolocation, WebAuthn, Push API 등을 추가하려면 먼저 HTTPS를 구성해야 합니다.
- `AGENTS.md`에 현재 VM 배포와 방화벽 운영 절차를 기록했습니다.
