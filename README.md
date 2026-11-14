# Aido

말하거나 적으면 AI가 할 일로 정리하고, 친구와 함께 끝까지 해내도록 돕는 AI 기반 소셜 할 일 관리 앱(아이두)이다. 이 저장소는 NestJS API 서버, Expo 모바일 앱, 둘이 함께 쓰는 REST 계약(`@aido/api`)을 하나의 pnpm + Turborepo 모노레포로 관리한다.

## 목차

- [해결하려는 문제](#해결하려는-문제)
- [주요 기능](#주요-기능)
- [기술 스택](#기술-스택)
- [아키텍처](#아키텍처)
- [설계에서 고민한 점](#설계에서-고민한-점)
- [모노레포 구조](#모노레포-구조)
- [시작하기](#시작하기)
- [테스트와 CI](#테스트와-ci)
- [문서](#문서)

## 해결하려는 문제

| 할 일 앱을 그만두게 되는 이유    | Aido의 답                                                                                                       |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 적는 일이 귀찮다                 | 음성·한 줄 문장·메모 한 장을 AI가 날짜·시간·반복이 붙은 할 일로 나눈다. 날짜 계산은 서버가 사용자 시간대로 한다 |
| 혼자라 미룬다                    | 친구 피드에서 서로의 할 일을 보고 응원하거나 콕 찌른다                                                          |
| 해외로 가면 알림 시각이 어긋난다 | 할 일 시각을 "그 지역의 오전 10시"로 저장해 어디서든 현지 오전 10시에 울린다                                    |
| 잘하고 있는지 모른다             | 일별 달성 캘린더·연속 달성·주간 성취와 주간·월간 AI 리포트, 반복 루틴 제안                                      |

## 주요 기능

- **AI로 할 일 만들기**: 말하거나 쓰면 할 일·날짜·시간·반복을 파싱한다. 메모 한 장을 여러 할 일로 나누고, 녹음 정리는 요약·핵심 포인트와 계획을 함께 만든다. 녹음 파일은 서버로 오지 않는다.
- **할 일 관리**: 카테고리, 세부 항목, 반복 할 일, 드래그 정렬, 공개·비공개. 인터넷이 끊겨도 마지막으로 본 할 일을 볼 수 있다.
- **리마인더**: 아침·저녁 리마인더와 시작 전 알림, 비·더위와 겹친 할 일을 옮길 시각을 함께 주는 날씨 브리핑.
- **친구와 함께**: 유저 태그로 친구 찾기, 친구 피드, 응원·찌르기, 할 일 댓글, 초대 링크·코드와 프리미엄 보상.
- **기록과 리포트**: 일별 달성률 캘린더, 연속 달성, 주간 성취, 주간·월간 AI 리포트와 반복 루틴 제안(프리미엄).
- **그 밖**: iOS·Android 홈 화면 위젯, 프리미엄 구독, 카카오·구글·네이버·Apple 로그인과 이메일 가입, 신고·차단, 문의, 한국어·영어.

## 기술 스택

정확한 버전은 [`pnpm-workspace.yaml`](./pnpm-workspace.yaml)의 catalog, 각 `package.json`, [`.nvmrc`](./.nvmrc)가 정본이다.

| 영역        | 기술                                                                                     | 고른 이유                                                                                   |
| ----------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 런타임      | Node.js 26.13.1 LTS (EAS 모바일 빌드는 24.22.3)                                          | 기본 탑재된 `Temporal`로 서버 날짜 계산을 통일한다                                          |
| API 서버    | NestJS 12.4.2 (ESM, SWC)                                                                 | slice 하나를 Module 하나로 두고 abstract class 포트를 그대로 DI 토큰으로 쓴다               |
| DB·ORM      | PostgreSQL 16, Drizzle ORM 1.0.0-rc.5, `@nestjs/drizzle`                                 | SQL에 가까운 쿼리와 행 타입 추론, `customType`으로 Temporal 칸을 둔다                       |
| 작업·이벤트 | pg-boss 12.38.1                                                                          | 브로커 없이 큐·크론·이벤트 전달을 업무 데이터와 같은 트랜잭션에 쓴다                        |
| 트랜잭션    | nestjs-cls 7, `@nestjs-cls/transactional`                                                | 트랜잭션을 인자로 넘기지 않고 요청 문맥으로 전파한다                                        |
| 공유 계약   | Zod 4.6.7 (`@aido/api`)                                                                  | 서버 검증·Swagger·앱 응답 파싱이 같은 schema를 쓴다                                         |
| 외부 호출   | `@nestjs/http-client`, cockatiel 4, `@nestjs/mail`                                       | 공식 HTTP·메일 모듈 위에 공급자별 회로·bulkhead·timeout을 한 정책으로 건다                  |
| AI          | AI SDK 7 (Anthropic·Google·OpenAI)                                                       | 공급자 순서를 설정으로 바꾸고 출력은 Zod 구조로만 받는다                                    |
| 다국어      | `@nestjs/i18n` 0.0.3                                                                     | 기준 언어 카탈로그에서 키 타입을 만들어 빠진 키를 컴파일 오류로 잡는다                      |
| 관측        | nestjs-pino 5.3.1, Sentry (`@sentry/nestjs` 11.11.0)                                     | 요청 ID 하나로 앱·서버 로그·Sentry를 잇고, 유료 APM 없이 무료 플랜 안에서 쓴다              |
| 모바일      | Expo SDK 58, React Native 0.88.1, React 19.3.0, Expo Router, TanStack Query 5            | iOS·Android·위젯을 한 코드베이스로, 서버 상태는 Query 캐시가 소유한다                       |
| 테스트      | Vitest 5.1.0 + Testcontainers 12.2.1 (서버), Jest 30.5.2 + jest-expo (모바일)            | SQL·트랜잭션 의미는 실제 PostgreSQL로 검증한다                                              |
| 품질 도구   | TypeScript 6.0.3, Oxlint 1.93.0, Oxfmt 0.78.0, dependency-cruiser, ls-lint, knip         | 구조 규칙을 리뷰 대신 도구로 막는다                                                         |
| 빌드·인프라 | pnpm 12.18.0, Turborepo 2.11.11, Changesets, Docker Compose, GitHub Actions, AWS EC2·RDS | 버전은 catalog 한 곳, 테스트 결과는 원격 캐시로 로컬과 CI가 공유한다. 인스턴스 하나·DB 하나 |

## 아키텍처

### 시스템 구성

```mermaid
flowchart LR
  App["모바일 앱<br/>Expo · React Native"]
  Contract[["@aido/api<br/>Zod 계약 · ErrorCode · vocabulary"]]
  subgraph API["apps/api · NestJS 모듈러 모놀리스 (15 Bounded Context)"]
    HTTP["presentation<br/>Controller · DTO 검증"]
    Core["application · domain<br/>UseCase · Aggregate · Port"]
    Adapters["infrastructure<br/>Drizzle 저장소 · 공급자 어댑터"]
    Worker["pg-boss worker<br/>큐 · 크론 · 이벤트 구독"]
  end
  PG[("PostgreSQL 16<br/>업무 데이터 + pg-boss 큐")]
  subgraph Vendors["외부 공급자 (Port 뒤 어댑터로만)"]
    Push["Expo Push"]
    AI["Anthropic · Google · OpenAI"]
    Mail["Resend"]
    Billing["RevenueCat"]
    Weather["KMA · WeatherKit"]
    Sentry["Sentry"]
  end
  App -- "HTTPS /v1" --> HTTP
  Contract -. 같은 schema .-> App
  Contract -. 같은 schema .-> HTTP
  HTTP --> Core
  Adapters -. Port 구현 .-> Core
  Adapters --> PG
  Worker --> PG
  Adapters --> Vendors
  Billing -- 웹훅 --> HTTP
  Push -- 푸시 --> App
```

판단·한도·집계·시각 계산은 서버가 하고 앱은 받은 값을 그린다. 앱이 같은 판단을 다시 하지 않도록 서버가 결과(날짜별 완료 수, 알림 목적지, 날씨 브리핑의 옮길 시각)를 응답에 싣는다.

### 서버·클라이언트 타입 공유

요청·응답 Zod schema와 오류 코드는 `@aido/api` 한 곳에서 정의한다. 서버는 같은 schema로 요청을 검증하고 Swagger를 만들며, 모바일은 같은 schema로 응답을 파싱하고 `z.infer` 타입을 쓴다. 언어 목록·상태 값처럼 함께 아는 값은 `@aido/api/vocabulary` 튜플 한 곳에서 선언하고 나머지는 유도한다.

### 요청 흐름: 레이어와 포트

```mermaid
sequenceDiagram
  participant C as Controller (presentation)
  participant U as UseCase (application)
  participant L as MutationLockPort
  participant D as Aggregate (domain)
  participant R as RepositoryPort
  participant DB as DrizzleRepository → PostgreSQL
  C->>C: 공유 Zod schema로 DTO 검증, 문자열 → Temporal·VO
  C->>U: execute(command)
  U->>U: UnitOfWorkPort.run (CLS 트랜잭션)
  U->>L: acquire(slice lock key)
  U->>R: findByIdAndUserId(id VO)
  R->>DB: SELECT (활성 트랜잭션)
  U->>D: changePinned(value, now)
  D-->>U: true면 바뀜, false면 저장 생략
  U->>R: save(aggregate)
  U-->>C: Entity 또는 Read Model
  C->>C: 응답 매퍼가 계약 DTO·문구·ISO 문자열을 만든다
```

- `modules/<context>/<slice>/{domain,application,infrastructure,presentation}`. slice 하나가 Nest Module 하나이자 Aggregate Root 하나다. 기준 구현은 [notes/memos](./apps/api/src/modules/notes/memos)다.
- Domain·Application은 Nest·ORM·SDK·HTTP 계약을 모른다. 다른 Context는 `<context>-<slice>.public.ts`로만 부르고 그 Context 테이블을 직접 읽지 않는다.
- 포트는 abstract class이자 DI 토큰이다. `provideUseCase`가 조립하고 의존성 키 누락·토큰 타입 불일치는 컴파일 오류다.

| Context                           | slice                                                                                                              |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| identity · access · billing       | `auth`·`users`·`preferences` · `entitlements`·`quotas` · `subscriptions`·`premium-grants`                          |
| planning · notes · engagement     | `todos`·`todo-series`·`categories` · `memos` · `comments`                                                          |
| social                            | `friends`·`blocks`·`cheers`·`nudges`·`invites`·`reports`                                                           |
| notification · insights           | `inbox`·`push`·`email`·`reminders`·`retention` · `daily-completions`·`weekly-achievements`                         |
| ai-assistance · voice · weather   | `generation`·`parsing`·`planning`·`reports`·`suggestions` · `voice-notes`·`action-plans` · `forecasts`·`locations` |
| operations · app-config · support | `broadcasts`·`admin-notices`·`metrics` · `app-versions`·`feature-discovery` · `inquiries`                          |

### 트랜잭션 안 작업 enqueue와 도메인 이벤트

```mermaid
sequenceDiagram
  participant U as UseCase
  participant Q as JobQueuePort (pg-boss)
  participant P as DomainEventPublisherPort
  participant DB as PostgreSQL
  participant W as pg-boss worker
  participant M as in-process (커밋 뒤)
  U->>DB: BEGIN, 잠금, 도메인 행동, save
  U->>Q: enqueue(같은 Context 후속 작업, idempotencyKey)
  U->>P: publish(events)
  P->>Q: durable 구독마다 enqueue (key = eventId:구독 이름)
  U->>DB: COMMIT (업무 행 + 작업 행이 함께)
  P-->>M: after-commit 구독 → 캐시 정리만 (실패해도 TTL)
  W->>DB: SKIP LOCKED로 작업 가져오기, payload Zod parse
  W->>W: 멱등 handler, 재시도 소진 시 DLQ + 경보
```

### 권한·한도 판단

```mermaid
flowchart TD
  Req["AI 할 일 만들기 요청"] --> Pre{"@RequireQuota 선검사<br/>남은 횟수 0?"}
  Pre -- 예 --> Deny["기존 ErrorCode<br/>details: charged false, featureQuota"]
  Pre -- 아니오 --> Lock["UoW + 사용자 잠금"]
  Lock --> Tier["주체 tier: FREE · PREMIUM · ADMIN<br/>(스토어 구독·보상 기간·역할)"]
  Tier --> Plan["요금제 plan: free · premium<br/>ADMIN → premium"]
  Plan --> Limit["PLAN_CATALOG 값 + 받은 자리(grant)<br/>공정 사용 상한으로 집행 한도"]
  Limit --> Reserve{"QuotaLedger.reserve"}
  Reserve -- 한도 초과 --> Deny
  Reserve -- 예약 --> Call["AI 공급자 체인 (트랜잭션 밖)"]
  Call -- 결과 있음 --> Commit["commit"]
  Call -- 실패·빈 결과 --> Refund["refund, charged false"]
```

### 관측과 경보

```mermaid
flowchart LR
  Code["UseCase · 어댑터 · worker"] --> Log["ApplicationLoggerPort<br/>&lt;context&gt;.&lt;subject&gt;.&lt;outcome&gt;"]
  Code --> Alert["OperationalAlertPort<br/>slice 경보 카탈로그 · key별 dedup"]
  Filter["GlobalExceptionFilter (5xx)"] --> Rep["ExceptionReporterPort"]
  Log --> Pino["pino (민감값 제외)"]
  Alert --> Env{"배포 환경"}
  Rep --> Env
  Env -- "운영 + DSN" --> Sentry["Sentry 이슈 → 알림 규칙 → Discord·메일"]
  Env -- "개발·staging·test" --> Pino
  Jobs["재시도 소진 · 스케줄 감시 · heartbeat 1개"] --> Alert
```

### Stack PR 릴리스

```mermaid
flowchart LR
  subgraph Stack["gh stack · stack:&lt;release&gt; 라벨"]
    P1["PR 01 → main"] --> P2["PR 02"] --> P3["…"] --> Tip["tip PR"]
  end
  P1 --> PRCI["PR CI<br/>맨 아래 PR diff"]
  Tip --> Push["로컬 pre-push<br/>누적 tree · typecheck · unit · integration · contract · build"]
  Stack --> Merge["gh stack merge 한 번 → main"]
  Push -- Turbo 원격 캐시 --> MainCI
  Merge --> MainCI["main CI<br/>lint · 캐시 재사용 테스트 · build"]
  MainCI --> Image["ARM64 이미지 · Trivy · GHCR"]
  Image --> Deploy["migrate → 새 슬롯 기동 → Nginx 전환"]
```

위층 PR은 CI를 돌리지 않는다. tip의 pre-push가 누적 tree를 검증하고, 합친 뒤 main CI가 배포 전에 한 번 더 확인한다. 각 PR은 혼자 빌드·테스트를 통과하도록 나눈다.

## 설계에서 고민한 점

| 문제                                                                                                    | 고려한 선택지                                                                                               | 고른 것                                                                                                                                                                     | 감수한 것                                                                                                         |
| ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 15개 Context가 같은 역할을 다른 폴더·이름으로 표현해 사람도 AI 에이전트도 "어디에 무엇을" 매번 추측했다 | 레이어 우선 폴더 유지, 기능(slice) 우선                                                                     | **slice 우선**: `<context>/<slice>/{domain,…}`, slice = Module = Aggregate Root, 이름 사전 한 벌과 생성기                                                                   | 파일이 많이 옮겨졌다. 기준 구현(notes)을 먼저 맞추고 나머지는 같은 모양인지만 보게 했다                           |
| Symbol 토큰 + interface 짝은 inject 순서·토큰 타입이 어긋나도 컴파일러가 못 잡았다                      | Symbol 유지, interface + token, abstract class                                                              | **abstract class를 포트이자 DI 토큰**으로, `provideUseCase`가 키·타입을 검사                                                                                                | 포트가 런타임 import가 되어 순환이 부팅 실패로 드러난다. depcruise와 부팅 E2E로 막는다                            |
| 커밋 직후 프로세스가 죽으면 메모리 이벤트로 바꾸던 상태(리마인더 예약·초대 활동)가 사라졌다             | EventEmitter 유지, Kafka/SQS 브로커, `@nestjs/outbox`, pg-boss 내장 pub/sub                                 | **pg-boss를 트랜잭셔널 아웃박스로**: 구독자별 작업을 같은 트랜잭션에 enqueue, 커밋 뒤 in-process는 캐시 정리만                                                              | 처리량이 PostgreSQL에 묶인다. 포트 뒤라 나중에 아웃박스 릴레이 + 브로커로 어댑터만 바꾼다                         |
| 날짜 계산이 dayjs 래퍼와 "UTC 자정 Date" 칸에 흩어져 하루 어긋남이 생기기 쉬웠다                        | dayjs 유지, date-fns-tz, Temporal                                                                           | **Node 26 LTS의 Temporal**, `ClockPort` 하나, `instant`·`plainDate` customType, 할 일은 떠 있는 시각                                                                        | 런타임을 올렸다(모바일 EAS는 그대로). 직렬화가 `Date#toISOString`과 바이트 단위로 같은지 테스트한다               |
| 배포 중 놓친 크론과 "정확히 그 분"만 보는 리마인더 sweep이 알림을 잃었다                                | 무중단 배포 먼저, 크론 주기 단축                                                                            | 스케줄마다 **`missed` 정책 필수**, sweep은 **워터마크로 놓친 분(최대 15분)까지 따라잡기**, 15분 넘게 늦으면 사유와 함께 건너뜀                                              | 블루그린이 없어 배포 중 잠깐 늦는다. 유실 대신 지연을 택했다                                                      |
| 스토어에 남은 옛 앱 버전이 바뀐 응답에 깨질 수 있다                                                     | `/v2`로 자주 올리기, 강제 업데이트                                                                          | **외부 계약은 추가만**: released OpenAPI 지문을 fixture로 고정하고 `test:contract`가 비교, 운영 밖에서는 응답을 선언 schema로 대조                                          | 쓰지 않는 응답 필드(`message`·라벨)도 출시 계약이라 남는다. 새 응답에는 넣지 않는다                               |
| ADMIN만 무제한이라 판단 경로가 둘이고 관리자 화면이 실제 사용자 경험과 달랐다                           | ADMIN 예외 유지, 역할별 표                                                                                  | **주체(tier)와 요금제(plan)를 나누고 ADMIN은 premium 값**을 받는다. 판단은 access 도메인 서비스 한 곳                                                                       | 관리자도 프리미엄 한도에 걸린다(의도). 표시용 tier는 `ADMIN`으로 남겨 출시 앱 표시는 그대로다                     |
| 유료 APM 없이 장애를 알아야 하고 개발에서는 경보가 어디에도 안 보였다                                   | 상용 APM, 모든 곳에 Sentry                                                                                  | **환경별 어댑터**(운영 Sentry, 그 밖 pino), slice 경보 카탈로그 + key dedup, `tracesSampler`, heartbeat 하나로 **무료 플랜 안에서**                                         | 큐마다 monitor를 두지 않는다. 스케줄 감시 작업이 대신 예정 지남·연속 실패·DLQ 증가를 본다                         |
| mock 위주 테스트가 구현을 복사하고 SQL 의미를 증명하지 못했다                                           | mock 라이브러리, 커버리지 목표                                                                              | 행동 하나를 **가장 싼 층에서 한 번**: InMemory·Fake 더블, 같은 **포트 계약 suite를 InMemory와 Drizzle이 함께**, 실제 PostgreSQL(Testcontainers)                             | 통합 테스트가 Docker를 요구한다. Non-Durable PG·worker env·`retry` 금지·seed 재현으로 flake를 원인에서 막는다     |
| 문서로만 둔 규칙은 사람·에이전트가 쉽게 어긴다                                                          | 리뷰 체크리스트                                                                                             | **가드레일을 코드로**: oxlint 레이어 import·관례 규칙(aido 플러그인), dependency-cruiser 경계·순환, ls-lint 접미사, knip 미사용 코드, slice 생성기, 편집 직후 에이전트 hook | 도구 설정이 늘었다. 규칙은 문서 한 곳에 쓰고 도구가 같은 목록을 본다                                              |
| 릴리스 하나에 PR이 많아 PR마다 CI를 돌리면 비용·대기가 크다                                             | PR별 CI, 큰 PR 하나, tip PR이 누적 diff를 검증하고 main이 같은 tree 증거를 재사용(직접 만든 정책·증명 코드) | **Stack PR은 main을 향한 맨 아래만 CI**, 누적 tree는 pre-push가 **Turbo 원격 캐시**와 함께 검증하고 `gh stack merge` 뒤 main CI가 배포 전에 다시 본다                       | 위층 PR은 CI 녹색 표시가 없고 깨끗한 러너의 누적 검증이 합친 뒤로 밀린다. main CI가 실패하면 이미지·배포가 멈춘다 |
| LLM에 날짜를 맡기면 시간대·요일 계산이 틀리고 공급자 장애·비용이 그대로 사용자에게 간다                 | 단일 공급자, 모델이 날짜 계산                                                                               | 모델은 **일정 표현만** 내고 서버 순수 함수가 날짜를 계산, **공급자 체인 + 회로 + 예산·킬 스위치**, 출력은 Zod 구조만                                                        | 프롬프트·평가 관리가 늘었다. golden과 유료 live eval(수동)로 바꿀 때만 확인한다                                   |

## 모노레포 구조

```text
.
├── apps/
│   ├── api/                # @aido/server — NestJS REST API
│   │   ├── src/modules/    #   Bounded Context와 slice
│   │   ├── src/platform/   #   DB·job·event·HTTP·cache·logging 등 실행 기술
│   │   ├── src/shared/     #   도메인 베이스 클래스·공용 Port·시간
│   │   ├── drizzle/        #   SQL 마이그레이션
│   │   ├── test/           #   fixtures·doubles·contracts·integration·e2e·performance
│   │   └── docs/           #   서버 설계·규칙 문서
│   └── mobile/             # @aido/mobile — Expo 앱 (src/features/<area>/<feature>)
├── packages/api/           # @aido/api — 공유 REST 계약·오류 코드·vocabulary
├── tooling/                # database-migrate CLI · typescript · vitest 프리셋
├── turbo/generators/       # 서버 slice 생성기
├── docs/conventions/       # 앱·서버 공통 규칙 (오류·날짜·호환·null·테스트·문서·Git)
├── docs/releases/          # 현재 릴리스 기록
└── scripts/                # CI 정책·문서 검사·배포·에이전트 hook
```

## 시작하기

- Node.js `26.13.1` LTS([`.nvmrc`](./.nvmrc)), pnpm `12.18.0`(`packageManager`, `npm i -g corepack && corepack enable`), Docker 호환 런타임(로컬 DB와 Testcontainers).

```sh
pnpm install                                   # postinstall이 packages/*를 빌드한다
pnpm docker:up                                 # PostgreSQL 16(5433)
cp apps/api/.env.example apps/api/.env.development
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/aido pnpm db:migrate
pnpm dev                                       # API + Expo Metro
```

- API는 `http://localhost:8080`, Swagger UI는 `http://localhost:8080/api/docs`(로컬 `pnpm dev` 실행에서만)다. 서버만은 `pnpm --filter @aido/server dev`.
- env 파일은 앱마다 `.env`(운영) · `.env.development`(개발) · `.env.example`(예시)이고 도커도 같은 파일을 읽는다. API까지 Docker로 띄우려면 `pnpm docker:dev:up`(DB → migrate → API)을 쓴다. 모바일 실행은 [apps/mobile/README.md](./apps/mobile/README.md)를 따른다.

| 명령어                                                  | 설명                                                                       |
| ------------------------------------------------------- | -------------------------------------------------------------------------- |
| `pnpm check`                                            | lint(관례 포함) → format:check → docs:check → 이름·경계·미사용 → typecheck |
| `pnpm gen:api-slice`                                    | 규칙대로 새 서버 slice 뼈대 생성                                           |
| `pnpm test` · `pnpm test:integration` · `pnpm test:e2e` | unit · 실제 PostgreSQL 통합 · HTTP E2E                                     |
| `pnpm test:contract`                                    | 출시 앱 OpenAPI 계약 테스트                                                |
| `pnpm check:unused`                                     | 모바일 밖 workspace의 안 쓰는 파일·export·의존성(knip)                     |
| `pnpm db:generate` · `pnpm db:migrate`                  | Drizzle 마이그레이션 생성 · 적용                                           |
| `pnpm changeset` · `pnpm commit`                        | 변경 기록 · Conventional Commit 작성기                                     |

## 테스트와 CI

| 층          | 위치                                                | 검증 대상                                                   |
| ----------- | --------------------------------------------------- | ----------------------------------------------------------- |
| unit        | `apps/api/src/**/*.spec.ts`, `packages/api`, 모바일 | Entity·VO 불변식, UseCase 분기(InMemory 포트), 외부 wire    |
| integration | `apps/api/test/integration`                         | 실제 PostgreSQL의 트랜잭션·잠금·동시성·마이그레이션·pg-boss |
| e2e         | `apps/api/test/e2e`                                 | HTTP 검증·권한·응답 모양, OpenAPI 지문과 released fixture   |

- 실행마다 `aido_test_<run-id>` DB에 마이그레이션을 한 번 적용하고 worker별로 나눈다. 순서를 섞어 순서 의존을 드러내고, 여러 러너가 함께 돌면 `AIDO_TEST_WORKERS`·`AIDO_TEST_DB_WORKERS`로 줄인다.
- 푸시·메일·AI·날씨는 Fake나 고정 원문으로 격리한다. 유료 AI 평가(`ai:eval`)와 `test:performance`는 CI 밖이다.
- lefthook: pre-commit은 staged 파일 lint·format·이름 검사와 문서 검사(`pnpm docs:check`), pre-push는 `turbo run typecheck test build` → 통합 → 계약(결과는 원격 캐시로), 전체 E2E는 직접 실행해 PR에 적는다.
- CI(main을 향한 PR·main push)는 lint·typecheck·build와 함께 단위·통합·계약 테스트를 같은 원격 캐시로 다시 확인하고, 캐시에 없는 작업만 러너에서 한 번에 하나씩 돈다.
- `main`은 같은 run의 검증이 성공하면 ARM64 이미지를 만들고 Trivy 검사 뒤 GHCR에 올린다. 배포는 Blue-Green이다. migrate가 끝난 뒤 새 API를 쉬는 슬롯에 띄우고 healthy가 되면 Nginx를 넘긴다. 실패하면 살아 있는 API를 건드리지 않고 끝난다.

## 문서

| 주제                | 문서                                                                                                                                                                                                                                                  |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 작업 진입점         | [AGENTS.md](./AGENTS.md), [apps/api/AGENTS.md](./apps/api/AGENTS.md), [apps/mobile/AGENTS.md](./apps/mobile/AGENTS.md)                                                                                                                                |
| 새 서버 기능        | [새 기능 추가](./apps/api/docs/new-feature.md), [서버 문서 안내](./apps/api/docs/README.md)                                                                                                                                                           |
| 서버 구조·모델·이름 | [아키텍처](./apps/api/docs/architecture.md), [도메인 모델](./apps/api/docs/domain-modeling.md), [이름 사전](./apps/api/docs/conventions.md)                                                                                                           |
| 계약·DB·작업        | [HTTP 계약](./apps/api/docs/http-contracts.md), [영속성](./apps/api/docs/persistence.md), [작업과 이벤트](./apps/api/docs/jobs-and-events.md), [공유 계약 패키지](./packages/api/README.md)                                                           |
| 권한·설정·관측      | [유료 기능과 권한](./apps/api/docs/entitlements.md), [설정](./apps/api/docs/configuration.md), [관측](./apps/api/docs/observability.md), [보안](./apps/api/docs/security.md), [테스트](./apps/api/docs/testing.md)                                    |
| 공통 규칙           | [오류](./docs/conventions/errors.md), [날짜·시간](./docs/conventions/dates.md), [하위 호환](./docs/conventions/compatibility.md), [null 비교](./docs/conventions/nullish.md), [문서](./docs/conventions/docs.md), [Git·PR](./docs/conventions/git.md) |
| 모바일              | [apps/mobile/README.md](./apps/mobile/README.md), [아키텍처](./apps/mobile/docs/architecture/structure.md), [UI](./apps/mobile/docs/architecture/ui.md)                                                                                               |
| CI·배포             | [CI](./apps/api/docs/ci.md), [서버 배포](./apps/api/docs/deployment.md), [모바일 배포](./apps/mobile/docs/build-and-release.md)                                                                                                                       |

## 라이선스

[MIT](./LICENSE)
