# mailmeilmheilmueil

공용 메일함으로 들어온 메일을 Firebase Cloud Firestore에 저장하고, OpenAI-compatible API로 홍보 관련 사실과 초안을 분석한 뒤 직원이 검토하는 프로토타입입니다.

## 운영 아키텍처

```text
공개 SMTP
    ↓
DigitalOcean의 수동 구성 메일 서버(Postfix + Dovecot 등)
    ↓ TLS 인증 IMAP
Heroku Scheduler의 `pnpm start:sync`
    ↓
Firebase Cloud Firestore
    ↓
OpenAI-compatible 분석 API
    ↓
Heroku 웹 dyno의 검토 SPA
```

MVP는 하나의 전용 메일함에 도착하는 모든 메일을 10분마다 가져옵니다. 사용자별 메일함과 사용자별 자격 증명 설정은 이후 기능이며, 현재 브라우저에서 메일 비밀번호를 입력받지 않습니다. 새 메일은 IMAP에서 가져온 뒤 Firestore에 저장되고 분석됩니다.

DigitalOcean은 메일 인프라를 한 번 수동으로 구성하는 경계입니다. SMTP 수신과 IMAP 메일함 저장은 이 Node 애플리케이션이 담당하지 않으며, GitHub Actions로 DigitalOcean 애플리케이션 코드를 배포하거나 재시작하지 않습니다. 애플리케이션은 Heroku가 유일한 배포 대상입니다.

## 요구 사항

- Node.js 22 이상
- pnpm
- Firebase Cloud Firestore 프로젝트 또는 Firebase Emulator
- Heroku 운영 환경의 OpenAI-compatible API 인증 정보
- 운영 환경의 공개 SMTP 및 TLS IMAP 메일 서버

## 로컬 실행

```bash
pnpm install
Copy-Item .env.example .env # PowerShell
pnpm dev
```

브라우저에서 Vite 개발 주소를 엽니다. Firestore를 사용하려면 `.env`에 Firebase Web App 설정과 서버용 Firebase Admin 인증 정보를 설정합니다. 서비스 계정 JSON과 `.env`는 저장소에 커밋하지 않습니다.

Firebase Emulator를 사용하는 경우 Java 21 이상이 필요합니다.

```bash
pnpm emulators
pnpm dev
```

스케줄러 작업을 로컬에서 실행하려면 `.env`에 `IMAP_HOST`, `IMAP_PORT`, `IMAP_SECURE`, `IMAP_ACCOUNT`, `IMAP_PASSWORD`를 설정한 뒤 다음 명령을 사용합니다. 이 명령은 한 번 실행하고 종료됩니다.

```bash
pnpm start:sync
```

## 명령어

```bash
pnpm dev                 # 클라이언트와 Hono 웹 서버 개발 실행
pnpm dev:client          # Vite 클라이언트만 실행
pnpm dev:server          # Hono 웹 서버만 실행
pnpm start:sync          # IMAP 한 회 동기화 및 AI 분석
pnpm test                # Vitest 테스트
pnpm lint                # 전체 oxlint 검사
pnpm build               # 운영용 프론트엔드 빌드
```

## DigitalOcean 메일 서버 일회성 구성

DigitalOcean VM에는 이 저장소와 별개로 표준 SMTP/IMAP 메일 서버를 구성합니다. 예를 들어 Postfix가 공개 SMTP로 메일을 받고, Dovecot이 같은 메일을 전용 mailbox에 저장하면서 IMAP으로 제공합니다.

운영자는 다음을 준비해야 합니다.

1. 전용 메일 도메인의 DNS와 MX 레코드를 메일 서버의 공개 IP 또는 DNS 이름으로 지정합니다.
2. SMTP 서버에 유효한 TLS 인증서를 설정하고, 외부 메일 서버가 직접 연결할 수 있도록 공개 SMTP를 제공합니다. HTTP 터널은 표준 SMTP 수신 경로가 아니므로 공개 SMTP 앞단에 Cloudflare Quick Tunnel을 사용하지 않습니다.
3. Heroku가 사용할 전용 mailbox와 IMAP 로그인 계정을 만들고, IMAP 서버에 신뢰할 수 있는 TLS를 설정합니다.
4. 방화벽은 필요한 SMTP 포트와 TLS IMAP 포트 993만 공개하고, 관리용 SSH는 허용된 운영자에게만 공개합니다. 메일 저장소, 데이터베이스, 내부 API 포트는 공개하지 않습니다.
5. 메일 서버의 비밀번호와 TLS 개인 키는 VM 외부로 복사하거나 저장소 및 채팅에 기록하지 않습니다.

Heroku Config Vars에는 다음 IMAP 값을 설정합니다.

```text
IMAP_HOST=<TLS IMAP 서버의 호스트 이름>
IMAP_PORT=993
IMAP_SECURE=true
IMAP_ACCOUNT=<전용 mailbox 계정>
IMAP_PASSWORD=<전용 mailbox 비밀번호>
```

실제 호스트 이름, IP 주소, 경로, 자격 증명은 이 저장소의 문서에 기록하지 않습니다.

## Heroku 운영 설정

Heroku 웹 dyno는 `pnpm start`로 실행합니다. Firestore Admin SDK에 필요한 서버 인증 정보, Firebase 브라우저 설정, 그리고 OpenAI-compatible 분석 API 설정은 Heroku Config Vars로만 제공합니다. 운영 분석에는 `AI_PROVIDER=openai`를 설정하고 `AI_MODEL`, `AI_BASE_URL`, `AI_API_KEY`를 함께 설정합니다. API 키와 서비스 계정 JSON의 내용은 소스 코드나 로그에 넣지 않습니다.

Heroku Scheduler를 한 번 생성하고 다음 작업을 10분 주기로 등록합니다.

```text
pnpm start:sync
```

이 작업은 별도의 one-off dyno에서 IMAP에 연결하고, 처리 완료를 기다린 뒤 `{ imported, duplicates, rejected }` JSON 한 줄을 출력하고 종료합니다. Scheduler 실행은 드물게 누락되거나 중복될 수 있습니다. Firestore의 IMAP UID 기반 idempotency와 IMAP `Seen` 플래그를 함께 사용하므로 중복 실행은 같은 메일을 새 문서로 만들지 않습니다.

## 운영 주의사항

- 브라우저 Firestore 읽기 규칙은 가상 데이터 프로토타입을 위해 공개되어 있습니다. 실제 메일을 저장하기 전에는 인증과 최소 권한 규칙으로 교체해야 합니다.
- SMTP/IMAP 메일 서버는 이 애플리케이션의 배포 산출물에 포함되지 않습니다. 메일 서버 변경은 운영자가 별도 절차로 수행합니다.
- 서비스 계정 JSON, `.env`, API 키, Codex 인증 파일, 개인 키와 토큰은 절대 공개 저장소에 넣지 않습니다.
- 현재 애플리케이션은 HTTPS 전용 브라우저 API를 사용하지 않으므로 직접 IP의 HTTP 배포에서도 동작합니다. Web Crypto `crypto.subtle`, Service Worker, Geolocation, WebAuthn, Push API 등을 추가하려면 먼저 HTTPS를 구성해야 합니다.
