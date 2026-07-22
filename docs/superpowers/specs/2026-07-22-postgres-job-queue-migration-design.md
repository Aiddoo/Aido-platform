# PostgreSQL 기반 작업 큐 전환 설계

## 목적

현재 단일 EC2 API와 별도 RDS PostgreSQL, 단일 노드 ElastiCache Redis로 구성된 작업 큐를 기존 RDS에 저장되는 PostgreSQL 작업 큐로 전환한다. 낮은 현재 트래픽에서 별도 캐시 노드 비용을 제거하되, API 재배포나 EC2 재시작 중 이미 수락된 유료 AI 작업과 예약 작업을 유실하지 않는 것이 목표다.

이번 변경은 서버 내부 인프라 교체다. 모바일 클라이언트의 REST 경로, 요청·응답 DTO, HTTP 상태 코드, 인증 토큰, 푸시 payload에는 변경을 만들지 않는다.

## 현재 상태와 판단

- EC2 `t4g.small`은 평균 CPU가 매우 낮지만 메모리 여유가 작아 더 낮추지 않는다.
- RDS PostgreSQL 데이터는 약 61MB이고 연결 수와 부하가 매우 낮다.
- ElastiCache `cache.t4g.micro`는 약 12.5MB만 사용하지만 별도 상시 비용이 발생한다.
- Redis에는 BullMQ 작업 큐가 있으며, EC2 재시작과 독립되어 수락된 작업을 보존한다.
- 현재 ElastiCache는 replica와 AOF가 없는 단일 노드다. EC2 재배포에는 안전하지만 Redis 노드 자체 장애에는 고가용성 보장이 없다.
- API 트래픽은 약 1,100건/일 수준이며 현재 큐에는 주로 반복 스케줄이 존재한다. 별도 Redis 노드를 유지해야 할 부하는 아니다.
- 인증 세션과 refresh token hash는 PostgreSQL `Session` 테이블에 저장된다. Redis는 로그인 상태의 원본 저장소가 아니다.

예약 구매는 사용하지 않는다. Redis를 Valkey로만 바꾸면 월 약 US$3.57(세전) 절감에 그치지만, ElastiCache를 제거하면 월 약 US$17.86(세전), 부가세 포함 약 US$19.6를 절감할 수 있다. 현재 월말 예상 US$46.86 기준 목표 비용은 약 US$27.2이며, 실제 청구액은 전송량·세금·월 길이에 따라 달라질 수 있다.

## 설계 원칙

1. 큐는 프로세스 메모리가 아니라 RDS에 영속화한다.
2. application/domain 계층은 BullMQ, pg-boss, Redis 타입을 import하지 않는다.
3. 각 bounded context는 업무 의미가 드러나는 전용 큐 포트를 소유한다.
4. infrastructure 계층의 공용 `JobRuntimePort`가 enqueue, schedule, work, retry, cancel, graceful shutdown을 추상화한다.
5. PostgreSQL과 Redis 런타임 어댑터를 모두 실제 구현으로 유지한다. `JOB_BACKEND=postgres|redis`로 배포 시 선택해 전환 기간과 향후 확장을 지원한다.
6. 캐시는 정확성의 원본이 아니다. 단일 인스턴스 동안 캐시·중복 억제·짧은 lock·rate limit은 in-memory 전략을 사용하고, 영속성이 필요한 상태는 DB에 둔다.
7. 외부 AI 호출은 exactly-once를 보장할 수 없으므로 업무 레코드의 멱등성과 명시적 상태 전이로 중복 과금을 억제한다.

## 큐 아키텍처

현재 8개 큐를 같은 업무 경계로 유지한다.

- account purge
- admin notification
- AI report generation
- AI suggestion analysis
- notification
- retention
- timezone reminder
- todo reminder

각 모듈의 application 계층은 `ReportGenerationQueuePort`처럼 업무 용어로 된 포트만 호출한다. 해당 모듈의 infrastructure adapter가 공용 `JobRuntimePort`에 vendor-neutral job 이름과 payload를 전달한다. 공용 런타임의 PostgreSQL 구현은 pg-boss를, Redis 구현은 기존 BullMQ를 사용한다.

작업 이름과 payload에는 버전을 포함한다. 예: `ai-report.generate.v1`. 런타임 구현체가 바뀌어도 application 계약과 클라이언트 API는 바뀌지 않는다.

## PostgreSQL 영속성과 원자성

pg-boss 12 계열을 고정 버전으로 사용한다. 운영 시작 시 자동 DDL을 허용하지 않고 migration 컨테이너가 다음 순서로 실행한다.

