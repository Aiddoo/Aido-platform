# Aido

말하거나 적으면 AI가 할 일로 정리하고, 친구와 함께 끝까지 해내도록 돕는 AI 기반 소셜 할 일 관리 앱(아이두)이다. 이 저장소는 NestJS API 서버, Expo 모바일 앱, 둘이 함께 쓰는 REST 계약(`@aido/api`)을 하나의 pnpm + Turborepo 모노레포로 관리한다.

![Aido 서비스 구성](docs/architecture/system.webp)

그림은 세 줄로 읽는다. 화살표는 부르는 쪽에서 불리는 쪽으로 가고, 점선은 기기로 가는 푸시다.

- **가운데**: 요청이 지나는 길이다. API는 업무 변경과 뒤따르는 작업(푸시·리마인더·메일·AI 리포트)을 PostgreSQL 한 트랜잭션에 함께 적고, pg-boss worker가 그 작업을 꺼내 처리한다. 느린 외부 발송은 요청 밖에서 한다.
- **위**: 앱에서 바로 쓰는 서비스다. 결제·로그인·초대의 결과는 서버가 다시 확인하고, 앱이 보낸 값을 그대로 믿지 않는다.
- **아래**: 서버만 부르는 서비스다. 모두 Port 뒤 어댑터이고 공급자마다 timeout·회로·동시 호출 한도를 따로 둔다.

