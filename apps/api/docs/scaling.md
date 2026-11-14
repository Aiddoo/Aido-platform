# 캐시·잠금·확장

캐시·잠금·dedup·프로세스 안 저장소를 만들 때, 인스턴스·DB를 늘릴 때 읽는다. 풀 설정은 [영속성](persistence.md#풀-설정), 큐 연결 예산은 [작업과 이벤트](jobs-and-events.md#큐-정의)에 있다.

## 지금 (2026-11 측정)

- 운영은 API 컨테이너 1대(512MB, 힙 384MiB)와 RDS `db.t4g.micro` 하나다. 앱 풀 10 + pg-boss 3, 7일 최대 연결 17, `max_connections` 79.
- 병목은 연결 수가 아니라 RDS 메모리(여유 약 55MB, 스왑 약 80MB)다. 연결 하나가 수 MB를 쓰므로 풀을 키우지 않는다.
- EC2는 2 vCPU·RAM 1.8GB이고 API 컨테이너는 CPU 약 6%다. 실제 큐 작업은 분당 최대 26건, 처리 시간은 수십 ms라 워커가 동시에 1~2개만 돈다.
- `CACHE_TYPE=memory`이고 운영 env의 `REDIS_URL`은 비워 둔다(큐를 pg-boss로 옮긴 뒤 연결 0). 여러 대로 늘릴 때 아래 체크리스트대로 다시 켠다.

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

`CACHE_TYPE=redis`와 `REDIS_*`를 주면 같은 Redis 클라이언트(`REDIS_COMMAND_CLIENT`)를 다음이 함께 쓴다.

| capability                   | memory일 때                                            | redis일 때              |
| ---------------------------- | ------------------------------------------------------ | ----------------------- |
| 캐시(`CacheStorePort`)       | `InMemoryCacheStore`                                   | `RedisCacheStore`       |
| TTL 잠금(`LockProviderPort`) | 프로세스 메모리                                        | `RedisLockAdapter`      |
| dedup(`DedupProviderPort`)   | 프로세스 메모리                                        | `RedisDedupAdapter`     |
| throttler storage            | Nest 기본 메모리                                       | `RedisThrottlerStorage` |
| 푸시 rate limit              | `PUSH_RATE_LIMIT_BACKEND`로 따로 고른다(기본 postgres) |                         |

`MutationLockPort`는 PostgreSQL advisory xact lock이라 Redis와 상관없이 여러 인스턴스에서 안전하다.

## 인스턴스를 2대 이상으로 늘릴 때

- [ ] `CACHE_TYPE=redis` + `REDIS_*`(캐시·TTL 잠금·dedup·throttler가 함께 넘어간다)
- [ ] 회로 상태는 프로세스별로 둬도 된다
- [ ] pg-boss는 그대로(SKIP LOCKED라 다중 worker 안전), 푸시 rate limit은 기본이 Postgres
- [ ] Expo 초당 발송 한도(`EXPO_PUSH_MESSAGES_PER_SECOND` 상수 500)는 인스턴스별이라 인스턴스 수로 나눈다
- [ ] 연결 예산: 인스턴스 × 13이 RDS 한도 안인지 계산

## 확장 단계

| 단계                              | 할 일                                      | 코드 영향                                                                                                                                                     |
| --------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. DB 수직 확장(`db.t4g.small`)   | 메모리 부족 1순위 해결책                   | 없음                                                                                                                                                          |
| 2. API 인스턴스 2대 이상          | 위 체크리스트                              | 설정 + Expo 한도 상수                                                                                                                                         |
| 3. 연결 풀러(RDS Proxy·PgBouncer) | 트랜잭션 모드                              | advisory lock은 트랜잭션 단위, pg-boss LISTEN/NOTIFY는 이미 끔. 세션 시작 옵션은 전달되지 않으므로 `TimeZone=UTC`·timeout은 DB·앱 전용 역할 기본값으로 옮긴다 |
| 4. 읽기 복제본                    | Drizzle `withReplicas(primary, [replica])` | 트랜잭션 밖 Reader만 복제본. UoW 안 읽기는 primary                                                                                                            |
| 5. 큐 분리                        | `JobQueuePort` 어댑터를 SQS 등으로 교체    | 어댑터·아웃박스 릴레이만                                                                                                                                      |

웹·어드민은 같은 slice 안 presentation 진입점과 같은 `@aido/api` 계약으로 넓힌다. 이미지 업로드가 필요해지면 저장소 포트(S3/R2 presigned)와 새 slice로 더한다.

## 메모리

- 프로세스 안 저장소(캐시·잠금·dedup·rate limit·요청 throttle·AI 예산 스냅샷·회로 레지스트리)는 모두 상한이 있어야 한다. `lru-cache`(`max`·`ttl`)로 두고, 키가 사용자·요청 수에 비례해 끝없이 커지는 `Map`이나 `setInterval` 청소기를 만들지 않는다. 사례: 시간대 자가치유·마지막 활동 기록 throttle, 메모리 푸시 rate limiter, 메모리 dedup.
- 상한에 닿았을 때 버리면 안 되는 저장소는 fail-closed다. 메모리 TTL 잠금은 만료된 항목만 지우고, 그래도 가득하면 잡힌 잠금을 내보내지 않고 새 획득을 거절한다(로그 이벤트를 남긴다).
- `setInterval`·`setTimeout`·`EventEmitter.on`·`monitorEventLoopDelay`는 `OnModuleInit`에서 만들고 `OnModuleDestroy`·`beforeApplicationShutdown`에서 해제한다.
- CLS 값·요청 객체를 클로저·모듈 상수에 붙잡아 두지 않는다. after-commit 작업은 UoW가 끝나면 비운다.
- 배치·fan-out은 커서 묶음(`forEachBatch`, 500·100 단위)으로만 읽는다. 전체 사용자를 한 배열로 올리지 않는다.
- 검증: `performance` 프로젝트의 소크 테스트(수동, 주요 경로 반복 호출·큐 처리 뒤 `global.gc()` 힙 증가), `app.close()` 뒤 남은 handle 0, 운영은 힙·RSS 추세 경보([관측](observability.md#지연포화도-신호)).
