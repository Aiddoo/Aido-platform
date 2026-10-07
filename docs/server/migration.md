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
- [ ] 07 Planning: 할 일·항목·카테고리·반복 일정
- [ ] 08 Social: 친구·응원·넛지
- [ ] 09 Notes: 메모와 전환
- [ ] 10 Engagement: 댓글·반응·대화·정리
- [ ] 11 Insights: 완료 집계·주간 달성·연속 기록
- [ ] 12 Weather: 위치·좌표·격자·공급자 Port·지역별 선택 정책·도메인 응답 정규화; 한국 API 유지, 해외 공급자는 동일 인터페이스로 추가
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
