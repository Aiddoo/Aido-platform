# 서버 구조 전환

[Epic #882](https://github.com/Aiddoo/Aido-platform/issues/882)의 진행 기록이다.
완료된 검증과 남은 작업을 구분한다. 코드 전환 완료가 운영 배포 완료를 의미하지 않는다.

## 기준과 불변 계약

Prisma 8 기준 커밋은 `beb952c0`이며 [PR #884](https://github.com/Aiddoo/Aido-platform/pull/884)로
보존했다. ORM·CLI는 현재 RC다. 기존 `/v1` URL·HTTP 상태·응답·오류 코드·날짜·정렬·페이지네이션,
로그인·토큰·구독·사용량·알림·반복 일정의 의미를 유지한다. CUID와 숫자 ID, 적용된 DB migration
이력을 보존한다. 내부 레거시 구현을 제거하더라도 기존 앱이 소비하는 필드는 현행 계약으로 유지한다.

## 순서와 현재 상태

- [x] 00 Prisma 8 기존 변경 보존, Unit 2,895·Integration 433·E2E 480 재검증
- [x] 01 CI Stack 정책·컨벤션·Workspace 의존성 검사, Unit 2,902·공식 PG service Integration 10·E2E 11 검증
- [x] 02 `@aido/server` 패키지명과 공유 REST `@aido/api` 통합, 구 앱·OpenAPI·Profile 계약 11 tests 유지
- [x] 03 modules/platform/shared·명시적 조립·로그·키 기본 경계: PR #891과 Issue #892
- [x] 04 Identity: 04a 세션 완료([PR #897](https://github.com/Aiddoo/Aido-platform/pull/897)), 04b 생명주기 완료([PR #899](https://github.com/Aiddoo/Aido-platform/pull/899)), 04c 자격 증명 완료([PR #902](https://github.com/Aiddoo/Aido-platform/pull/902)), 04d OAuth 완료([PR #903](https://github.com/Aiddoo/Aido-platform/pull/903)), 04e 설정·동의 검증 완료([Issue #904](https://github.com/Aiddoo/Aido-platform/issues/904))
- [x] 05 Billing: Webhook·구독 상태 전이·성공 원장·권한 정합성 검증([Issue #906](https://github.com/Aiddoo/Aido-platform/issues/906))
- [x] 06 Access: Entitlement 정책·AI Quota 예약·보상·공개 capability 검증([Issue #908](https://github.com/Aiddoo/Aido-platform/issues/908))
- [x] 07 Planning: 할 일·항목·카테고리·반복 일정 정합성 검증([PR #912](https://github.com/Aiddoo/Aido-platform/pull/912))
- [x] 08 Social: 친구·응원·넛지 상태·경쟁·ORM·공개 capability 검증([PR #913](https://github.com/Aiddoo/Aido-platform/pull/913))
- [x] 09 Notes: 메모와 전환·부분 성공·동시 변경 검증([PR #916](https://github.com/Aiddoo/Aido-platform/pull/916))
- [x] 10 Engagement: 댓글·반응·대화·정리([Issue #915](https://github.com/Aiddoo/Aido-platform/issues/915), [PR #918](https://github.com/Aiddoo/Aido-platform/pull/918))
- [x] 11 Insights: 완료 집계·주간 달성·연속 기록([Issue #917](https://github.com/Aiddoo/Aido-platform/issues/917))
- [ ] 12 Weather: 위치·좌표·격자·공급자 Port·지역별 선택 정책·도메인 응답 정규화; 한국 API 유지, 해외 공급자는 동일 인터페이스로 추가
- [ ] 13 AI Assistance: 기존 모델 유지·유료 추천·기록 기반 습관 제안·한/영 prompt·언어 확장·파싱/보고서/추천 품질 검증
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

## 04b Identity 사용자 생명주기

[Issue #898](https://github.com/Aiddoo/Aido-platform/issues/898)에서 최소 상태의 IdentityUser
Aggregate가 탈퇴·복구·purge 판정을 소유한다. 복구는 `deletedAt > cutoff`, purge는 `< cutoff`
이며 정확히 같은 시각에는 둘 다 실행하지 않는다. 복구 가능성을 판단한 시각을 Credential/OAuth의
공유 RestoreAccount에 전달한다. 로그인 처리 중 기간 경계를 지나도 기존 허용 의미를 유지한다.
레거시 복구 policy와 중복 저장·감사 흐름을 제거하고 DeleteAccount도 직접 UseCase로 이전했다.

PurgeDeletedAccounts가 사용자별 UoW와 기존 Notification/Engagement cleanup capability를
사용한다. Composition Root의 typed factory binding을 Integration에서도 재사용하며 전달만 하는
새 Adapter 클래스는 만들지 않았다. scheduler/handler는 업무 흐름을 가지지 않고 setter 연결을
제거했다. queue/job/scheduler/catch-up key와 retry를 소유 constants로 모으며 기존 wire 값을
유지했다. `account-purge` legacy 소비는 drain 근거가 없어 남긴다.

기존 purge는 hard delete commit 후 감사 기록을 저장하므로 감사 실패 시 재시도 대상이 사라지는
처리 순서였다. 삭제와 기존 감사 데이터를 같은 transaction에 저장하도록 바꿨다. 실제 PG에서
감사 저장 FK 실패를 유발하고 User/Profile 삭제 rollback을 검증했다. commit 뒤 cache 정리
실패는 삭제 성공·감사 기록과 분리하며 로그는 실제 purged/skipped/failed 수를 기록한다.
기존 후보 개수를 성공 수로 출력하던 코드를 제거했다. 운영 장애 발생 횟수는 미측정이다.

최소 `SELECT User FOR UPDATE` 한 문장은 중복 purge와 후보 상태 재검증을 위한 lock으로
사용한다. 설치된 rc.14 public ORM 표면에서 lock API를 확인할 수 없어 기존 native query bridge를
재사용했다. 값을 바인딩하고 nullable 날짜 codec·상태 schema를 명시했다. 단순 CRUD는 ORM을
사용한다. 실제 PG에서 두 purge가 같은 행 잠금에 대기한 뒤 해제하여 삭제·감사 1회와 나머지 skip을
검증했다. 정상 복구/purge는 서로 다른 기간 범위이므로 정상 복구 경쟁으로 삭제가 발생했다고
주장하지 않는다. 후보 조회 후 상태가 바뀐 경우의 방어 검증으로 구분한다.

User profile projection의 `deletedAt` 누락과 fixture의 명시적인 `emailVerifiedAt/name: null`이
기본값으로 덮이던 동작을 고쳤다. 미인증/nullable profile 응답을 실제 fixture로 확인한다.
가짜 활성 transaction 증명 5개는 제거하고 실제 PG에 맡긴다. 신규 UseCase Unit은 24개이며
이름과 달리 실패를 설정하지 않던 purge 테스트도 실제 실패·다음 사용자 상태 검사로 바꿨다.

Auth E2E 85 tests가 40.37초에 통과했다. 3기기의 JWT cache를 채우고 탈퇴 직후 모두 거부하며,
복구 뒤 profile/Todo/category가 보존되고 새 세션만 활성인지 확인한다. 기존 JWT/Refresh는 계속
거부한다. 검증 없는 "성능 향상" 테스트는 기존 cache miss/hit 계약에 합치고 실제 userId와
응답 data 동일성을 검증했다. 실제 PG 3 files / 17 tests는 미국·한국 timezone으로 반복 통과했다.
PG socket/timer는 유지하고 업무 Date만 고정했다. 새 script·패키지·Action job은 없다.
운영 latency·처리량은 미측정이며 전체 04 Identity 완료를 의미하지 않는다.

전체 검증도 통과했다: Unit 457 files / 2,880 tests(16.48초), Integration 45 files /
441 tests(135.74초), E2E 34 files / 481 tests(242.94초), lint·format·workspace typecheck.
credential/OAuth Workflow는 각각 순수 104줄/14줄, AccountPurgeJob은 94줄 감소했다.
신규 코드·테스트를 포함한 전체 변경이 줄었다는 뜻은 아니다. Role/응답/status/error·30일 정책·
DB schema/migration·queue wire·key/TTL·고정 구 앱/OpenAPI 계약을 유지했다.
전체 상위 단계는 여전히 4/18 완료이고 04c 자격 증명·비밀번호·프로필이 다음 범위다.

## 04c 자격 증명·비밀번호·프로필

[Issue #900](https://github.com/Aiddoo/Aido-platform/issues/900)는 가입·인증·로그인·재발송 4개,
프로필 2개, 비밀번호 5개 endpoint를 직접 UseCase로 옮긴다. Credential/Password Workflow의
전달 계층을 제거하고 최소 Port와 named input으로 조립한다. ProvisionUser와 IssueLogin은
공통 업무를 유지하면서 실제 소비 메서드만 의존한다.

| 재현한 Before                                                | 구현한 After                                                      | 확인한 결과                                               |
| ------------------------------------------------------------ | ----------------------------------------------------------------- | --------------------------------------------------------- |
| 같은 reset OTP 동시 요청 2건 모두 성공, 감사 2건             | 조회 ID·사용자·용도·hash·미사용·만료·attempt를 UPDATE 조건에 포함 | 실제 PG에서 성공 1건·거부 1건·감사 1건·승자 비밀번호 저장 |
| 비밀번호 Reset/Change 후 warmed JWT가 HTTP 200               | 실제 폐기한 IDs의 commit 후 cache 무효화                          | 기존 HTTP 회귀에서 즉시 401, Change 현재 기기는 200       |
| Change 완료 후 background rehash가 이전 비밀번호 hash로 덮음 | expected 이전 hash 조건의 ORM CAS                                 | deferred Port Stub Before 재현, 실제 PG 경쟁 저장 검증    |
| Setup 뒤 /me provider 캐시가 GOOGLE만 반환                   | commit 후 profile cache 갱신                                      | GOOGLE·CREDENTIAL 모두 반환, 기존 세션·이름·이미지 유지   |

인증 소비와 rehash에는 public ORM `updateAndCount`, 세션 집합 폐기에는 반환 projection을
지정한 `updateAll`을 사용한다. 실패 attempts는 base client의 기존 원자적 SQL builder를
유지해 caller transaction이 rollback되어도 보안 기록을 남긴다. schema·OTP hash 형식·
HTTP contract·오류 코드·운영 key/TTL은 변경하지 않는다.

현재 확인한 검증은 cache HTTP 3개 7.20초, Auth E2E 85개 40.64초(seed 50402 shuffle),
기존 password/lifecycle PG 31개 19.24초(seed 50401 shuffle)다. Before HTTP 3개는
수정 전 모두 실패했다(6.05초). 이는 회귀의 수정 결과이며 운영 latency 개선 수치가 아니다.
전체 Unit은 466 files / 2,852 tests(19.87초), Integration은 46 files / 451 tests
(163.75초), E2E는 34 files / 481 tests(261.93초)로 통과했다. 세 실행 모두 seed 50432
shuffle이며, workspace lint·format·typecheck도 통과했다. 기존 앱 호환 fixture와
OpenAPI 계약 검증을 포함하며 공개 schema와 snapshot은 수정하지 않았다.
이전 04b의 Unit 2,880개에서 28개가 줄어든 것은
두 Workflow의 중복 검증, 전달만 확인하는 endpoint 검증, 미사용 repository 메서드 검증을
제거하고 사용자 상태 기반 UseCase 검증으로 대체한 결과다. 테스트 수 감소를 성능 지표로
사용하지 않는다.

픽스처 전환 첫 PG 실행에서 Account의 자동 증가 ID를 명시해 충돌한 테스트 오류를
발견했다. `es-toolkit`의 `omit`으로 DB가 소유하는 id/userId를 제외하고 기존 native fixture
helper를 재사용해 재실행했다. 최초 Setup HTTP assertion도 현재 flat /me 응답에 맞게
교정한 뒤 Before를 다시 측정했다. 실패를 production 성능 문제나 해결 완료 근거로 쓰지 않는다.

이번 스택 커밋 8개의 설명은 한국어로 수정했다. 단계별 코드 tree 동일성, 원격 SHA,
기존 Draft PR의 base 연결을 확인했다. 한국어 설명 형식은 AGENTS.md에 남겼다.
중간 Draft의 CI는 실제 GitHub 상태에서 skipped/cancelled로 확인했고, 청구 시간 절감률은
측정하지 않았다. 추가 script·package·Action job은 없다. 상위 완료는 여전히 4/18이다.

API는 engines·Docker가 Node 24.21.0으로 고정되어 있다. 해당 런타임에서
`Promise.withResolvers()`를 직접 실행해 확인했고 API의 `lib`만 ES2024로 맞췄다.
출력 target·공유 패키지·Mobile의 lib는 유지한다. 신규 동시성 테스트는 별도 deferred
helper를 만들지 않는다. [TypeScript 공식 lib 설명](https://www.typescriptlang.org/tsconfig/lib.html)은
런타임 지원에 맞춰 타입 라이브러리를 선택하는 기준이며,
[ECMAScript Promise.withResolvers 명세](https://tc39.es/ecma262/multipage/control-abstraction-objects.html#sec-promise.withresolvers)는
표준 Promise capability를 제공한다.

production 사용처가 없는 `updateLastLoginAt` Port·repository 메서드·빈 Stub·그 메서드만
검증하던 Unit도 제거했다. DB column과 기존 데이터는 변경하지 않았다.

## 04d OAuth와 로그인 수단 변경

[Issue #901](https://github.com/Aiddoo/Aido-platform/issues/901)은 OAuth endpoint 9개를
직접 UseCase로 옮긴다. 기존 Registry와 4개 vendor Adapter를 재사용하고 OAuth Workflow를
제거한다. `LinkOAuthIdentity`는 계정 생성·감사·충돌 매핑만 공유하며, Token/Code endpoint가
UOW·사용자 잠금·커밋 후 캐시를 소유한다. Web Complete는 실제 Login UseCase를 호출한다.
코드 교환과 토큰 검증은 기존처럼 각 1회이며 지연 감소로 해석하지 않는다.

| 실제 Before                                                                         | 구현한 After                                                               | 검증                                                 |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------- |
| 같은 교환 코드 동시 2건 모두 성공, 토큰 2번 반환                                    | ORM CAS 승자 1건, 패자 USER_0602                                           | 실제 PG row lock·UPDATE waiters                      |
| 서로 다른 계정 2개 동시 해제 후 Account 0개·감사 2개                                | 사용자 잠금 후 Aggregate 판단, 성공 1건·USER_0610 1건·Account 1개·감사 1개 | 실제 PG 경쟁 및 Link/Unlink 공존                     |
| Link 감사 FK 오류 23503 후 Account는 rollback하지만 코드는 소비됨, 재시도 USER_0602 | 소비·계정·감사 같은 UOW, 실패 시 모두 rollback·같은 코드 재시도 성공       | 실제 PG SQL 오류                                     |
| verified email 자동 연동 후 기존 JWT의 /me가 provider 1개 반환                      | 실제 commit 후 프로필 cache 무효화, 기존·새 세션 모두 provider 2개         | 실제 HTTP 1개 Before 실패 5.77초 → After 통과 8.84초 |

교환 코드 Before·계정 해제 Before·Link 실패 Before 재현은 각각 1개 테스트, 5.93초·
5.88초·6.29초였다. 이는 경쟁 결과의 재현 시간이며 benchmark가 아니다. 기존 정상 성공의
REST 응답·메시지·오류 코드는 유지한다. Link의 후속 쓰기 실패 때 코드를 재사용할 수 있는
것은 부분 커밋을 수정한 의도한 차이다.

기존 사용자 잠금 SELECT 한 곳을 `findByIdForUpdate`와 `FOR NO KEY UPDATE`로 재사용한다.
현재 설치 ORM rc.14의 Collection·SelectQuery·AST 및 실제 프로젝트 타입에서 공개 SELECT
row lock API는 확인되지 않았다. SQL을 추가하거나 일반 잠금 프레임워크를 만들지 않는다.
[PostgreSQL 공식 잠금 표](https://www.postgresql.org/docs/16/explicit-locking.html#LOCKING-ROWS)에
맞춰 같은 User의 계정 변경을 직렬화하면서 FK의 KEY SHARE를 허용하며, 실제 PG에서 잠금
해제 전 감사 INSERT 완료와 기존 purge 1승자도 확인했다. Token/Code caller의 잠금 조회는
각 1회다. 잠금 비용·운영 처리량은 측정하지 않았으므로 성능 향상을 주장하지 않는다.

기존 NULL/빈 initiating actor, login mode NULL, token 선택 `idToken ?? accessToken`,
provider 목록 순서·null 필드, 상태·이메일 충돌 오류 우선순위를 보존한다. 토큰 검증 실패만
실패 LoginAttempt를 기록하고 업무 오류까지 catch하지 않는다. 신규 가입 commit·관리자 알림·
별도 로그인 commit 순서와 기존 복구 시각·fresh role 조회도 유지한다. SetPassword는 잠금
획득 후 사용자·credential 상태를 다시 확인한다.

기존 OAuth PG의 Nest 조립은 공용 auth factory 옵션으로 교체했다. 서비스가 정의됐는지만
보던 2개를 제거하고 남은 47개는 seed 50441로 통과했다(16.68초). 최초 실행 1개 실패는
Domain으로 이동한 예외를 ApplicationException 클래스만으로 비교한 테스트였다. 공개
USER_0610과 동일 메시지를 검증하도록 바꾸고 재실행했다. 신규 실제 PG와 기존 purge PG
16개는 seed 101(11.30초), LA 시간대 seed 202(9.97초)로 통과했다. 공용 factory의 cipher는
identity Stub이며 이 결과를 실제 암호화 성능·SDK 검증으로 주장하지 않는다.

전체 Unit 476 files / 2,864 tests(15.33초), Integration 47 files / 459 tests(145.57초),
E2E 34 files / 482 tests(261.13초)가 seed 50442 shuffle로 통과했다. workspace
lint·format·typecheck도 통과했다. Integration suite는 실제 PG 서비스로 실행했으며 기존 일부
Stub 기반 spec도 포함한다. 이번 경쟁·rollback 결과는 별도 실제 PG 10개로 검증했다.
잠금 helper도 native Promise.withResolvers로 정리한 뒤 10개를 seed 303으로 다시 확인했다
(7.15초). Unit 자동 연동 warm setup이 빠진 최초 2개 실패는 테스트 선언을 보완해 재실행했다.
새 script·package·schema·migration·Action job은 없다. 상위 단계는 여전히 4/18 완료다.

## 04e 설정·동의와 공유 조회 경계

[Issue #904](https://github.com/Aiddoo/Aido-platform/issues/904)의 직접 UseCase 14개를
named input·최소 Port로 정리했다. REST 응답 mapping은 Domain에서 Application read model로
옮기고, `UserPreferenceReader`가 원본 설정의 cache-aside·기본값·projection을 소유한다.
Notification은 Identity의 공개 Reader와 기존 batch capability를 사용하고 다른 Context의
캐시 key/TTL을 읽지 않는다. premium gate는 캐시 밖에서 요청마다 판정한다. 기존 enum·REST
15개 필드·locale 미노출·Date/null 표현·기본 push 경로별 값을 유지한다.

| 실제 Before                                                                     | 구현한 After                                               | 근거                                   |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------- |
| 설정 행이 없는 첫 weather 수정의 false·09:37·false·22:43가 defaults로 저장/응답 | create/upsert ORM mapping을 공유해 요청한 6개 값 저장/응답 | 실제 PG와 HTTP                         |
| warm UTC cache 뒤 timezone DB를 변경해도 GET은 UTC                              | Refresh/Upsert가 설정·활성 timezone cache 무효화           | 실제 PG·HTTP                           |
| 같은 날 전체 완료 동시 2건에서 milestone port 2회 호출                          | 최신 통계 재조회·streak 3필드 CAS·승자만 port 1회 호출     | 실제 PG UPDATE waiters                 |
| 타임존 저장 실패 뒤 같은 timezone의 다음 요청이 throttle로 생략                 | 실패한 현재 attempt만 삭제하고 다음 요청 재시도            | Before Unit expected2/actual1 → After2 |

Before 3개 PG 재현은 5.54초, After PG 10개는 seed 101(8.69초)과 미국 시간대 seed
202(16.09초)로 통과했다. 첫 PG 로딩 실패는 조립 중 public import 파일 누락으로, 연결
완료 후 재실행했다. 임의 sleep 대신 실제 row lock 대기자를 관찰했다. 부분 Preference와
Consent 동시 변경·실제 CLS provisioning rollback도 포함했다. milestone은 Port 호출 수이며
외부 push 발송의 exactly-once 보장을 뜻하지 않는다.

Streak VO와 Aggregate는 Date를 방어 복사하고 상태 3개만 복원한다. Todo의 DATE 컬럼은
로컬 달력 날짜를 UTC midnight로 표현한 계약을 유지한다. 처리 중 자정·DST의 반복 시각을
고정 clock으로 검증하며 DATE 범위를 실제 timestamp의 23/25시간 창으로 바꾸지 않는다.
동의 시각은 Application에서 한 번 결정하고 Repository가 해당 필드만 upsert한다. 서로
다른 마케팅/광고 push 동의·약관 필드는 보존한다.

ORM updateAndCount의 expected state 조건으로 경쟁을 처리하며 raw SQL·스키마 변경은
없다. 미사용 Preference.update·Consent.upsert/updateMarketingConsent와 구 mock factory,
중복 Mock DB Integration 8개를 제거했다. 중요한 행동은 상태 기반 Unit과 실제 PG로 검증한다.
원본 캐시의 in-flight 재적재·서로 다른 timezone 비동기 완료 순서까지 해결했다고 주장하지
않으며 운영 쿼리 지연·처리량·billed Actions 절감률은 미측정이다.

최종 전체 Unit 477 files / 2,866 tests(16.91초·seed 50455), Integration 47 files /
461 tests(132.12초·seed 50456), E2E 34 files / 486 tests(252.49초·seed 50454)가
shuffle로 통과했다. Integration은 PG 서비스와 기존 일부 Stub spec을 포함하며 이번 신규
정합성 10개는 실제 PG다. 최초 Integration은 큐 harness의 공개 Reader token 등록 누락으로
1 suite 실패·6 skip이었다. 조립 후 해당 실제 pg-boss 6개(19.07초)와 전체를 다시 통과했다.
HTTP 비동기 timezone 검증은 DB 저장만 기다리는 대신 다음 GET의 실제 변경 결과를 기다리도록
정리한 뒤 미국 시간대 seed 50456에서 14개를 재검증했다(10.01초). Notification Unit 최초
2개 실패는 상태 Stub이 입력을 복사하는데 원래 입력만 바꾼 fixture 오류로, 실제 locale 저장
메서드를 호출하도록 수정했다. workspace lint·format·typecheck 통과. 추가 script·package·
schema·migration·Action job은 없다. 상위 5/18 완료, Billing부터 13단계가 남는다.

## 12 Weather 공급자 확장 계획

현재 한국 API와 공개 REST 응답을 유지한다. Application은 공급자 Port의 정규화된 날씨 결과만
사용하고, Infrastructure Adapter가 HTTP 요청·공급자 응답 검증·단위/시간대 변환을 맡는다.
언어·timezone·IP를 국가로 추정하지 않고 검증된 위치 정보로 지원 여부와 공급자를 결정한다.
한국 격자 변환은 한국 Adapter가
소유한다. 해외 공급자를 등록할 때 기존 유즈케이스와 알림 정책을 복제하지 않는다.

기존 날씨 타입·좌표 Value Object·HTTP client·fixture를 먼저 재사용한다. 공급자 공통 cache key에는
공급자 구분과 위치·예보 기준 시각을 포함하되, 기존 키 변경은 호환 전환 검증 후 결정한다.
미지원 지역·timeout·부분 예보·잘못된 단위/시각·중복 요청·공급자별 응답을 fixture HTTP와
동일한 계약 테스트로 검증한다. 해외 API는 실제 선택·설정 전까지 구현하거나 지원한다고 표시하지 않는다.

현재 공용 좌표/REST와 UserLocation의 필수 grid 필드는 한국 범위에 묶여 있다. 해외 Adapter
추가만으로 전체 경계가 확장되는 상태가 아니므로, 지역별 위치 검증·저장 모델·Notification/AI
소비자·cache address도 함께 확인한다. 한국 serialization/TTL을 먼저 유지하고 공급자별
opaque location key와 target local date·forecast revision을 cache address에 분리한다.
한국 정리와 실제 해외 API 활성화/데이터 전환은 별도 검증 단계로 다룬다.

날짜 간 hourly 병합·0°C 결측 판정·프로세스 TZ 의존·latest fallback 날짜 혼합은 현재 정적
검토 후보다. 실제 fixture로 재현 후 개선하며, 후보만으로 확인된 버그나 측정된 성능 개선이라고
기록하지 않는다. 설치 HTTP client의 인스턴스별 fetch 주입과 기존 codec·테스트 도구를 재사용해
한국/해외 공급자가 같은 normalized domain 결과를 반환하는 계약을 검증한다.

## 05 Billing 구독 상태 전이와 성공 처리 원장

[Issue #906](https://github.com/Aiddoo/Aido-platform/issues/906)에서 구독 Aggregate의 생성·복원·
갱신·취소·환불·만료·상품 변경·기간 연장을 명명된 행동으로 정리했다. Vendor payload의
시각 검증은 Application mapper, 권한 보존 기간 판단은 순수 Domain policy가 소유한다.
Controller는 `execute({ body })`를 호출하고 기존 composition factory가 최소 Port를 조립한다.

Webhook 성공 원장 `(provider, eventId)`의 compound PK와 native ORM conflict-skip claim을
Subscription/User 쓰기와 같은 transaction에 넣었다. 기존 Redis appUserId 잠금은 유지하고,
공개 User mutation capability로 canonical User 행 잠금을 재사용해 alias가 다른 동시 요청도
직렬화한다. 행 잠금의 기존 SQL을 재사용했으며 새로운 생산 raw SQL은 추가하지 않았다.
원장은 성공 처리 이력이다. 실패한 payload를 durable queue에 접수하는 기능은 아니며,
업무 처리 실패의 기존 HTTP 200·보고 계약을 유지한다. 잠금 경합은 기존 1605/429다.

실제 PostgreSQL에서 다음 오류를 수정 전 재현했다.

- 만료 A → 갱신 B → 동일 A 재전송, 또는 더 오래된 기간의 새 만료 이벤트가 현재 사용자를
  `FREE`로 돌렸다. 2 tests 실패, 6.77초. 원장과 Aggregate의 과거 기간 no-op으로 보호한다.
- 서로 다른 체인 A/B에서 과거 A의 만료·환불이 유효한 B를 남겨두고 사용자 권한을 해제했다.
  같은 실제 PG fixture에서 수정 전 2 tests 실패(4.96초) → 수정 후 2 tests 통과(6.17초).
  잠금 안에서 exact User PK를 다시 읽고 다른 체인의 최대 유효 만료일을 조회한다. 기존
  `ACTIVE` 권한만 `min(현재 만료일, 다른 체인의 만료일)`까지 보존하며 기존 무료·취소 상태를
  자동 활성화하지 않는다. 다른 사용자·환불/만료된 체인·현재 체인·이미 지난 기간은 제외한다.

과거 기간 없는 만료와 현재 기간의 만료는 기존 의미를 유지한다. RevenueCat의
`event_timestamp_ms`는 이벤트 생성 시각이므로 모든 업무 전이에 공통 정렬 기준으로 사용하지
않는다. 과거 갱신/연장 등 모든 종류의 역순 이벤트를 해결했다고 확대하지 않는다.

`SubscriptionEventReceipt`는 별도 payload·User FK 없이 provider/id/type/processedAt만 보관한다.
Migration graph는 기존 `3b9e2226…` → `d80a48c1…`의 additive table 생성 1건이다. 기존 구독과
`lastProcessedEventId`를 보존하며 구 이력 전체의 ID·정확한 처리 시각을 만들어내지 않는다.
독립 DB에서 이전 계약으로 데이터를 저장하고 migration한 뒤, 이전 ORM으로 읽기·쓰기와
새 ORM으로 읽기·원장 쓰기를 검증했다(1 test, 4.61초). 이 검증은 이전 runtime 호환성이고
이전 migration graph로 자동 역방향 DDL rollback이 가능하다는 보장은 아니다.

구독 캐시는 Identity profile/Access entitlement의 공개 invalidation capability로 연결한다.
기존 key·TTL과 commit 이후 순서를 유지한다. 실제 HTTP에서 같은 JWT의 warm profile과
entitlement cache가 구매·환불·늦은 만료 뒤 현재 권한을 반영하는지 검증했다. Authorization의
Bearer/raw secret, 잘못된 인증 401, malformed payload 200, 실제 잠금 429와 해제 후 같은
이벤트 재시도까지 7 tests 통과(6.43초, seed 50522).

조회 수가 chain 수에 따라 증가하는 N+1은 추가하지 않았다. FREE/CANCELLED 하향 전이는
fresh User와 최대 유효 만료일을 조회하는 bounded SELECT 2개를 추가한다. positive 전이에
이 추가 조회는 없다. 처리 원장 claim 비용도 추가되므로 이 정합성 개선을 쿼리 수 절감이나
운영 성능 향상으로 보고하지 않는다. latency·처리량·billed Actions 절감률은 미측정이다.

최종 검증 결과:

- 전체 Unit: 481 files / 2,918 tests, 16.88초, seed 50523. 전달-only Controller 2개와 Mock DB 구독 Integration 8개를 제거하고 상태·실제 DB 검증으로 대체했다.
- 전체 Integration: 48 files / 471 tests, 170.78초, seed 50523. 기존 Stub spec도 포함하는 전체 project 수다. 신규 Billing 17개와 migration 호환 1개는 실제 PG에서 실행했다.
- 전체 E2E: 35 files / 493 tests, 256.37초, seed 50523. 구 앱 계약 fixture와 OpenAPI snapshot 변경 없음.
- Billing Unit: 8 files / 94 tests, 882ms, seed 50517. Billing 실제 PG: 17 tests, 10.34초, seed 303.
- HTTP E2E는 America/Los_Angeles·seed 50524에서도 7 tests 통과(9.64초). Date만 고정하고 네트워크 timer는 실제로 실행했다.
- Workspace lint·format·typecheck 통과. 첫 새 HTTP helper 타입 오류와 신규 CLI migration의 포맷 실패는 입력 타입 및 Oxfmt·공식 self-emit으로 수정했다.

운영 latency·처리량·공통 cache in-flight fill race·전체 이전 이미지 rollback은 검증 범위가 아니다.
새로운 실행 script·패키지·Action job은 추가하지 않았다. 상위 6/18 검증 완료,
06–17의 12단계가 남았다. commit/Stack PR 게시를 진행하며 운영 배포·merge는 하지 않았다.

## 06 Access 권한·AI Quota 정합성

[Issue #908](https://github.com/Aiddoo/Aido-platform/issues/908)의 구현이다.
Entitlement 정책과 AI Quota를 Access가 소유하고, AI는 consumer-owned `read/reserve/release`
capability를 사용한다. Resource 소유권·공개 범위·친구 관계는 각 Domain이 판단한다.
일반 ABAC framework나 상태 없는 조회 Aggregate를 추가하지 않았다.

| 실제 PostgreSQL Before                                    | After                                                         |
| --------------------------------------------------------- | ------------------------------------------------------------- |
| 사용량 4/한도 5에서 동시 요청 2개가 모두 성공해 count 6   | User 잠금 뒤 fresh 상태를 판정해 1개 성공, count 5            |
| 새달 동시 요청 2개가 초기화 값을 덮어 count 1             | 초기화·예약을 직렬화해 count 2                                |
| 이전 달 요청의 늦은 실패가 새달 성공 count 1을 0으로 차감 | 예약 period와 현재 period가 다르면 보상하지 않아 count 1 유지 |

같은 세 Before는 기존 Meter·Repository·CLS와 실제 행 잠금 대기에서 재현했다
(3 tests 실패, 6.71초). 수정 후 신규 실제 PG 10개는 seed 606에서 8.53초,
seed 607·America/Los_Angeles에서 8.16초에 통과했다. 외부 AI HTTP는 호출하지 않았다.
fresh ADMIN/구독 한도, User별 잠금 독립성, outer UoW rollback, 삭제된 User·0 사용량도 검증했다.

Quota Aggregate는 월별 사용량·예약·보상·Date 방어 복사를 소유한다. Repository는 한 번의
SELECT로 role/status/count/resetAt를 읽고 native ORM `updateAndCount`로 저장한다.
기존 증감 counter raw SQL 두 곳을 제거했다. canonical User lock과 fresh 조회 비용이 있으므로
이 변경을 쿼리 수 절감이나 운영 성능 향상으로 보고하지 않는다. AI network는 transaction 밖에 있다.

예약 실패는 기존 오류 우선순위를 보존한다. category 조회와 prompt 생성 실패도 사용량을 보상하며,
category 오류를 AI 출력 오류로 변환하지 않는다. 공급자·출력 오류는 기존 1301/1302를 유지한다.
보상 실패는 구조화 로그로 남기고 원오류를 유지한다. 성공 요청은 기존처럼 사용량을 유지한다.
period ticket은 durable 예약 원장·중복 release 방지·worker crash 복구·exactly-once를 보장하지 않는다.

KST 3/1·5/1 00:00의 다음 리셋이 현재 월초를 반환하던 오류도 수정했다. 월 시작을 KST에서
계산한 뒤 다음 월로 이동한다. 기존 period 표현(예: `2026-M04`)과 REST `used/limit/resetsAt`,
AI 응답 envelope·오류 코드·key·TTL·한도를 유지한다. 새 HTTP 경쟁·실패·월경계·stale entitlement
6 tests는 seed 50608에서 7.62초에 통과했다.

타 Context는 공개 Reader token과 명시적인 AccessModule import로 연결한다. 전역 Module,
구현 Service deep import, AI Meter·usage Repository·period helper·표시용 VO 및 전달-only
Controller Unit 검증을 제거하고 fixture/Stub·실제 PG·HTTP 검증으로 대체했다.
AI parsing 로그 key를 한곳에 모으고 원문 제목·provider 메시지를 운영 로그에서 제거했다.

전체 Integration에서 Prisma 8 SDK가 commit SQL 오류를 RuntimeError의 `cause`로 감싸는
경우 기존 판별기가 SQLSTATE 40001을 놓치는 버그를 발견했다. Error cause만 순환 안전하게
탐색하고 SQLSTATE·constraint를 같은 normalized node에서 읽도록 수정했다. retry 횟수와
timeout은 변경하지 않았다. 실제 Serializable commit 충돌 1개가 seed 50618에서 통과했다
(17.03초). 오류 helper·HTTP filter 45개와 기존 push rate limiter 실제 PG 3개도 통과했다.

첫 전체 회귀 실패도 기록한다. Reader token을 등록하지 않은 테스트 harness는 실제 동시성
14개 재실행으로 수정했다. Fake AI는 강제 타입 변환 대신 요청 schema로 응답을 검증한다.
기존 메모 fixture 4개 항목의 필수 categoryId 누락을 보완한 후 기존 request category fallback과
assertion을 유지한 AI HTTP 36개가 통과했다(57.38초). 공개 schema·구 앱 fixture·OpenAPI
snapshot을 완화하지 않았다.

최종 전체 검증은 shuffle seed 50619로 통과했다.

- Unit: 482 files / 2,950 tests, 23.19초.
- Integration: 50 files / 482 tests, 211.52초. 기존 Stub spec도 포함하며 신규 경쟁 검증은 실제 PG다.
- E2E: 36 files / 499 tests, 316.87초. 구 앱 fixture와 OpenAPI gate를 포함한다.
- Workspace lint·format·typecheck 통과. commit hook에서 build를 검증한 뒤 Stack PR를 게시한다.

실행 시간은 테스트 조건의 기록이며 운영 성능 비교가 아니다. 상위 7/18 구현·검증 완료,
07–17의 11단계가 남았다. merge·운영 배포는 하지 않았다.
신규 schema·migration·실행 script·패키지·Action job은 없다. 공통 cache in-flight fill race,
운영 latency·CPU/RSS·billed Actions 절감률은 검증 범위가 아니다.

## 07 Planning 상태·일정·동시 변경

[Issue #910](https://github.com/Aiddoo/Aido-platform/issues/910)의 구현이다. Todo·TodoItem·
Category의 복원과 상태 전이는 Domain이 소유하고, endpoint UseCase는 최소 Port와 UoW를
사용한다. 읽기 endpoint도 직접 UseCase로 연결한다. 외부 Context는 공개 Reader·Creator·
Provisioner·CacheInvalidator capability를 사용하며 내부 UseCase나 Seeder를 주입하지 않는다.

| 동일 조건의 실제 Before                                       | After                                                                         |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 항목 19개에서 동시 추가 2개가 성공해 21개·sortOrder 중복      | Todo 잠금 뒤 fresh 상태를 판정해 한도 20·서로 다른 정렬 값 유지               |
| 미완료 Todo 동시 완료가 publisher event 2개를 생성            | 상태 전이와 publisher event 1개                                               |
| 시간만 PATCH는 400, 제목+시간 PATCH는 시간 변경 누락          | Application에서 기존 날짜+입력 시간을 조합해 두 변경 반영                     |
| 입력 Date/props alias, 잘못된 Category color로 부분 상태 변경 | 방어 복사와 전체 검증 후 전이                                                 |
| Node KST/DB UTC에서 자동 updatedAt이 9시간 이동               | 공개 SDK middleware에서 timestamp-without-timezone Date 바인딩을 UTC로 정규화 |

PG 경쟁 Before는 2개 실패(7.95초, seed 50702), LA에서도 동일 실패(11.48초, seed 50703)했다.
실제 부모 행 잠금의 INSERT/UPDATE 대기를 관찰했으며 push/queue delivery 중복을 측정한 것은 아니다.
동일 HTTP Before 4개 중 2개 실패(13.03초, seed 50713) → After 4개 통과(7.21초, seed 50714).
Domain Before 8개 중 4개 실패를 재현했고 월말·윤년·기존 DST 동작을 유지했다.

14개 Todo 쓰기는 기존 MutationLockPort로 필요한 key 배열을 한 번 획득한 뒤 같은 UoW에서
조회·전이·저장한다. 소유권 오류 우선순위와 commit→cache→event→readback 순서를 보존했다.
전체 PATCH의 category 한도와 완료 취소 한도를 새로 강화하지 않았다. Category 삭제와 정렬의
복수 행 변경도 같은 keyspace를 사용한다. Policy 파일을 `.policy.ts`로 통일하고 중복 barrel,
전달-only TodoRowRepository, Controller forwarding Unit과 미사용 Mock Repository를 제거했다.

### 실제 SQL 수

기준 revision `1f70336a`와 같은 fixture를 사용하고 공개 SDK `afterQuery/afterExecute`에서
실제 driver 실행을 관찰했다. fixture 준비·검증과 TX 제어는 제외하고 신규 잠금 SQL은 포함했다.

| 경로                          | Before 전체 SQL | After 전체 SQL | After 구성              |
| ----------------------------- | --------------- | -------------- | ----------------------- |
| TodoItem 3개 재정렬           | 8               | 6              | ORM 5 + advisory lock 1 |
| 반복 Todo 3개 × item 2개 생성 | 9               | 7              | ORM 6 + advisory lock 1 |

단건 ORM `updateAndCount/deleteAndCount`로 불필요한 PK 사전 조회를 제거하고 반복 생성은
native `createAll` 반환 결과와 item 일괄 삽입을 사용한다. 기존 es-toolkit `groupBy/sortBy`를
재사용한다. 원자적 정렬 산술과 잠금 SQL은 ORM 동등 기능을 확인할 수 없어 유지한다.
실제 PG 8개는 seed 70707·America/Los_Angeles에서 통과했다(10.05초).
조회 N+1·운영 p50/p95·CPU/RSS·처리량 개선률은 이 수치로 추정하지 않는다.

### DB timestamp 보존

Prisma 8의 기존 `update`와 새 `updateAndCount` 모두에서 KST Node/UTC DB의 자동 Date
바인딩 오류를 재현했다. 전역 pg defaults나 SDK 파일을 수정하지 않는다. 공개 SqlMiddleware의
`pg/timestamp-string@1` codec Date만 UTC 문자열로 변환하고 DATE·timestamptz·null·명시 문자열은
보존한다. 운영·테스트 client factory에 동일 middleware를 등록했다. 동일 Before 2개는
수정 후 2개 통과(3.45초, seed 70709)했고 UTC/KST/LA·단건/transaction/bulk·밀리초·다른 codec
9개도 통과했다(5.18초, seed 70708). 쿼리 수 6/7도 middleware 적용 후 동일했다.

### 최종 검증

- 전체 Unit: 480 files / 2,923 tests, 21.07초, shuffle seed 70720.
- 전체 Integration: 52 files / 484 tests, 196.56초, 같은 seed. 기존 Stub spec도 포함하며 신규 정합성 검증은 실제 PG다.
- 전체 E2E: 37 files / 505 tests, 294.46초, 같은 seed. 고정 구 앱·OpenAPI 계약 fixture 변경 없음.
- Todo Unit 19 files / 73 tests와 기존 Todo HTTP + 새 시간 PATCH 64 tests 통과. Unit은 state Stub·독립 REST fixture·실제 pagination을 사용한다.
- Category 실제 PG 9개: 권한·부분 PATCH·동시 변경·unique 오류·삭제 이동·outer rollback·한도·Seeder rollback 통과.
- Workspace lint·format·typecheck 통과. commit hook workspace build 4/4 통과(8.632초). 커밋 `fe5e8848`로 보존했다. GitHub push 오류로 Draft Stack PR 게시를 재시도 중이다.

최초 PG fixture의 명시 ID와 sequence 충돌은 자동 ID로 수정했다. 중복 read provider 등록은
검토에서 제거했으며 assertion·schema·retry·timeout을 완화하지 않았다. Date만 고정하고
DB/socket timer는 실제 실행한다. 테스트 시간은 성능 benchmark가 아니고 유한한 실행으로
flake 부재를 보장하지 않는다. 신규 schema·migration·실행 script·패키지·Action job은 없다.
상위 8/18 구현·검증 완료, Social부터 10단계가 남았다. merge·운영 배포는 하지 않았다.

## 08 Social 상태·동시 요청 정합성

Planning `fe5e8848` 위의 구현이다. 기존 Friendship·Cheer·Nudge·Reminder Aggregate/VO와
도메인 정책을 재사용한다. 친구 읽기4개·응원/넛지 읽기9개를 endpoint별 직접 UseCase로 옮기고
named readonly input·최소 Port·explicit null/undefined·구조화 event log를 사용한다.
Composition Root는 `SocialFriendsModule/SocialCheersModule/SocialNudgesModule`로 명명하고
외부 Context는 공개 `FOLLOW_READER` token과 최소 Reader capability로 연결한다.

| 실제 PostgreSQL Before                                                | After                                                 |
| --------------------------------------------------------------------- | ----------------------------------------------------- |
| 동일 PENDING 요청 동시 수락 2성공·알림 호출4회                        | 1성공·1 FOLLOW0903, 알림 호출2회·양방향 관계 각1개    |
| 서로 다른 requester 요청 동시 수락 sortOrder[0,0]                     | 둘 다 성공, sortOrder[0,1]                            |
| 겹치는 UTC/Seoul 일일 window에서 응원·넛지 기존2회 뒤 동시2성공→used4 | sender별 quota 잠금으로 각각1성공·1기존한도오류→used3 |

실제 row/advisory lock 대기를 관찰했으며 Before에서 기존 잠금을 제거하지 않았다. 알림은
좁은 no-network Port Stub의 호출 수로 측정했고 실제 push 전달 횟수 측정은 아니다.
Friends Before 3개 중2실패·1통과(5.62초, seed80801) → After3개 통과(3.46초, seed80803·서울;
3.58초, seed80804·LA). Cheers/Nudges Before6개 중2실패·4통과(15.19초, seed80801·LA;
12.55초, seed80802·서울) → After9개 통과(9.21초, seed80807·서울).

친구 변경은 pair와 양측 list key를 한 번 정렬 획득한 뒤 fresh 관계·한도·정렬을 조회한다.
Send의 self→한도→target→existing 오류 우선순위와 수락/자동수락의 서로 다른 cache·알림·
milestone 순서를 보존했다. Accept에 새 MAX 검사를 추가하거나 차단 기능을 만들지 않았다.
응원·넛지의 요청 timezone 날짜 window·pair cooldown·전송 후 알림과 답장/감사의 같은 UoW
outbox·실패 격리는 유지했다. 날짜별 잠금 helper와 미사용 countToday API를 제거했다.
새 sender quota key와 이전 버전의 mixed rollout은 서로 다른 timezone 간 상호 잠금을
보장하지 않으므로 배포 전제로 검토한다. 개인정보/history 정책은 변경하지 않았다.

### 실제 SQL 수

같은 fixture·공개 SDK `afterQuery/afterExecute` driver hook을 사용했다. fixture 준비/검증과
TX 제어를 제외한다. parent revision `fe5e8848`의 맞팔 판정도 별도 실제 PG로 재측정했다.

| 경로                      | Before | After |
| ------------------------- | ------ | ----- |
| 단건 응원 읽음            | 3      | 2     |
| 맞팔 판정                 | 2      | 1     |
| profile 포함 응원3행 목록 | 1      | 1     |

native `updateAndCount/updateAll/deleteAndCount`로 불필요한 PK 사전 조회를 줄이며 Domain
반환 행과 relation projection을 유지한다. 검색 count는 ORM aggregate와 relation predicate로
바꾸고 기존 ILIKE fragment를 재사용한다. weighted rank·keyset 검색 SQL과 원자적 정렬 산술은
동등한 ORM 표면을 확인하지 못해 유지했다. nullable profile·이름/태그·Unicode·wildcard·비활성/
탈퇴 제외·self 상태를 실제 PG로 검증했다. 목록은 이미 N+1이 없었으며 제거했다고 쓰지 않는다.

### 검증과 테스트 정리

- Social Application: 30 files / 112 tests, 1.37초, seed50816. Map 기반 상태 Stub·기존 fixture·실제 pagination을 사용한다.
- Domain/Repository: 15 files / 65 tests, 714ms, seed80809.
- 실제 mutation-lock 기존 회귀14개: 14.35초, seed50820. 공개 Reader Port와 named timezone input으로 harness를 연결한다.
- 기존 Social HTTP76개 assertion·schema·timeout 변경 없음. 새 동시 수락·정렬·소유권/noop HTTP2개는 10.96초(seed50819)에 통과했다.
- 중복 Mock DB Integration3파일59개(Follow18/Cheer18/Nudge23), 전달-only Controller spec3개, 미사용 Repository mock3개를 제거했다. 업무 분기는 Unit 상태·실제 PG·HTTP로 검증한다.

최초 신규 HTTP1개는 테스트에서 collection.count()를 직접 호출해 실패했다. 공식 aggregate로
교정하고 같은 DB count=1 assertion을 유지했다. null 비교를 정리하던 중 잘못된 assignment
구문은 되돌리고 전체 Domain 검증을 통과했다. 새 fixture 타입은 union으로 명시하고 강제 변환을
추가하지 않았다. 가짜 UoW의 rollback 증명 표현을 제거했으며 실제 Nudge rollback HTTP는 유지했다.

최종 전체 검증은 shuffle seed80820으로 통과했다.

- Unit: 489 files / 2,928 tests, 18.11초.
- Integration: 51 files / 437 tests, 183.18초. 기존 Stub spec도 포함하며 새 경쟁 검증은 실제 PG다.
- E2E: 38 files / 507 tests, 274.94초. 고정 구 앱·OpenAPI 계약 fixture 변경 없음.
- Workspace lint·format·typecheck 통과. commit hook workspace build 4/4 통과(7.938초, 3 tasks cached).

상위 9/18 구현·검증 완료, Notes부터 9단계가 남았다. Planning/Social Draft PR #912/#913을
Stack으로 게시했고 담당자·리뷰 Labels·실제 측정 근거를 기록했다.
신규 schema·migration·패키지·실행 script·Action job은
없다. 운영 latency·CPU/RSS·billed Actions 개선률, cache in-flight 경쟁 해결·exactly-once를
주장하지 않는다. merge·배포는 하지 않았다.

## 09 Notes 사전 재현

구현 전 기존 CreateMemo·PrismaMemoRepository·native UoW에서
메모19개 뒤 동시 생성2개가 모두 성공해21개·sortOrder19 중복을 실제 PostgreSQL로 재현했다.
MEMO_MAX20을 기대한 동일 테스트1개가 실패했다(3.74초, seed90901·America/Los_Angeles).
User 행 잠금에서 실제 INSERT 대기2개를 관찰했고 임의 sleep·외부 network 없이 실행했다.
테스트 DB 잔여0개를 확인했다. transaction만으로 count→insert 경쟁이 막히지 않는 근거이며
09단계에서 기존 한도·정렬·오류를 지키는 잠금과 실제 After 검증을 적용한다.

같은 source 메모 동시 재정렬도 실제 PG에서 2성공·sortOrder[2,0,0]을 재현했다.
3개 중2통과·1실패(5.03초, seed90903·LA; 3.85초, seed90904·서울). 내용 수정3SQL,
목록1SQL/커서목록2SQL, 상대 재정렬5SQL을 같은 driver hook에서 관찰했다.

같은 Memo의 두 HTTP 변환은201·400(SYS0002), Todo2개·Memo삭제였다. 실제 Memo 삭제
대기2개를 관찰했다. 후속 invalid category의 일괄 변환은404·첫Todo1개·Memo유지를
검증했으며 기존 Swagger의 부분 성공 계약이다. 2개 중1실패·1통과(5.71초, seed90902).
임의로 일괄 실패를 전부 rollback하는 계약으로 바꾸지 않는다. native tx.execute와 PostgreSQL
SAVEPOINT의 같은 연결 동작은 실제2개 테스트·pool.max1에서 확인했다(3.20초, seed90904).
이 사전 조사는 After 검증과 구분하며 자신이 만든 임시 테스트 DB를 정리했다.

## 09 Notes 구현과 실제 After

[Issue #914](https://github.com/Aiddoo/Aido-platform/issues/914)의 구현이다. Memo Aggregate는
복원·내용/고정 상태 전이·Date 방어 복사 snapshot을 소유하고 REST 날짜 직렬화는 Application
read-model mapper가 소유한다. 기존 입력 Date 복사는 이미 있었으므로 새 alias 버그 수정으로
표기하지 않는다. 정책 위치/접미사와 NotesMemosModule 명명을 통일하고 10 endpoint를 직접
UseCase와 최소 Port로 연결한다. 전달 adapter·중복 barrel·미사용 Repository mock·Controller
전달 Unit을 제거했다. SQL 정렬 산술은 기존 native builder를 유지한다.

| 같은 실제 PostgreSQL/HTTP Before            | After                                                          |
| ------------------------------------------- | -------------------------------------------------------------- |
| 메모19개 뒤 동시2생성→21개·sortOrder 중복   | 1성공·1 MEMO2003, 20개·정렬 값 중복 없음                       |
| 같은 메모 동시 재정렬→sortOrder[2,0,0]      | 두 요청 성공, sortOrder[2,0,1]                                 |
| 같은 메모 동시 변환→Todo2개·201/400 SYS0002 | Todo1개·201/404 MEMO2001·Memo삭제                              |
| batch 후속 category 오류→첫Todo1개·Memo유지 | 같은404 TODO_CATEGORY0851·첫Todo1개·Memo유지, 후속 항목 미실행 |

사용자 Memo 정렬 key와 단건 key를 기존 MutationLockPort에서 한 번 정렬 획득하고 같은
UoW에서 fresh 한도·소유권·상태를 읽는다. 다른 사용자의 cursor anchor는 자기 페이지 기준을
변경할 수 없게 소유 조건을 추가했다. 종전에도 타인 행을 반환하지는 않았다. 정상 본인 cursor,
존재하지 않는 cursor의 빈 페이지·고정 우선·동률·size+1 의미는 보존한다.

### 생성과 부분 성공 경계

Planning의 TodoCreationWriter/Effects는 기존 생성 저장·후속 작업을 분리하여 일반 생성과
Notes의 공개 STAGED_TODO_CREATOR capability가 재사용한다. 일반 생성은 UoW 밖 검증→
잠금/DB 쓰기→직접 await cache2→event→readback 및 실패 전파를 유지한다. 메모 단건 변환은
생성/삭제를 하나의 UoW로 묶고 불필요한 savepoint를 사용하지 않는다.

batch 변환은 성공한 앞 항목을 유지해야 한다. 항목별 동일 연결 savepoint로 실패 항목의
쓰기를 되돌리고 callback에서 failed outcome을 반환한다. 바깥 UoW가 성공 prefix를 커밋하고
등록된 후속 작업을 입력 순서로 실행한 뒤 원래 오류를 던진다. 마지막 메모 삭제의 DB 실패는
바깥 UoW로 전파한다. blanket batch rollback이나 두 번째 연결을 사용하는 RequiresNew로
기존 부분 성공 의미를 바꾸지 않는다.

기존 after-commit registry를 재사용하고 성공한 savepoint의 callback만 그 바깥에서 등록한다.
실제 Redis Cache와 DomainEventPublisher의 실패 격리 의미는 유지한다. 각 항목의 후속 작업이
다음 DB 쓰기보다 먼저 실행되던 시점은 전체 prefix commit 뒤로 이동한다. 일반 생성의
throwing Port 오류는 여전히 전파한다. 실패 batch를 새 요청으로 재시도하면 이미 성공한
prefix가 다시 만들어질 수 있는 기존 의미는 남으며 durable idempotency/exactly-once를
주장하지 않는다.

Native CLS adapter의 공식 wrapWithNestedTransaction seam은 tx.execute(plan)으로 SAVEPOINT,
ROLLBACK TO, RELEASE를 같은 연결에 실행한다. 내부 UUID로만 식별자를 만들고 외부 값을
SQL에 삽입하지 않는다. SavepointRunner는 활성 UoW와 순차 실행을 요구한다. pool.max1
실제 PG 3개가 SQL23503/Application 실패 뒤 prefix와 후속 항목 commit·같은 PID·작업 FIFO,
바깥 실패의 전체 rollback/후속 작업 미실행을 검증했다(3.87초, seed90907). 첫 검증의
orderBy 객체 사용 오류는 공식 selector로 교정하고 assertion을 유지했다.

공식 근거: [Nest CLS custom transaction adapter](https://papooch.github.io/nestjs-cls/plugins/available-plugins/transactional),
[Prisma 8 runtime](https://github.com/prisma/orm/blob/v8.0.0-rc.14/skills/prisma-8/references/runtime.md),
[PostgreSQL SAVEPOINT](https://www.postgresql.org/docs/current/sql-savepoint.html).

### SQL과 검증

동일 driver hook에서 fixture/검증/TX 제어를 제외하고 신규 mutation lock을 포함해 측정했다.

| 경로               | Before 총 SQL | After 총 SQL | After 구성                          |
| ------------------ | ------------- | ------------ | ----------------------------------- |
| 내용 수정          | 3             | 3            | native ORM2 + 잠금1                 |
| 상대 재정렬        | 5             | 5            | native ORM3 + 산술 builder1 + 잠금1 |
| 목록 / cursor 목록 | 1 / 2         | 1 / 2        | 기존 페이지 조회 수 유지            |

native updateAll/deleteAndCount는 불필요한 PK 사전 조회를 제거했지만 잠금 비용을 포함한
총 SQL은 감소하지 않았다. 목록은 이미 N+1이 없었으며 제거했다고 쓰지 않는다. Batch는
성공 항목마다 SAVEPOINT/RELEASE 2개, 실패 항목에는 ROLLBACK TO가 추가된다. 이는 위 단건
측정과 구분한다. 실행 시간은 latency benchmark가 아니다.

실제 Notes PG11개는 LA·seed90911에서11.45초, 서울·seed90912에서10.21초에 통과했다.
NUL item의 SQL22021을 강제하는 fixture에서 Todo parent INSERT 두 statement 뒤 실패한
반복 group의 부모/항목은0, 성공 prefixTodo1/event1·Memo유지를 확인했다. 운영 DB나 새
trigger·constraint는 사용하지 않았다. Domain3files18tests(222ms), Application10files33tests,
기존 MemoHTTP38개 무수정+새 동시/부분/혼합 변환3개(27.81초, seed50904)도 통과했다.

기존 RedisMock 연결 정리 누락은 reset try/finally disconnect와 fail-open suite teardown으로
수정했다. 같은 기존20tests가 Before218ms/pass+listener warning, After292ms/pass+경고0였다.
경고는 07/06에도 존재했으며 Social/Notes runtime 버그로 표기하지 않는다. 테스트 시간 차이를
성능 개선률로 쓰지 않는다. Unit은 상태 Stub·기존 Builder·독립 응답 fixture·실제 pagination을
사용한다. Unit에서 physical rollback을 증명했다고 표현하지 않는다.

최종 전체 검증은 shuffle seed90920으로 통과했다.

- Unit: 489 files / 2,931 tests, 23.00초.
- Integration: 53 files / 451 tests, 317.31초. 기존 Stub spec도 포함하며 새 정합성 검증은 실제 PG다.
- E2E: 39 files / 510 tests, 406.64초. 기존 Memo38·고정 구 앱·OpenAPI 계약 fixture 변경 없음.
- Workspace lint·format·typecheck 통과. Date만 필요한 범위에서 고정하고 native DB/I/O timer는 실제 실행한다.

전체 실행 시간은 다른 프로세스와 DB/CPU를 공유한 테스트 시간이며 이전 단계와 비교해
서비스 latency 개선/회귀를 추정하지 않는다. 상위10/18 구현·검증 완료, Engagement부터
8단계가 남았다. 한국어 커밋85c429f3과 Draft PR #916으로 보존했다. commit hook typecheck5/5 cached(67ms), workspace build4/4(9.514초,3cached) 통과. Root 검증DB4개 잔여0을 확인했다. 새 schema·migration·패키지·실행 script·Action job은 없다.
배포·merge·전체 유저 영향0·운영 성능 개선률은 보장하지 않는다.

## 10 Engagement 구현과 실제 After

[Issue #915](https://github.com/Aiddoo/Aido-platform/issues/915)의 구현이다. 댓글 Aggregate의
복원·상태 전이와 Content/ThreadPlacement VO를 유지하고 영속 Record·권한 Policy·응답 mapper의
소유권을 분리했다. 8 endpoint는 순수 UseCase와 필요한 최소 Port를 직접 연결한다.
EngagementCommentsModule은 계정 삭제에 필요한 공개 cleanup token만 내보낸다. concrete
service 공개·미사용 barrel·Repository mock을 제거했다. REST route/status/Swagger와 기존
cursor 서명·페이지 정렬·익명 프로필 표시는 유지한다.

| 실제 Before                                                       | After                                                            |
| ----------------------------------------------------------------- | ---------------------------------------------------------------- |
| 좋아요 알림 실패 뒤 같은 요청 재시도에도 알림 시도1회·marker null | pending 상태를 fresh 조회하여 재시도, 좋아요 count1 유지         |
| 알림 대기 중 unlike/re-like 경쟁→알림 시도2회                     | 같은 댓글 잠금 아래 pending 재검사→알림1회                       |
| legacy writer와 unique 충돌 뒤 관계가 삭제돼도 댓글 저장 성공     | fallback UoW에서 fresh 권한 확인→TODO_0801·비공개 댓글 추가 없음 |
| grandchild focus size1→items3/index2/ancestors0                   | items1/index0/ancestors2                                         |
| 첫 후속 작업의 동기 throw→다음 작업 미실행·응답 실패              | 모든 작업을 Promise 경계에서 실행·각 실패 격리·구조화 로그       |

좋아요 자체를 먼저 커밋하고 후속 UoW에서 같은 댓글 잠금과 native ORM relation 조건으로
active/unnotified 상태를 확인한다. Notification·PushDispatch·outbox·marker는 이 UoW에
참여하고 외부 발행은 기존 after-commit registry를 사용한다. 실제 marker 시점에 FK23503을
발생시킨 검증은 staging 각1행→rollback 각0행·발행0·unread 무효화0을 확인했다. 원 좋아요는
active/count1/notified null로 보존되며 같은 요청 재시도 후 각1행·marker·발행1회였다.
marker updateAndCount가1행이 아니면 실패하여 알림만 커밋되는 상황을 방지한다.
외부 push exactly-once나 durable 요청 idempotency를 보장한다고 표현하지 않는다.

legacy unique replay 검증은 잠금을 사용하지 않는 writer와 현재 writer의 혼합 조건이다.
일반 현재 writer 두 요청의 경쟁과 구분한다. followup UoW에서 recipient/threadRoot를 fresh
조회하고 삭제·unlike 상태는 건너뛴다. 별도 ledger·두 번째 활성 연결·중복 queue framework는
추가하지 않았다. 후속 작업 로그는 정해진 event와 todoId/commentId/userId/errorType만 담는다.

### SQL과 검증

실제 driver hook에서 fixture·검증·TX 제어를 제외한 Repository/Reader 호출을 측정했다.

| 경로                   | Before SQL        | After SQL            |
| ---------------------- | ----------------- | -------------------- |
| Repository setLike     | 5                 | 4                    |
| Repository removeLike  | 6                 | 5                    |
| Overview size1 / size3 | 4 / 4             | 4 / 4                |
| Conversation 9개       | 3                 | 3                    |
| grandchild focus size1 | 3 (잘못된 items3) | 4 (items1·ancestor2) |
| owner TodoDetails      | 1                 | 1                    |

atomic counter의 기존 native SQL builder에 RETURNING을 추가하여 count 재조회를 제거했다.
새 pending relation 조회는1SQL이다. 전체 Like endpoint는 후속 UoW·잠금·staging 비용을 포함하므로
Repository의1SQL 절감을 endpoint 전체 감소로 쓰지 않는다. focus는 올바른 ancestor hydrate를
위한1SQL 증가다. 기존 일괄 작성자/좋아요 조회는 이미 N+1이 없었으며 제거했다고 쓰지 않는다.
recursive tree·window/keyset·원자 산술에 필요한 parameterized SQL builder는 유지한다.

실제 Before mutation3개는 모두 기대 실패했고 After3개는3.70초(seed101003)에 통과했다.
reader Before5개 중 focus1개가 실패했다(12.89초, seed101002·서울). helper 동기 throw는
별도의 순수 함수 Before이며 운영 cache가 실제로 동기 throw했다고 확대하지 않는다.

대상 검증은 Domain4files/24tests(178ms), Application9files/39tests(413ms), 실제 PG 신규9+
기존 conversation22+계정 purge4(21.79초, seed101015·LA), 기존 HTTP15개 무수정+신규2개
(20.06초, seed51003)에 통과했다. 테스트는 기존 Builder·독립 응답 fixture·상태 Port Stub을
사용하며 Stub이 DB rollback/tree/SQL/queue를 재구현하지 않는다. 초기 PG harness의 count
scalar 사용·token provider 누락과 HTTP enum 필드명 오류는 assertion을 유지하며 교정했다.
최종 전체 검증은 shuffle seed101020으로 통과했다.

- Unit: 489 files / 2,940 tests, 20.92초.
- Integration: 54 files / 460 tests, 205.07초.
- E2E: 40 files / 512 tests, 279.86초.
- Workspace lint·format·typecheck 통과. 고정 구 앱·OpenAPI 계약 fixture 변경 없음.
- Root 소유 전체 검사 DB2개 잔여0 확인.

실행 시간은 공유 CPU/DB의 테스트 기록이며 운영 latency 개선률이 아니다. 새 schema·migration·
패키지·실행 script·Action job은 없다. 상위11/18 구현·검증 완료, Insights부터7단계가 남았다.
한국어 커밋b32e9d6e와 Draft PR #918로 보존했다. commit hook typecheck5/5 cached(65ms), workspace build4/4(9.047초,3cached) 통과. merge·운영 배포는 하지 않았다.

## 11 Insights 구현과 실제 After

[Issue #917](https://github.com/Aiddoo/Aido-platform/issues/917)의 구현이다. Daily는 순수 집계
Policy와 readonly Record를 유지하고 의미 없는 Aggregate를 추가하지 않는다. Weekly의 영속
Record·집계 정책과 언어별 응답 mapper/catalog를 분리한다. ko/en은 공유 SupportedLocale를
사용하며 새로운 언어는 catalog에 추가한다. Date·색상 배열을 복사하여 원본 변경이 snapshot을
바꾸지 않게 한다. 기존 연속 주차·연도 전체 요약·반열림 날짜 범위 계산은 유지한다.

| 실제 HTTP Before                                                | After 대상 검증              |
| --------------------------------------------------------------- | ---------------------------- |
| warm Daily→category 색상 변경→이전 색상                         | 새 색상 반영                 |
| warm Daily→category 삭제·Todo 이동→이전 색상                    | 이동 대상 색상 반영          |
| 조회 aggregate를 지연→Todo 완료·무효화→이전 조회가 cache 재등록 | 다음 GET에서 fresh 완료값    |
| 2028-02-30 요청200·dateRange Feb30/데이터 Mar1                  | 400·정상 윤년 날짜 의미 유지 |

캐시 Before3개는 실제 native PG/HTTP/UoW/event/cache를 사용하고 aggregate 반환 시점만
Promise gate로 제어했다(10.53초, seed111001·LA). invalid DATE Before도 실제 HTTP200을
관찰했다(7.37초, seed111004·LA). DATE/ISO/DST 정상 baseline은 이미 통과했으며 날짜 계산
전체를 새로 고쳤다고 표현하지 않는다. Date·배열 alias Before는 순수 값 검증으로 구분한다.

Planning의 기존 CacheService와 generation namespace 방식을 재사용했다. Daily self/public
조회는 generation/value/generation을 읽고, 저장은 캡처한 generation namespace만 사용한다.
무효화 뒤 늦은 SET이 old key를 재생성해도 현재 조회에서는 보이지 않는다. generation 키
유실 시 UUID로 새 세대를 만들고 기존 v1 무효화 prefix와 세대 키를 공유한다. v1 data는 읽지
않으며 이전 인스턴스의 무효화가 세대를 끊는 경계를 검증했다. 값 TTL10분·세대1일이다.
새 Redis primitive·Lua·범용 cache framework·실행 script는 추가하지 않았다.

캐시 hit의 Redis GET은1→3회이며 miss에는 세대 초기화/저장 확인 비용이 있다. 이는 stale
refill 방지의 비용이다. Redis 장애의 기존 fail-open/TTL 의미는 유지하며 혼합 배포의 모든
이전 인스턴스 응답이나 강한 원자 CAS·운영 latency 개선을 보장하지 않는다.

카테고리 수정은 Aggregate의 변경 event, 삭제는 성공한 커밋 뒤 domain event를 발행한다.
기존 event publisher를 재사용하고 Insights는 기존 Todo7종+Category2종을 구독한다. 이미
커밋된 요청을 subscriber cache 실패 때문에 실패시키지 않으며 로그는 event/userId/errorType만
담는다. 요청 본문·원문 error·stack을 로그로 출력하지 않는다.

불가능한 날짜 검증은 공유 dateSchema를 재사용한다. 직접 dateSchema를 노출한 초기 시도는
OpenAPI format/pattern과 배포 클라이언트 fingerprint를 바꿔 계약3개가 실패했다. 기존 공개
pattern을 유지하고 내부 refine에서 dateSchema로 검사하도록 교정한 뒤 기존 OpenAPI와
1.7.x/1.8.2 계약4개가 통과했다(8.06초, seed111022). snapshot·배포 fixture는 변경하지 않았다.

Composition은 직접 factory와 InsightsDailyCompletionsModule/InsightsWeeklyAchievementsModule로
통일했다. Follow consumer-owned 최소 Port는 기존 FOLLOW_READER를 useExisting으로 연결하고
전달 adapter를 제거했다. Weekly writer도 token→기존 Upsert UseCase로 연결하여 전달 Access와
중복 barrel·Controller 전달 Unit·미사용 mock·Weekly Mock Integration을 제거했다.

### SQL과 대상 검증

동일 actual PG fixture/driver hook으로 TX 제어·fixture·검증 쿼리를 제외했다.

| 경로                                    | Before SQL | After SQL |
| --------------------------------------- | ---------- | --------- |
| Weekly cursor 목록+연도 전체 요약       | 3          | 2         |
| Weekly 직접 cursor Repository           | 2          | 1         |
| Weekly 일반 목록+요약                   | 2          | 2         |
| Daily 9Todo×3Category 집계              | 2          | 2         |
| Daily 빈 집계                           | 1          | 1         |
| Weekly 3행 upsert / 같은 key 3행 update | 3 / 3      | 3 / 3     |

Cursor의 같은 사용자·연도 anchor 존재 조건을 native ORM relation exists에 포함한다. 정상/
missing/타인/다른 연도/first week/무커서6경계와 정렬·size+1·반환 날짜를 실제 DB로 비교했다.
단순 week<cursor로 바꾸어 missing anchor의 빈 페이지 의미를 바꾸지 않는다. 원래 Daily는
일괄 집계라 N+1이 없었다. 현재 rc.14 native ORM에 bulk upsert API가 없어 기존 singleton ORM과
UoW를 유지하며 raw bulk SQL이나 SDK 재구현을 추가하지 않는다. 중복 input last-write와 두 번째
FK23503 실패 시 성공 prefix 전체 rollback을 실제 DB로 검증했다.

Domain/adapter4files34tests(233ms), Application/subscriber6files26tests, 실제 PG 신규7+
기존 Daily13(seed111011·서울12.51초, seed111012·LA12.96초), 기존 Daily HTTP19 무수정+
seeded Weekly8+새 cache/date4(seed111004·LA22.60초)가 통과했다. 환경 종속5초 assertion은
정확한31일/93Todo/48완료/8완료일 검증으로 바꾸고 SQL 예산은 별도로 검증한다. Unit Stub은
준비 집계/페이지/세대 상태만 보유하며 SQL·DB rollback·Redis 원자성을 모사하지 않는다.
최종 전체 shuffle seed111030 검증은 통과했다.

- Unit: 489 files / 2,945 tests, 23.37초.
- Integration: 54 files / 460 tests, 252.37초.
- E2E: 41 files / 518 tests, 316.10초.
- 공유 REST 계약: 2 files / 17 tests, 717ms.
- Workspace lint·format·typecheck 통과. 기존 OpenAPI·구 앱 fixture 무수정. Root 소유 DB4개 잔여0 확인.

테스트 시간은 공유 CPU/DB 실행 기록이며 운영 latency 개선률이 아니다. 상위12/18 구현·검증
완료, Weather부터6단계가 남았다. 새 migration·패키지·실행 script·Action job은 없다.
한국어 커밋·Draft PR로 보존하며 merge·운영 배포는 하지 않았다.

## AI 후속 요구와 검증 범위

현재 모델과 AI SDK·Zod를 유지하고 공식 공급자의 prompt/structured output 지침을 기준으로
파싱·메모·보고서·추천을 검증한다. provider/데이터 수집/순수 정책/언어별 prompt/HTTP 표시의
소유권을 분리한다. 새 locale을 추가할 때 endpoint UseCase에 언어 분기를 반복하지 않는다.

유료 추천은 생성·조회·수락의 권한을 일관되게 확인한다. 기존 Todo 기록에서 반복 행동과 실행
부담을 판단하고 제안 이유·요일·시간·작은 시작 단계를 제공한다. 기록이 적을 때 확신을 낮추고,
기록이 없을 때 개인 습관·관심사·생활 조건을 발명하지 않는다. 기존 사용자 수락 흐름을 유지하며
제안만으로 Todo를 자동 생성하지 않는다. 새로운 cold-start 표시/API가 필요하면 기존 앱의
응답 계약·구독 정책을 기준으로 범위를 먼저 정한다.

fixture/Stub의 결정적 검증과 실제 모델의 품질 평가를 구분한다. ko/en, 빈·적은·많은 기록,
반복/미완료/중복/잘못된 category·날짜, 공급자 실패·잘못된 structured output을 검증한다.
모델 응답은 schema 적합성 외에 사실 근거·언어·행동의 구체성·중복·수락 가능성을 평가한다.

공식 근거: [Gemini prompt 지침](https://ai.google.dev/gemini-api/docs/prompting-strategies),
[structured output](https://ai.google.dev/gemini-api/docs/structured-output).
신규 라이브러리는 기존 도구로 충족되지 않는 필요와 Stable·ESM·모델 호환성을 확인한 뒤 도입한다.