서비스마다 이렇게 붙인 이유는 [외부 서비스](#외부-서비스)에, 운영 구성과 배포 방식은 [운영 인프라](#운영-인프라)에 있다.

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

| 영역        | 기술                                                                             | 고른 이유                                                                                   |
| ----------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 런타임      | Node.js 26.13.1 LTS (EAS 모바일 빌드는 24.22.3)                                  | 기본 탑재된 `Temporal`로 서버 날짜 계산을 통일한다                                          |
| API 서버    | NestJS 12.4.2 (ESM, SWC)                                                         | slice 하나를 Module 하나로 두고 abstract class 포트를 그대로 DI 토큰으로 쓴다               |
| DB·ORM      | PostgreSQL 16, Drizzle ORM 1.0.0-rc.5, `@nestjs/drizzle`                         | SQL에 가까운 쿼리와 행 타입 추론, `customType`으로 Temporal 칸을 둔다                       |
| 작업·이벤트 | pg-boss 12.38.1                                                                  | 브로커 없이 큐·크론·이벤트 전달을 업무 데이터와 같은 트랜잭션에 쓴다                        |
| 트랜잭션    | nestjs-cls 7, `@nestjs-cls/transactional`                                        | 트랜잭션을 인자로 넘기지 않고 요청 문맥으로 전파한다                                        |
| 공유 계약   | Zod 4.6.7 (`@aido/api`)                                                          | 서버 검증·Swagger·앱 응답 파싱이 같은 schema를 쓴다                                         |
| 외부 호출   | `@nestjs/http-client`, cockatiel 4, `@nestjs/mail`                               | 공식 HTTP·메일 모듈 위에 공급자별 회로·bulkhead·timeout을 한 정책으로 건다                  |
| AI          | AI SDK 7 (Anthropic·Google·OpenAI)                                               | 공급자 순서를 설정으로 바꾸고 출력은 Zod 구조로만 받는다                                    |
| 다국어      | `@nestjs/i18n` 0.0.3                                                             | 기준 언어 카탈로그에서 키 타입을 만들어 빠진 키를 컴파일 오류로 잡는다                      |
| 관측        | nestjs-pino 5.3.1, Sentry (`@sentry/nestjs` 11.11.0)                             | 요청 ID 하나로 앱·서버 로그·Sentry를 잇고, 유료 APM 없이 무료 플랜 안에서 쓴다              |
| 모바일      | Expo SDK 58, React Native 0.88.1, React 19.3.0, Expo Router, TanStack Query 5    | iOS·Android·위젯을 한 코드베이스로, 서버 상태는 Query 캐시가 소유한다                       |
| 테스트      | Vitest 5.1.0 + Testcontainers 12.2.1 (서버), Jest 30.5.2 + jest-expo (모바일)    | SQL·트랜잭션 의미는 실제 PostgreSQL로 검증한다                                              |
| 품질 도구   | TypeScript 6.0.3, Oxlint 1.93.0, Oxfmt 0.78.0, dependency-cruiser, ls-lint, knip | 구조 규칙을 리뷰 대신 도구로 막는다                                                         |
| 빌드·인프라 | pnpm 12.18.0, Turborepo 2.11.11, Docker Compose, GitHub Actions, AWS EC2·RDS     | 버전은 catalog 한 곳, 테스트 결과는 원격 캐시로 로컬과 CI가 공유한다. 인스턴스 하나·DB 하나 |

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
    Weather["WeatherKit · 에어코리아"]
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

### 외부 서비스

| 서비스                   | 맡긴 일                        | 붙인 방식과 이유                                                                                                                                                                                                        |
| ------------------------ | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| pg-boss (PostgreSQL)     | 뒤따르는 작업과 정기 작업      | 브로커를 따로 두지 않고 업무 데이터와 같은 DB에 둔다. 저장과 작업 등록이 한 트랜잭션이라 "저장은 됐는데 알림은 안 나감"이 없고, 프로세스가 죽거나 배포로 내려가도 작업이 남는다                                         |
| Expo Push                | iOS·Android 푸시               | 요청 안에서 보내지 않는다. 요청은 발송 기록만 남기고 worker가 100건씩 묶어 보낸다. 5분마다 영수증을 확인해 죽은 토큰을 끄고, 전송 실패는 재시도 뒤 DLQ로 보낸다. 사용자별 알림 빈도 한도와 방해 금지 시간은 서버가 본다 |
| RevenueCat               | App Store·Google Play 구독     | 앱은 SDK로 결제하고 프리미엄 여부는 서버에 묻는다. 서버는 웹훅을 이벤트 ID 원장에 적어 한 번만 반영하고, 웹훅만 믿지 않고 worker가 RevenueCat에서 상태를 다시 읽어 맞춘다                                               |
| 카카오톡 공유            | 친구 초대                      | 초대 코드와 링크는 서버가 만든다. 카카오톡이 안 되면 OS 공유, 그것도 안 되면 링크 복사로 넘어간다. 수락은 한 사람에 한 번이고 보상은 기기·신원 해시로 한 번만 준다                                                      |
| 카카오·네이버·구글·Apple | 로그인                         | 카카오·네이버·구글은 서버가 인가 code를 교환해 앱이 공급자 토큰을 다루지 않는다. Apple은 기기에서 받은 토큰의 서명과 nonce를 서버가 검증한다                                                                            |
| Anthropic·Google·OpenAI  | 할 일 파싱, 녹음 정리, 리포트  | 공급자 순서를 설정으로 정하고 실패하면 다음 공급자로 넘어간다. 화면에서 기다리는 호출과 배경 작업의 자리를 나누고, 공급자별 회로와 일·월·사용자별 지출 한도, 끄는 스위치를 둔다                                         |
| WeatherKit·에어코리아    | 날씨 브리핑                    | 위치를 약 5km 칸으로 묶어 캐시해 호출을 줄인다. 공급자가 실패하면 마지막으로 성공한 데이터로 대신한다. 한국에서는 대기질을 더한다                                                                                       |
| Resend                   | 인증 코드·비밀번호 재설정 메일 | 큐로 보내고 재시도한다. 큐에 적는 본문은 암호화한다                                                                                                                                                                     |
| Sentry·Discord           | 오류·경보, 운영 소식           | 경보는 Sentry 한 곳으로 모으고 worker 생존 신호도 보낸다. 가입·구독 소식은 큐를 거쳐 Discord로 보낸다. 업무 코드는 둘을 직접 부르지 않는다                                                                              |
| EAS Update               | 스토어 심사 없는 JS 수정       | 네이티브 구성이 같은 빌드만 받도록 runtimeVersion을 fingerprint로 둔다                                                                                                                                                  |

기기 안에서 끝나는 것도 있다. 음성은 OS 인식기가 글자로 바꿔 서버에는 글자만 오고, 홈 화면 위젯은 앱이 저장해 둔 값만 읽어 네트워크와 토큰에 닿지 않는다.

친구 초대는 앱·카카오톡·랜딩·서버가 함께 도는 흐름이다.

```mermaid
sequenceDiagram
  participant A as 초대한 사람의 앱
  participant S as 서버
  participant K as 카카오톡
  participant L as 랜딩 aido.kr
  participant B as 초대받은 사람의 앱
  A->>S: 내 초대 링크 요청
  S-->>A: aido.kr/i/코드 (코드는 서버가 만든다)
  A->>K: 카카오톡으로 공유 (안 되면 OS 공유 · 링크 복사)
  K-->>B: 링크를 누른다
  alt 앱이 깔려 있다
    Note over B: 유니버설 링크 · App Links로 앱이 바로 열린다
  else 앱이 없다
    B->>L: 랜딩이 초대를 보여 준다
    Note over B: 설치한 뒤 Android는 설치 정보로 코드를 이어받고 iOS는 코드를 입력한다
  end
  B->>S: 로그인 뒤 초대 수락
  Note over S: 한 트랜잭션에서 친구 맺기 + 프리미엄 지급<br/>한 사람은 한 번만, 보상은 기기·신원 해시로 한 번만
  S-->>B: 새로 가입한 사람이면 프리미엄 7일
  S-->>A: 초대받은 사람이 실제로 쓰면 보상 (worker가 지급)
```

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

### 운영 인프라

![운영 인프라와 보안 경계](docs/architecture/infra.webp)

서버 한 대와 DB 하나다. 밖에서 닿는 문은 Nginx뿐이고 나머지는 서버 안이나 보안 그룹 안에서만 열린다.

| 포트        | 누가 닿는가            | 막는 장치                                                                              |
| ----------- | ---------------------- | -------------------------------------------------------------------------------------- |
| 443 · 80    | 누구나                 | Nginx가 TLS를 끝낸다. 다른 Host·SNI로 온 요청은 끊고 80은 443으로 돌린다               |
| 22          | 배포 workflow와 운영자 | 키 전용 SSH. workflow는 서버 host key를 고정해 다른 서버에 붙지 않는다                 |
| 8080 · 8081 | 서버 안의 Nginx        | `127.0.0.1`에만 연다. 컨테이너는 비루트·읽기 전용 루트·capability 제거로 돈다          |
| 5432        | API 컨테이너           | RDS 보안 그룹이 서버의 보안 그룹만 받는다. 공인 접근을 끄고 TLS와 저장소 암호화를 쓴다 |

- 이미지는 GitHub Actions가 만들어 Trivy 검사를 통과한 것만 GHCR에 올리고, 서버는 pull만 한다.
- 운영 값은 서버의 env 파일 하나에만 있고 저장소·이미지·로그에 넣지 않는다.
- OS 보안 패치와 인증서 갱신은 서버가 스스로 한다. DB는 RDS 자동 백업과 매일의 S3 덤프 두 벌이다.
- Nginx·호스트·compose 설정의 정본은 저장소에 있다([서버 배포](apps/api/docs/deployment.md#서버-설정과-관리)).

### 무중단 배포 (Blue-Green)

<img src="docs/architecture/blue-green.webp" alt="Blue-Green 배포" width="440" />

API 컨테이너 자리가 둘이다(blue `8080`, green `8081`). 새 버전을 쉬는 슬롯에 띄워 준비된 것을 확인한 뒤에 Nginx가 가리키는 슬롯을 바꾼다.

```mermaid
sequenceDiagram
  participant CI as GitHub Actions
  participant S as 배포 스크립트
  participant N as Nginx
  participant B as blue (옛 버전)
  participant G as green (새 버전)
  participant DB as PostgreSQL
  CI->>S: 검증·이미지 발행 뒤 그 SHA로 배포
  S->>DB: ① migrate (옛 코드와 호환되는 변경만)
  S->>G: ② 쉬는 슬롯에 기동
  G-->>S: ③ healthy
  Note over N,B: 여기까지 blue가 모든 요청에 응답한다
  S->>N: ④ upstream을 green으로 쓰고 reload
  N-->>S: 옛 worker가 받던 요청을 끝내고 빠진다
  S->>B: ⑤ 종료 신호
  B-->>S: ⑥ 하던 작업을 끝내고 종료
  Note over S,G: ③에서 실패하면 green만 지운다. ④에서 실패하면 upstream을 blue로 되돌린다
```

- **실패해도 살아 있는 슬롯이 계속 응답한다.** 새 컨테이너가 준비되지 않으면 Nginx를 건드리기 전에 멈추고, 전환에 실패하면 upstream을 옛 슬롯으로 되돌린다. 살아 있는 컨테이너는 건드리지 않는다.
- **겹치는 동안 작업이 겹치거나 사라지지 않는다.** 큐가 DB에 있어 작업 하나는 한 프로세스만 꺼내고(`SKIP LOCKED`), 정기 작업은 DB가 회차마다 하나만 내보낸다. 옛 컨테이너는 하던 작업을 끝내고 내려가며 못 끝낸 작업은 다시 실행된다.
- **이전 버전으로 돌아가려면 그 SHA를 다시 배포한다.** 직전 이미지는 서버에 남아 있다. 스키마는 되돌리지 않으므로 migration은 추가만 한다.

### 늘릴 때

<img src="docs/architecture/scale-up.webp" alt="늘린 뒤의 구성" width="560" />

지금은 API와 worker가 한 프로세스이고 캐시는 프로세스 메모리다. 늘릴 때 바꾸는 것은 설정과 인프라이고 업무 코드는 그대로다.

| 단계               | 켜는 신호                                       | 바꾸는 것                                                                                               | 추가 비용          |
| ------------------ | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------ |
| 1. API·worker 분리 | 작업이 몰릴 때 API 응답이 느려진다              | 같은 서버에 Valkey 컨테이너, `CACHE_TYPE=redis`, API는 `JOB_WORKER_ENABLED=false`, worker 컨테이너 하나 | 없음               |
| 2. DB 키우기       | RDS 여유 메모리·스왑 경보                       | RDS 인스턴스를 한 단계 위로                                                                             | RDS 비용           |
| 3. 서버 2대 이상   | CPU가 계속 높거나 서버 한 대 장애를 견뎌야 한다 | ALB, 관리형 Redis·Valkey                                                                                | ALB·서버·캐시 비용 |
| 4. 연결 풀러       | DB 연결 수가 한도에 가까워진다                  | PgBouncer 또는 RDS Proxy                                                                                | 없음 또는 유료     |
| 5. 큐를 브로커로   | 다른 서비스가 같은 이벤트를 구독해야 한다       | `JobQueuePort` 어댑터를 "Postgres outbox + 릴레이 + 브로커"로 교체                                      | 브로커 비용        |

단계별 체크리스트와 프로세스가 둘 이상일 때 달라지는 상태는 [확장](apps/api/docs/scaling.md)에 있다.

**왜 지금은 서버 한 대인가**

- 큐가 DB 안에 있다. 업무 변경과 작업 등록이 한 트랜잭션이라 "저장은 됐는데 알림은 안 나감"이 없고, 프로세스가 죽거나 배포로 내려가도 작업이 남는다. 브로커를 따로 두면 이 보장을 outbox로 다시 만들어야 한다.
- 캐시·잠금·큐·외부 공급자가 모두 Port 뒤에 있다. Redis로 옮기기, worker 떼어 내기, 공급자 바꾸기가 설정이나 어댑터 하나로 끝난다.
- 무중단 배포와 롤백이 서버를 더하지 않고 된다.
- 한계: 서버가 한 대라 호스트 장애와 OS 재부팅 때는 멈춘다. 그동안의 작업은 큐에 남아 따라잡지만 요청은 받지 못한다. 3단계가 이 한계를 없앤다.

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
| 배포할 때마다 요청이 끊기고, 실패하면 옛 이미지로 다시 띄우는 동안 또 멈췄다                            | 로드밸런서 + 서버 2대, Docker Swarm, Nginx 자동 넘김                                                        | **같은 서버의 포트 두 개와 Nginx 전환**: 새 컨테이너가 healthy가 된 뒤 넘기고, 실패하면 살아 있는 쪽을 건드리지 않는다. 비용이 늘지 않는다                                  |
| 스토어 릴리스마다 서버 버전 숫자를 앱에 맞추느라 코드 변경 없이 서버를 다시 배포했다                    | 릴리스 버전 하나 유지, 서버 독립 semver                                                                     | **서버는 커밋 SHA, 앱만 스토어 버전**. 호환은 번호가 아니라 `/v1`과 "추가만" 계약이 지킨다. 스토어 공개 버전은 DB에 두고 관리자 API로 바꾼다                                |
| 배포 중 놓친 크론과 "정확히 그 분"만 보는 리마인더 sweep이 알림을 잃었다                                | 무중단 배포 먼저, 크론 주기 단축                                                                            | 스케줄마다 **`missed` 정책 필수**, sweep은 **워터마크로 놓친 분(최대 15분)까지 따라잡기**, 15분 넘게 늦으면 사유와 함께 건너뜀                                              | 서버가 멈춘 동안(재부팅·호스트 장애)의 알림은 늦게 간다. 유실 대신 지연을 택했다                                  |
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
- env 파일은 앱마다 `.env`(운영) · `.env.development`(개발) · `.env.example`(예시)이고 도커도 같은 파일을 읽는다. API까지 Docker로 띄우려면 `docker compose --profile api up -d`(DB → migrate → API)를 쓴다. 모바일 실행은 [apps/mobile/README.md](./apps/mobile/README.md)를 따른다.

| 명령어                                                  | 설명                                                                       |
| ------------------------------------------------------- | -------------------------------------------------------------------------- |
| `pnpm check`                                            | lint(관례 포함) → format:check → docs:check → 이름·경계·미사용 → typecheck |
| `pnpm gen:api-slice`                                    | 규칙대로 새 서버 slice 뼈대 생성                                           |
| `pnpm test` · `pnpm test:integration` · `pnpm test:e2e` | unit · 실제 PostgreSQL 통합 · HTTP E2E                                     |
| `pnpm test:contract`                                    | 출시 앱 OpenAPI 계약 테스트                                                |
| `pnpm check:unused`                                     | 모바일 밖 workspace의 안 쓰는 파일·export·의존성(knip)                     |
| `pnpm db:generate` · `pnpm db:migrate`                  | Drizzle 마이그레이션 생성 · 적용                                           |
| `pnpm commit`                                           | Conventional Commit 작성기                                                 |

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
