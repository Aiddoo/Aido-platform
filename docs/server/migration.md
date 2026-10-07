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
- [ ] 04 Identity: 계정·세션·설정·동의·계정 생명주기
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
