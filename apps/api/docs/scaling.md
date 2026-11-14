# 캐시·잠금·확장

캐시·잠금·dedup·프로세스 안 저장소를 만들 때, 인스턴스·DB를 늘릴 때 읽는다. 풀 설정은 [영속성](persistence.md#풀-설정), 큐 연결 예산은 [작업과 이벤트](jobs-and-events.md#큐-정의)에 있다.

## 지금 (2026-11 측정)

- 운영은 서버 한 대의 API 컨테이너 하나(512MB, 힙 384MiB)와 RDS `db.t4g.micro` 하나다. 한 프로세스가 HTTP·worker·정기 작업을 모두 돌린다.
- DB 연결은 프로세스당 앱 풀 `DATABASE_POOL_MAX` 10 + pg-boss `JOB_POOL_MAX` 3 = 최대 13이고 `max_connections`는 79다. 7일 최대 연결은 17이었다. 배포 중에는 두 컨테이너가 겹쳐 최대 26 + migrate다.
- 병목은 연결 수가 아니라 RDS 메모리(여유 약 55MB, 스왑 약 80MB)다. 연결 하나가 수 MB를 쓰므로 풀을 키우지 않는다.
- EC2는 2 vCPU·RAM 1.8GB이고 API 컨테이너는 CPU 약 6%다. 실제 큐 작업은 분당 최대 26건, 처리 시간은 수십 ms라 워커가 동시에 1~2개만 돈다.
- `CACHE_TYPE=memory`이고 운영 env에 `REDIS_URL`을 두지 않는다. 프로세스가 상시 둘 이상이 될 때 아래 체크리스트대로 켠다.
- 실제 연결 수는 `SELECT application_name, state, count(*) FROM pg_stat_activity WHERE backend_type = 'client backend' GROUP BY 1, 2`로 본다(`aido-api`·`aido-pg-boss`).

## 캐시

설정 한 줄(`CACHE_TYPE`)로 in-memory → Redis·Valkey로 바뀐다.

| 층              | 형태                                                                                                                                               |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 범용 저장소     | [CacheStorePort](../src/platform/cache/cache-store.port.ts)(`get(key, schema)`·`set(key, value, ttlMs)`·`del`·`mget`·`mset`·`delByPattern`·`wrap`) |
| slice 의미 캐시 | `DailyCompletionCachePort` 등. 키·TTL·무효화 규칙은 `<noun>.keyspace.ts`가 가진다                                                                  |

- UseCase는 의미 Port만 안다. Redis key·TTL·sentinel·패턴은 keyspace가 소유하고 운영 key와 TTL을 바꾸지 않는다(`platform/cache/keyspace`의 계약 spec이 기존 키·TTL 호환을 검사한다).
- 어댑터: `InMemoryCacheStore`는 `lru-cache`(`CACHE_MAX_ITEMS`·TTL), `RedisCacheStore`는 ioredis(Valkey는 URL만 바꾼다). 패턴 삭제는 `KEYS`가 아니라 `SCAN`이다.
- TTL은 밀리초 숫자(`ttlMs`)다. 생략하면 `CACHE_DEFAULT_TTL_MS`, 0이면 저장하지 않는다. `wrap`은 같은 key의 동시 미스에서 factory를 한 번만 부른다.
- 장애 계약은 fail-open이다: 읽기는 미스와 같고 쓰기는 던지지 않는다.
- 값은 읽을 때 Zod로 검증하고 다르면 미스다(배포 사이 값 모양이 달라도 안전). 직렬화는 JSON 하나이고 Temporal은 문자열로 저장한다.
- 범용 `wrap`은 미스 뒤 factory 값을 그대로 저장한다. 쓰기의 커밋 뒤 무효화보다 늦게 끝난 읽기가 커밋 전 값을 다시 저장해 TTL 동안 남길 수 있으므로, 그러면 안 되는 캐시는 세대를 쓴다. 일간 완료·친구 화면 할 일은 세대를 키에 넣고, 권한(`subscription:status:v2`)·프로필(`auth:user-profile`)은 키를 두고 [GenerationGuardedCache](../src/platform/cache/generation-guarded-cache.ts)로 factory 전에 읽은 세대가 그대로일 때만 저장한다.
- 세대 무효화는 세대 키만 바꾼다. 이전 세대 값은 닿지 않고 짧은 값 TTL(친구 화면 1분·일간 완료 10분)에 사라지므로, Redis 키 전체를 훑는 `delByPattern`(SCAN)을 요청 경로에서 기다리지 않는다.
- 캐시·잠금·dedup·throttler 저장소의 계약 suite([test/contracts/platform](../test/contracts/platform))를 in-memory(unit)와 Redis·Valkey 컨테이너([redis-adapters.integration-spec.ts](../test/integration/platform/redis-adapters.integration-spec.ts))에서 같이 돌린다.
- slice 캐시 어댑터는 `CacheStorePort`만 받는다(사례: [daily-completion.cache.ts](../src/modules/insights/daily-completions/infrastructure/cache/daily-completion.cache.ts), weather `weather-report.cache.ts`). 다른 캐시 진입점을 만들지 않는다.
- memory 저장소는 모든 캐시가 항목 한도 하나(`CACHE_MAX_ITEMS`, 운영 3,000)를 LRU로 나눠 쓴다(dedup·잠금·throttler는 따로 둔다). 만료 항목은 읽히거나 밀려날 때만 빠지므로 쓴 키가 한도를 넘은 뒤로는 늘 가득 차 있고 새 키가 가장 오래 안 읽은 키를 밀어낸다. 키를 가장 많이 만드는 것은 활성 사용자 수에 비례하는 사용자 키(30초마다 다시 채우는 세션, 프로필·권한·설정·카테고리·팔로우·일간 완료 범위, 24시간 남는 일간 완료·친구 화면 세대)와 활성 칸·격자 수에 비례하는 날씨 키(칸마다 리포트·latest·대기질·가용성, 격자마다 날짜별 예보·일출입)다. 운영 측정값은 없고 키 모양에서 본 추정이다. 날씨 공급자 호출이나 캐시 뒤 DB 읽기가 늘면 한도를 올리거나 Redis로 바꾼다.

## Redis로 바뀌는 것

`CACHE_TYPE=redis`와 `REDIS_URL`을 주면 같은 Redis 클라이언트(`REDIS_COMMAND_CLIENT`)를 다음이 함께 쓴다. redis를 고르고 주소가 없으면 시작을 거부한다.

| capability                   | memory일 때                                            | redis일 때              | Redis 장애 때                          |
| ---------------------------- | ------------------------------------------------------ | ----------------------- | -------------------------------------- |
| 캐시(`CacheStorePort`)       | `InMemoryCacheStore`                                   | `RedisCacheStore`       | 미스로 본다(DB에서 읽는다)             |
| dedup(`DedupProviderPort`)   | 프로세스 메모리                                        | `RedisDedupAdapter`     | 통과시킨다(DB 유니크가 마지막 방어)    |
| throttler storage            | Nest 기본 메모리                                       | `RedisThrottlerStorage` | 요청을 허용한다                        |
| TTL 잠금(`LockProviderPort`) | 프로세스 메모리                                        | `RedisLockAdapter`      | 잠긴 것으로 본다(RevenueCat 웹훅 하나) |
| 푸시 rate limit              | `PUSH_RATE_LIMIT_BACKEND`로 따로 고른다(기본 postgres) |                         |                                        |

- 명령은 기다리지 않고 바로 실패한다(오프라인 큐 끔, 명령 타임아웃, 재시도 1회). 오류 로그는 30초에 한 번으로 줄여 남긴다. 기동은 Redis 연결을 기다리지 않고 `/health`도 Redis에 의존하지 않는다.
- 틀리면 안 되는 잠금은 Redis에 두지 않는다. `MutationLockPort`는 PostgreSQL advisory xact lock이라 프로세스 수·캐시 저장소와 상관없이 안전하다. 알림 중복 방지(팔로우·마일스톤)가 이 잠금을 쓴다.
- TTL 잠금을 쓰는 곳은 RevenueCat 웹훅 하나다. Redis가 죽으면 웹훅을 429로 돌려보내 공급자가 다시 보낸다. 반영의 정확성은 트랜잭션 안의 사용자 행 잠금과 처리 원장이 지킨다.

## 인스턴스를 2대 이상으로 늘릴 때

프로세스가 상시 둘 이상이면(같은 서버에서 API와 worker를 나누는 것 포함) 아래를 함께 한다.

- [ ] `CACHE_TYPE=redis` + `REDIS_URL`. 안 하면 worker가 지운 캐시를 API가 TTL까지 모른다(권한 10분, 세션 30초)
- [ ] API 프로세스는 `JOB_WORKER_ENABLED=false`, worker를 켠 프로세스는 반드시 하나 이상. 풀은 `DATABASE_POOL_MAX`·`JOB_POOL_MAX`로 프로세스마다 정하고 합계가 RDS 한도 안인지 계산한다
- [ ] pg-boss는 그대로다(작업 꺼내기는 `SKIP LOCKED`, 정기 작업 발행은 DB가 회차마다 하나로 조정). 푸시 rate limit은 기본이 Postgres다
- [ ] Expo 초당 발송 한도(`EXPO_PUSH_MESSAGES_PER_SECOND` 상수 500)는 프로세스별이다. 푸시를 보내는 프로세스가 둘 이상이면 그 수로 나눈다
- [ ] 커밋 뒤 캐시 정리(after-commit 구독)는 커밋한 프로세스 안에서 돈다. 캐시가 Redis면 모든 프로세스가 같이 본다
- [ ] AI 지출 스냅샷은 프로세스 메모리다. 그 프로세스가 다음 AI 호출을 끝낼 때 DB 누적값으로 맞춰지므로, 호출이 드문 프로세스는 그만큼 늦게 안다
- [ ] 경보 중복 제거와 회로 상태는 프로세스별이다. 같은 장애가 프로세스 수만큼 경보될 수 있다
- [ ] 말로 계획 결과 재생은 프로세스 메모리에 둔다(사용자 음성 내용). 재시도가 다른 프로세스로 가면 AI를 한 번 더 부른다

## Redis·Valkey를 켤 때

- [ ] 같은 서버의 컨테이너로 시작한다. `127.0.0.1`에만 열고 영속화는 끄고 `maxmemory`와 `allkeys-lru`를 둔다(캐시라 잃어도 된다)
- [ ] 같은 서버 안이므로 `REDIS_COMMAND_TIMEOUT_MS`를 수백 ms로 낮춘다. 응답이 없을 때 요청마다 기다리는 시간의 상한이다
- [ ] 장애를 사람이 알도록 `redis.connection.errored`가 이어질 때의 경보를 `platform` 경보 카탈로그에 더한다. 지금은 로그만 남는다
- [ ] 계약 suite([redis-adapters.integration-spec.ts](../test/integration/platform/redis-adapters.integration-spec.ts))가 Redis·Valkey 컨테이너에서 통과하는지 본다

## 확장 단계

| 단계                              | 켜는 신호                                 | 할 일                                                                      | 코드 영향                                                                                                                               |
| --------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 1. 같은 서버에서 API·worker 분리  | 작업이 몰릴 때 API 응답이 느려진다        | 위 두 체크리스트. worker 컨테이너를 compose에 더한다                       | 없음(설정)                                                                                                                              |
| 2. DB 수직 확장                   | RDS 여유 메모리·스왑 경보                 | 인스턴스를 한 단계 위로                                                    | 없음                                                                                                                                    |
| 3. 서버 2대 이상                  | CPU가 계속 높다, 서버 한 대 장애를 견딘다 | ALB, 관리형 Redis·Valkey. ALB 유휴 시간보다 Node `keepAliveTimeout`을 길게 | 설정 + Expo 한도 상수                                                                                                                   |
| 4. 연결 풀러(RDS Proxy·PgBouncer) | 연결 수가 한도에 가깝다                   | 트랜잭션 모드                                                              | advisory lock은 트랜잭션 단위, pg-boss LISTEN/NOTIFY는 이미 끔. 세션 시작 옵션은 전달되지 않으므로 타임아웃을 DB 역할 기본값으로 옮긴다 |
| 5. 읽기 복제본                    | 읽기가 primary를 누른다                   | Drizzle `withReplicas(primary, [replica])`                                 | 트랜잭션 밖 Reader만 복제본. UoW 안 읽기는 primary                                                                                      |
| 6. 큐를 브로커로                  | 다른 서비스가 같은 이벤트를 구독한다      | `JobQueuePort` 어댑터 교체                                                 | 아래                                                                                                                                    |

**큐 교체의 실제 모양**: pg-boss를 import하는 파일은 `platform/jobs`뿐이라 slice는 바뀌지 않는다. 다만 포트가 약속하는 능력(업무 트랜잭션 안 enqueue, 며칠 뒤 `startAfter`, key로 `cancel`, 긴 기간 멱등 key, `priority`, cron)은 SQS 같은 일반 메시지큐에 없다. 그래서 새 어댑터는 "Postgres outbox 테이블 + 릴레이 + 브로커"이고, 예약·취소·멱등은 계속 Postgres가 맡는다.

웹·어드민은 같은 slice 안 presentation 진입점과 같은 `@aido/api` 계약으로 넓힌다. 이미지 업로드가 필요해지면 저장소 포트(S3/R2 presigned)와 새 slice로 더한다.

## 메모리

- 프로세스 안 저장소(캐시·잠금·dedup·rate limit·요청 throttle·AI 예산 스냅샷·회로 레지스트리)는 모두 상한이 있어야 한다. `lru-cache`(`max`·`ttl`)로 두고, 키가 사용자·요청 수에 비례해 끝없이 커지는 `Map`이나 `setInterval` 청소기를 만들지 않는다. 사례: 시간대 자가치유·마지막 활동 기록 throttle, 메모리 푸시 rate limiter, 메모리 dedup.
- 상한에 닿았을 때 버리면 안 되는 저장소는 fail-closed다. 메모리 TTL 잠금은 만료된 항목만 지우고, 그래도 가득하면 잡힌 잠금을 내보내지 않고 새 획득을 거절한다(로그 이벤트를 남긴다).
- `setInterval`·`setTimeout`·`EventEmitter.on`·`monitorEventLoopDelay`는 `OnModuleInit`에서 만들고 `OnModuleDestroy`·`beforeApplicationShutdown`에서 해제한다.
- CLS 값·요청 객체를 클로저·모듈 상수에 붙잡아 두지 않는다. after-commit 작업은 UoW가 끝나면 비운다.
- 배치·fan-out은 커서 묶음(`forEachBatch`, 500·100 단위)으로만 읽는다. 전체 사용자를 한 배열로 올리지 않는다.
- 검증: `performance` 프로젝트의 소크 테스트(수동, 주요 경로 반복 호출·큐 처리 뒤 `global.gc()` 힙 증가), `app.close()` 뒤 남은 handle 0, 운영은 힙·RSS 추세 경보([관측](observability.md#지연포화도-신호)).
