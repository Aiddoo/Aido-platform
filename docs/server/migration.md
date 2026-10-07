# 서버 구조 전환

[Epic #882](https://github.com/Aiddoo/Aido-platform/issues/882)의 진행 기록이다.
완료된 검증과 남은 작업을 구분한다. 코드 전환 완료가 운영 배포 완료를 의미하지 않는다.

## 기준과 불변 계약

Prisma 8 기준 커밋은 `823724b5`이며 [PR #884](https://github.com/Aiddoo/Aido-platform/pull/884)로
보존했다. ORM·CLI는 현재 RC다. 기존 `/v1` URL·HTTP 상태·응답·오류 코드·날짜·정렬·페이지네이션,
로그인·토큰·구독·사용량·알림·반복 일정의 의미를 유지한다. CUID와 숫자 ID, 적용된 DB migration
이력을 보존한다. 내부 레거시 구현을 제거하더라도 기존 앱이 소비하는 필드는 현행 계약으로 유지한다.

## 순서와 현재 상태

- [x] 00 Prisma 8 기존 변경 보존, Unit 2,895·Integration 433·E2E 480 재검증
- [x] 01 CI Stack 정책·컨벤션·Workspace 의존성 검사, Unit 2,902·공식 PG service Integration 10·E2E 11 검증
- [x] 02 `@aido/server` 패키지명과 공유 REST `@aido/api` 통합, 구 앱·OpenAPI·Profile 계약 11 tests 유지
- [x] 03 modules/platform/shared·명시적 조립·로그·키 기본 경계: PR #891과 Issue #892
- [ ] 04 Identity: 04a 세션 완료([Issue #896](https://github.com/Aiddoo/Aido-platform/issues/896)); 계정·자격 증명·설정·동의·생명주기 남음
- [ ] 05 Billing: Webhook·구독 상태 전이
- [ ] 06 Access: ABAC·Entitlement·Quota 예약·서버 capability
- [ ] 07 Planning: 할 일·항목·카테고리·반복 일정
- [ ] 08 Social: 친구·응원·넛지
- [ ] 09 Notes: 메모와 전환
- [ ] 10 Engagement: 댓글·반응·대화·정리
- [ ] 11 Insights: 완료 집계·주간 달성·연속 기록
- [ ] 12 Weather: 위치·좌표·격자·Provider
- [ ] 13 AI Assistance: 파싱·보고서·추천
- [ ] 14 Notification: 알림함·Push·Email·Reminder·Retention·Worker
- [ ] 15 Support·Operations·App Config
- [ ] 16 ORM·N+1·성능·컨테이너 검증
- [ ] 17 미사용 의존성·내부 레거시·빈 폴더 정리와 최종 검증

모든 Context는 같은 Domain/Application/Infrastructure/Presentation 패턴과 파일 접미사를
따른다. Domain/Application은 순수 TypeScript, 데이터 소유자는 Gateway 구현을 소유하며
Composition Root가 의존성을 연결한다. 상태 없는 문의 전달·조회에 가짜 Aggregate나 DB를 만들지 않는다.

서버는 접근·한도·전체 집계·저장 정합성을 판단하고 클라이언트는 표시·입력·상호작용을 계산한다.
신규 capability는 추가 API로 제공한다. 새 클라이언트 출시 전에 서버와 롤백 대상 이미지가 이를 지원해야 한다.

## 검증과 완료 조건

각 단계에서 lint·format·typecheck와 필요한 Unit/실제 PG Integration/HTTP E2E를 실행한다.
고정 구 클라이언트 fixture를 현재 schema로 재생성하지 않는다. 생성·복원·상태 전이·PATCH
presence·경쟁 조건·중복 Webhook/환불·작업 재시도·롤백을 Given/When/Then으로 검증한다.

순환 의존과 레이어 위반 0, 기존 앱 계약 유지, 데이터 전환·롤백 검증 통과, 대표 경로 N+1
제거, 성능 회귀 해결, 임시 내부 Adapter 제거를 완료 기준으로 둔다. BullMQ 제거는 기존
producer와 waiting/active/delayed/retry/repeat 작업의 drain 확인을 배포 전제 조건으로 둔다.

구조 개선을 성능 개선으로 추정하지 않는다. 같은 데이터·리소스에서 commit별 쿼리 수·p50/p95·
CPU·RSS·오류율을 측정하고 Issue/PR에 조건과 한계를 기록한다. 이전 Prisma 8의 8쿼리→5쿼리
측정은 후속 구조 전환 결과로 재사용하지 않는다. 운영 latency와 billed Actions 절감률은 미측정이다.

## 03 구조와 기본 도구 검증

14개 Context를 `src/modules`로, Nest·DB·HTTP·job runtime을 `src/platform`으로 분리했다.
Application 200개 클래스는 순수 생성자 의존성 객체를 받고 기존 DI token을 Nest factory provider로
조립한다. 테스트 156개 setup은 기존 mock 라이브러리와 fixture를 사용한다. HTTP 예외 변환은
filter가 소유하며 미사용 예외 생성 메서드 129개를 제거했다. `jose`는 기존 ESM 실행 설정에 맞춰
native static import로 사용하고 wrapper·중복 타입·강제 변환을 제거했다.

레이어 소스 스캔 검사를 Oxlint 기본 규칙으로 대체했다. type import·re-export·상대 경로·별칭·
문자열 dynamic import·순환 의존·파일명 위반을 포함한 임시 사례 11개가 모두 차단되었다.
임시 파일은 제거했고 실행 script·추가 패키지·추가 Action job은 없다. Nest Module/worker DI는
실제 Integration, HTTP 응답과 배포 앱 계약은 E2E가 검증한다.

- 서버 Unit: 446 files / 2,903 tests, 15.91초. 중복 소스 스캔 테스트 제거와 JWT 검증 추가를 반영한 수다.
- 실제 PostgreSQL service Integration: 43 files / 433 tests, 154.94초.
- 전체 E2E: 34 files / 480 tests, 328.61초. 구 앱 fingerprint와 OpenAPI fixture 변경 없음.
- lint·format·fresh server typecheck·server build 통과. 빌드된 OAuth verifier의 Node ESM import 확인.
- 실제 JWT 서명·만료·issuer·audience·nonce·JWKS key rotation: 24 tests.

테스트 fixture의 provider 등록 누락으로 큐 Integration 2개가 처음 실패했다. harness가 운영 factory
provider를 재사용하도록 수정한 뒤 해당 6 tests와 전체 433 tests가 통과했다. 테스트 timeout이나
기대값을 완화하지 않았다. 실행 조건이 다른 테스트 시간은 성능 향상률로 사용하지 않는다.

Context 내부 상태 모델·owner Gateway·Access quota·기존 문자열 로그 전체 정리·성능 측정은 후속 단계에
남아 있다. 이 단계의 검증을 전체 구조 전환이나 운영 영향 없음의 보장으로 확대하지 않는다.

## 03b 캐시·로그·저장소 정리 검증

공용 CacheService는 54개 메서드·377줄에서 기술 연산 12개·76줄로 줄였다. 키/TTL은 기존 builder를 사용해 소유 Context에 두고 Auth와 Entitlement는 자기 port의 Adapter로 연결한다. Date/string으로 복원되는 세션 캐시 타입을 명확하게 했다. 쓰기 후 무효화 키·TTL·cache-aside·장애 격리 의미를 유지한다. 사용처가 없는 전체 timezone 캐시·친구 패턴 helper·Logger wrapper·동기 설정·중복 타입을 제거했다.

HTTP 로그는 공식 Pino 옵션으로 query/header 원문을 숨기면서 reqId와 구조화 event를 유지한다. 이메일·OAuth state·교환 코드 일부·할 일 제목·이메일 모의 발송 본문을 로그에서 제거했다. 기존 업무 결과와 REST 오류 응답은 그대로 유지한다. Sentry 캡처 자체는 유지하며 Sentry 전체 데이터 정제 검증 완료를 의미하지 않는다.

- Unit: 448 files / 2,879 tests, 17.85초. 제거한 기능별 캐시 wrapper 테스트 27개와 미사용 패턴·형태 검사 4개, 추가 로그 검증 7개를 반영했다.
- 실제 PostgreSQL service Integration: 43 files / 433 tests, 133.10초.
- E2E: 34 files / 480 tests, 252.53초. 구 앱 fingerprint와 OpenAPI fixture 변경 없음.
- 실제 Nest/Pino stream에서 인증 query/header 비노출, 구조화 event·reqId, 4xx 자동 로그 생략 확인.
- Git 환경 파일 포함/제외 8/8, 실제 BuildKit context에서 필수 12개 경로 포함·환경 파일/문서/Mobile/테스트 등 10개 경로 제외 확인.
- Workspace typecheck·lint·format 통과. API 하위 중복 ignore 두 파일은 실제 root build context 기준으로 제거했다.

최초 Integration은 구형 cache fixture 때문에 36개 실패했다. 기존 typed mock을 재사용하고 현재 Adapter 경로와 기대 키를 맞춘 뒤 전체 433개 통과했다. 테스트의 기존 의미와 timeout을 완화하지 않았다. HTTP 설정 분리 중 문법 오류와 요청 ID 누락도 대상 테스트에서 확인·수정했다.

Docker context 검사에서 root `.env*`가 중첩 환경 파일을 제외하지 못하는 문제를 발견해 `**/.env*`로 수정했다. 오래된 캐시 작업 계획을 제거하고 릴리스 문서는 코드 복사 대신 실제 소스 링크로 바꿨다(847줄→151줄). 기존 릴리스 QA 기록과 배포 client fixture는 보존한다.

전체 18단계 중 00–03 구현·검증 완료, 04–17 14단계가 남았다. commit/PR 완료 시 Issue·담당자·Labels와 이 체크리스트를 갱신한다. 이 단계는 추가 script·패키지·Action job 없이 진행했다. 테스트 시간은 서로 다른 실행 조건의 기록이며 운영 성능 향상률과 billed Actions 절감률로 사용하지 않는다. 운영 배포·merge는 하지 않았다.

## 03c fixture Port Stub와 HTTP 공급자 응답 검증

Application 이메일 테스트는 `EmailSenderPort` Stub과 `AuthEmailSenderPort`를 구현한 기존
Fake를 주입하고 발송 기록으로 검증한다. VerificationFixture를 재사용하며 코드·type·expiryMinutes의
계약을 유지한다. FakeEmailService는 338줄에서 155줄로 줄였고 raw 주소/인증 코드 console 출력을
제거했다. Repository/security/logger 등 나머지 typed mock은 Context별 전환 단계에 남아 있다.

Resend SDK 전체 mock을 제거하고 실제 SDK와 JSON HTTP fixture를 조합했다. SDK의 fetch 주입
옵션이 없어 비동시·격리된 spec에서 Vitest 공식 `vi.stubGlobal`을 사용하고 globals/env/timer를
복원한다. 준비하지 않은 요청은 실패시키며 실제 외부 서비스로 전달하지 않는다. 운영 EmailModule을
그대로 import하고, 수동 timer polling·결과 non-null assertion·provider 재작성을 제거했다.

실제 wire 검증에서 Idempotency Key가 HTTP 헤더 대신 이메일 본문의 `headers`에 들어가는 버그를
재현했다(기대 헤더 값 대신 null). 공식 SDK의 두 번째 인자 `idempotencyKey` 옵션으로 수정하고
모든 retry의 헤더·본문, 병렬 요청의 독립된 key/body를 검증한다. 공개 REST 계약은 변경하지 않는다.
SDK 전체 mock에서 기대하던 연결 오류 원문은 실제 SDK가 정규화하는 결과와 달랐다. 운영의 SDK
오류 정규화는 유지하면서 테스트를 실제 경계로 바꿨다. 이 결과로 운영 공급자 SLA를 주장하지 않는다.

- 전체 Unit: 448 files / 2,870 tests, 14.76초. 인증 코드 Unit 20→11: 중복 흐름과 mock만으로 CLS/rollback을 증명하던 검증을 정리하고 해시·만료·쿨다운·시도 한도·실패 결과를 유지했다.
- 핵심 Unit: 3 files / 16 tests, seed 101/202/303 + UTC/Asia/Seoul/America/Los_Angeles 세 조건에서 모두 통과. fake Date는 연말 경계에 고정하고 conditional mock은 공식 Vitest 5 `vi.when`을 사용한다.
- 실제 PostgreSQL service Integration: 43 files / 432 tests, 136.00초.
- 전체 E2E: 34 files / 480 tests, 246.87초. 고정 구 앱 계약과 OpenAPI snapshot 변경 없음.
- 이메일 HTTP fixture Integration: 1 file / 12 tests, 2.83초(최종 검토·seed 202·Asia/Seoul). 기존 13개 중 중복 설정/템플릿/태그 검증을 합치고 비 JSON·병렬 요청 검증을 보강했다.
- lint·format·workspace typecheck 통과. 새 script·패키지·Action job 없음.

최초 Stub 전환은 lazy deep mock의 spread에서 dependency가 누락되어 20개 Unit이 실패했고,
명시적인 생성자 dependency 객체로 수정했다. 수신자 wire 형식을 배열로 가정한 기대값도 실제 SDK의
기존 string 직렬화에 맞췄다. 이후 Idempotency 오류만 실패하는 상태를 확인한 뒤 운영 코드를 수정했다.
Unit·Integration·E2E는 같은 시기에 별도 실행 DB로 진행했다. 실행 조건이 다른 수치로 성능 향상률을 주장하지 않는다.
동시 HTTP 요청은 배열 순서 대신 Idempotency Key로 검증한다. 유한한 반복 통과로 전체 테스트의 flake 부재를 보장하지 않는다.
전체 Stub 전환 완료나 운영 영향 없음의 보장을 뜻하지 않는다. 전체 상위 단계는 여전히 4/18 완료,
04–17의 14단계가 남아 있다.

## 04a Identity 세션

[Issue #896](https://github.com/Aiddoo/Aido-platform/issues/896)에서 세션 endpoint 5개를 최소
Port에 의존하는 실제 UseCase로 이전했다. Controller는 named input을 전달하고 composition
root가 조립한다. CredentialAuthWorkflow에서 해당 세션 흐름을 제거했다. AuthSession의
상태 판단과 캐시의 Date/string 판단은 같은 순수 validity policy를 사용한다. 폐기 우선,
만료 `expiresAt < now`, grace `<= 10,000ms`, 이전 토큰 1회 재시도, 기존 오류 상세를 유지한다.

| 실제 검증                                               | Before                                 | After                                                        |
| ------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------ |
| 같은 버전의 동시 두 회전 요청                           | 단건 ORM update로 두 요청 모두 성공    | 조건을 유지하는 updateAll로 정확히 1성공·1null               |
| grace 이후 이전 토큰 재사용 뒤 캐시된 Access Token 요청 | 이전 커밋 f878f130에서 예상401·실제200 | 실제 폐기된 세션 ID마다 캐시 무효화; 즉시401(전체 HTTP 통과) |

첫 항목은 실제 PostgreSQL row lock에 두 UPDATE가 대기한 뒤 해제해 재현했다. 두 번째는
같은 HTTP 회귀 테스트를 별도 과거 커밋 worktree에서 실행해 재현했으며 임시 worktree와 DB는
정리했다. 임의 sleep이나 DB/socket fake timer 없이 검증한다. Raw SQL은 운영 코드에 추가하지
않았다. PG lock 관찰 SQL은 테스트에만 있다. 처리량·p50/p95와 운영 latency는 미측정이다.

기존 Workflow의 세션 Unit 27개를 새 UseCase 25개로 정리하고 fixture 기반 Session/Cache/
SecurityLog/TokenIssuer Stub으로 상태와 기록을 확인한다. Unit의 가짜 CLS 증명은 제거하고
실제 PG 경쟁·폐기·family 범위 테스트 3개를 추가했다. 현재 전체 04 단계 완료를 의미하지 않는다.

전체 HTTP E2E 34 files / 481 tests는 265.17초에 통과했다. 초기 새 회귀 테스트의
오류 기대값은 기존 Guard wrapping의 `AUTH_0101` 및 기존 대문자 폐기 사유와 달랐고,
운영 동작을 바꾸지 않고 테스트를 기존 계약에 맞췄다. 이전 커밋의 실패 지점은 이 기대값보다
앞선 HTTP 상태 검사이며 `예상401·실제200`을 별도로 확인했다.

최초 전체 Integration은 44 files / 435 tests 중 5개가 실패했다. 두 retention spec이
DB DEFAULT로 생성한 `availableAt`을 즉시 Node 시각으로 claim하는 환경 시계 의존성을
확인했다. 실제 측정에서 DB timestamp가 Node 응답 후 시각보다 4.9ms 앞섰고, 독립 실행에서도
같은 위치가 실패했다. 테스트 outbox의 `availableAt`과 claim 기준을 같은 고정 업무 시각으로
지정했다. 운영 claim/worker 정책은 바꾸지 않았다. 수정 후 대상 2 files / 12 tests가 seed 101·202·303 및 미국·한국 timezone에서 통과했다.
전체 Integration 재검증도 통과했다. 유한한 반복 통과를 전체 flake 부재의 보장으로 쓰지 않는다.

최종 검증: Unit 453 files / 2,865 tests(14.96초), Integration 44 files / 435 tests(119.72초),
E2E 34 files / 481 tests(265.17초), lint·format·workspace typecheck 통과.
핵심 Unit 11 files / 73 tests는 seed 40401에서 통과했고, Session 생성/회전 Stub 최종 검토
6 files / 37 tests는 seed 41041에서 통과했다. 실제 PG 회전 3 tests는 미국·한국 timezone으로도
재검증했다. CredentialAuthWorkflow는 세션 흐름을 제거해 순수 356줄 줄었다. 새 script·패키지·
Action job, DB schema/migration·운영 key/TTL·공유 REST 계약 변경은 없다. 실행 시간 차이로
운영 성능 향상률을 주장하지 않는다. Identity 상위 단계는 아직 진행 중이며 전체 4/18 완료다.