1. `prisma migrate deploy`
2. pg-boss schema migration
3. pg-boss `doctor`

가능한 업무 흐름에서는 Prisma transaction adapter를 사용해 업무 데이터 변경과 job enqueue를 한 트랜잭션으로 커밋한다. 둘 중 하나가 실패하면 모두 rollback되어 DB에는 변경됐지만 작업이 사라지는 dual-write 문제를 방지한다.

미래 실행 예약은 Redis 내부 데이터를 복사하지 않는다. Todo reminder 등 원본 시각이 PostgreSQL에 있는 작업은 source of truth에서 다시 구성한다. 반복 스케줄은 결정적인 schedule key로 등록해 중복 생성하지 않는다.

## 재시작·장애 시 동작

- API가 작업 enqueue 성공을 응답한 뒤 EC2나 API 컨테이너가 재시작되면 job row는 RDS에 남고 다음 worker가 이어서 처리한다.
- DB가 잠시 재시작되면 요청은 성공으로 응답하지 않으며, 이미 저장된 job은 DB 복구 후 처리한다.
- 요청이 API에 도달하기 전에 서버가 내려간 경우 서버가 저장할 데이터가 없으므로 클라이언트 retry가 필요하다. 기존 클라이언트의 현재 네트워크 retry/error 계약을 변경하지 않는다.
- 정상 배포는 Nest shutdown hook에서 새 작업 수신을 먼저 멈추고 실행 중 작업을 최대 90초 drain한다. Docker에는 그보다 긴 120초 stop grace period를 둔다.
- 강제 종료된 실행 작업은 lease/heartbeat 만료 후 재시도한다.

일반 작업과 AI 작업은 총 3회 시도한다. 일반 작업은 1초, AI 작업은 5초 기준 exponential backoff를 사용한다. 장시간 AI 작업은 heartbeat와 실행 제한 시간을 명시한다. 완료 작업은 7일, 최종 실패 작업은 14일 보존하며 최종 실패는 DLQ와 운영 로그에서 식별 가능해야 한다.

AI 보고서는 `(userId, type, year, period)` 고유 제약과 결정적 job key를 유지한다. 외부 AI 응답 이후 DB 저장 전에 프로세스가 종료되면 외부 호출이 재실행될 수 있으므로, 보고서 생성 상태와 시도 식별자를 DB에 기록하고 완료 레코드가 있으면 호출하지 않는다. 공급자가 idempotency key를 지원하지 않는 한 외부 호출의 수학적 exactly-once를 약속하지 않는다.

## 인증과 클라이언트 무영향 보장

다음 항목은 변경 금지 불변조건이다.

- PostgreSQL `Session` row와 refresh token hash
- access/refresh JWT secret, issuer, audience, 만료 정책과 claim 형식
- 로그인·갱신·로그아웃 API 경로, DTO, HTTP 상태 코드
- 전체 공개 REST 경로와 요청·응답 schema
- 푸시 알림 payload와 deep link 계약
- 모바일 앱이 해석하는 error code

기존 세션을 만든 뒤 API 컨테이너를 재시작하고 같은 access token으로 보호 API를 호출하며, 같은 refresh token으로 갱신이 성공하는 E2E를 배포 게이트로 둔다. OpenAPI 산출물은 기준 버전과 비교해 의도하지 않은 diff가 없어야 한다. 서버 내부 queue job 이름은 공개 API가 아니며 클라이언트에 노출하지 않는다.

## 캐시 키와 일관성

하나의 거대한 전역 키 목록 대신 bounded context가 자기 키를 소유한다. 키 형식은 다음 규칙으로 통일한다.

`aido:v1:<bounded-context>:<resource>:<identifier>`

각 모듈은 `todo-cache.keys.ts`, `notification-cache.keys.ts`처럼 전용 key builder 파일을 갖는다. application 코드는 raw 문자열 연결을 하지 않고, cache/dedup/lock/rate-limit adapter가 같은 builder를 사용한다. 입력 정규화, 구분자, 버전은 builder에서만 관리하고 정확한 문자열 계약을 단위 테스트한다.

in-memory 캐시는 재시작 시 사라져도 정확성에 영향을 주지 않아야 한다. 캐시 miss는 DB 조회로 복구하며, 여러 인스턴스로 확장할 때 Redis adapter를 선택할 수 있도록 포트 계약을 유지한다.

## Docker와 개발 환경

기본 개발 구성은 PostgreSQL, migration, API만 실행하고 `JOB_BACKEND=postgres`를 사용한다. Redis는 기본 비용·의존 경로에서 제외하되 별도 Compose profile 또는 override로 `JOB_BACKEND=redis`를 실행할 수 있게 유지한다.

운영 Compose는 외부 RDS에 대해 migration/doctor가 성공해야 API를 시작한다. API health는 단순 프로세스 생존 외에 DB 연결, queue worker 준비 상태, backlog와 oldest job age를 제공한다. 비밀 값은 이미지나 로그에 기록하지 않는다.

요청된 개발 검증의 기준 명령은 다음과 같다.

```bash
pnpm docker:dev:build
pnpm docker:dev:up
```

그 후 migration/doctor, API health, enqueue→처리, 지연 작업, retry/DLQ, graceful restart, 기존 세션 재사용을 자동 smoke test로 검증한다. 테스트용 public endpoint는 추가하지 않고 내부 테스트 harness를 사용한다.

## 전환 절차

### 1. Expand 릴리스

- semantic queue port와 공용 job runtime port를 추가한다.
- pg-boss schema, PostgreSQL adapter, 기존 BullMQ adapter를 준비한다.
- 운영은 계속 `JOB_BACKEND=redis`로 실행한다.
- 단위·통합·E2E·Docker smoke와 pg-boss doctor를 통과한다.

### 2. Cutover 릴리스

- 2~5분의 계획 점검 창을 사용한다.
- API/worker를 graceful stop하고 BullMQ의 waiting/active job이 0인지 확인한다.
- PostgreSQL source of truth에서 미래 reminder와 반복 schedule을 멱등하게 구성한다.
- `JOB_BACKEND=postgres`로 시작한다.
- queue, 인증, 기존 클라이언트 계약 smoke test를 통과한 뒤 트래픽을 정상화한다.

### 3. Soak와 제거

- Redis는 7일 동안 rollback 용도로 유지한다. 이 기간에는 비용 절감이 아직 실현되지 않는다.
- queue 실패율, oldest age, 중복 처리, AI 비용, 인증 오류율을 관찰한다.
- 이상 시 API를 drain한 뒤 `JOB_BACKEND=redis`로 되돌린다.
- 7일 안정화 후 snapshot/보존 요구를 확인하고 ElastiCache를 제거한다. 삭제는 별도 파괴적 작업이므로 실행 직전 사용자의 명시적 승인을 다시 받는다.

## 검증 게이트

코드 품질:

```bash
pnpm typecheck
pnpm lint
```

필수 자동 검증:

- port contract와 PostgreSQL/Redis adapter 동등성 테스트
- cache key builder 계약 테스트
- enqueue와 업무 DB 변경의 commit/rollback 통합 테스트
- 예약·지연·cancel·retry·DLQ·retention 테스트
- worker 실행 중 graceful restart와 강제 restart 복구 테스트
- AI 보고서 멱등성 및 완료 후 재호출 방지 테스트
- 기존 access/refresh token의 컨테이너 재시작 전후 E2E
- OpenAPI 및 공개 error/push payload contract diff
- 기본 PostgreSQL backend와 선택적 Redis backend Docker smoke

전환 중 하나라도 실패하면 ElastiCache를 삭제하지 않고 Redis backend로 rollback한다.

## 관측성과 운영 기준

최소 지표는 backend 종류, queue별 waiting/active/failed 수, oldest job age, 처리 시간, retry/DLQ 수다. 로그에는 job id, job name, attempt, duration, outcome을 구조화하되 사용자 원문·토큰·AI 문서 내용은 기록하지 않는다.

초기 경보 기준은 다음처럼 보수적으로 둔 뒤 실제 처리 시간을 관찰해 조정한다.

- 일반 queue oldest age 5분 초과
- 예약 작업 예정 시각 대비 5분 초과
- AI 작업 oldest age 15분 초과
- DLQ 1건 이상
- queue health 또는 pg-boss doctor 실패
- cutover 후 인증 401 비율의 기준선 대비 유의미한 증가

## 제외 범위

- EC2 instance 축소
- RDS instance 축소 또는 예약 구매
- 모바일 앱 릴리스와 API 계약 변경
- ElastiCache 즉시 삭제
- 다중 API 인스턴스 전환
- 외부 AI 공급자가 지원하지 않는 exactly-once 보장

## 참고 문서

- pg-boss: <https://timgit.github.io/pg-boss/>
- pg-boss Prisma adapter: <https://timgit.github.io/pg-boss/api/adapters>
- pg-boss jobs: <https://timgit.github.io/pg-boss/api/jobs>
- pg-boss workers: <https://timgit.github.io/pg-boss/api/workers>
- pg-boss operations: <https://timgit.github.io/pg-boss/api/ops>
- pg-boss CLI: <https://timgit.github.io/pg-boss/cli>
