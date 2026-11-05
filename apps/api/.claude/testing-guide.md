# 서버 테스트: 검증 범위 선택

테스트 종류와 완료 판단의 진입점이다. 공통 테스트 규칙(범위, GWT 한 줄, 한국어 제목, stub 우선)은 [루트 AGENTS](../../../AGENTS.md#공통-코드-규칙)에 있다. 작성할 테스트에 필요한 문서만 읽는다.

| 작업                                                         | 참고                                         |
| ------------------------------------------------------------ | -------------------------------------------- |
| 순수 Domain/Application, fixture·Stub, 공급자 Adapter의 wire | [unit-test.md](./unit-test.md)               |
| 실제 Module 조립, PostgreSQL transaction·경쟁 조건·migration | [integration-test.md](./integration-test.md) |
| HTTP validation·권한·응답·구 클라이언트 계약                 | [e2e-test.md](./e2e-test.md)                 |
| AI golden·fake model·live eval                               | [AI 평가](../../../docs/server/ai.md#평가)   |

## 무엇을 검증할지

변경으로 실패할 수 있는 사용자 동작이나 저장 정합성을 먼저 정한다. 테스트 개수나 피라미드 비율을 목표로 삼지 않는다.

| 위험                                                                 | 적합한 검증과 한계                                                                                      |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 값 검증, 상태 전이, 실제 입력에 근거한 판단                          | 순수 Unit. 결과·상태·실패를 검증한다.                                                                   |
| Application 분기, batch miss만 조회, retry·부수효과 순서             | 직접 생성 + 작은 Port Stub/Fake. callback UoW는 실제 rollback 증거가 아니다.                            |
| SQL 문장·파라미터 조립                                               | 가짜 pg Pool(`createFakeDatabase`, `renderSql`)로 본다. 실행 결과·constraint·동시성은 실제 PG에서 본다. |
| Module token·factory·cross-context capability 연결                   | 실제 Module을 조립한다. 동일 조립을 실행하는 HTTP/PG suite가 있다면 전달 전용 테스트를 중복하지 않는다. |
| row lock, atomic claim/counter, rollback, 중첩 Required, durable job | 실제 PostgreSQL Integration. 비동기 mock이나 임의 sleep으로 증명하지 않는다.                            |
| 외부 공급자 요청·헤더·retry·오류·SDK 출력 검증                       | 설치된 실제 SDK/Adapter + 고정 HTTP fixture. 실제 공급자 품질·SLA를 뜻하지 않는다.                      |
| route·validation·권한·status·raw/envelope·호환성                     | 실제 HTTP 및 필요한 OpenAPI·배포 fingerprint 계약.                                                      |

단순 Controller/UseCase 위임, 인스턴스 존재, 구현을 복사한 테스트는 새로 만들지 않는다. 호출 횟수·개인정보 비노출·쿼리 수 자체가 계약일 때만 spy를 쓴다.

기존 테스트는 그대로 둔다. mock을 일괄 stub으로 바꾸거나 형식 때문에 지우지 않는다. 코드를 지우며 테스트도 지울 때는 의미 있는 assertion을 옮긴다.

## 작업 중 실행과 최종 확인

1. 변경한 동작의 가장 작은 기존 suite를 돌린다. 공개 계약·SQL·worker 변경이면 그 위험을 다루는 HTTP/PG 범위를 더한다.
2. 실패를 고친 뒤 실패한 범위와 수정이 영향을 주는 범위만 다시 돌린다.
3. 넓은 구조 변경은 소스를 동결한 뒤 관련 전체 Unit·Integration·E2E와 lint·format·typecheck를 한 번 확인한다. 문서·저위험 수정은 링크·내용·관련 정적 검사로 끝낸다.

파일·seed·timezone·실행 수·결과를 남긴다. 수집 오류로 0개가 돈 결과를 회귀 결과와 구분한다. 통과만으로 운영 배포나 공급자 성능을 주장하지 않는다.

```sh
pnpm --filter @aido/server exec vitest run --project unit src/modules/notification/application/use-cases/delivery/reconcile-push-receipts.use-case.spec.ts
pnpm --filter @aido/server exec vitest run --project integration test/integration/push-receipt-consistency.integration-spec.ts --sequence.seed=101
pnpm --filter @aido/server exec vitest run --project e2e test/e2e/notification.e2e-spec.ts
```

DB projects는 파일을 직렬로 돌리고 기본으로 순서를 섞는다. 정본은 [vitest.config.ts](../vitest.config.ts), [package.json](../package.json)이다.

## 공통 격리

- `*.spec.ts`는 `unit`, `test/integration/**/*.integration-spec.ts`는 `integration`, `test/e2e/**/*.e2e-spec.ts`는 `e2e`, `performance`는 측정 목적이다.
- `clearMocks`·`restoreMocks`와 fixture ID 초기화는 설정이 맡는다. Fake/Stub 상태는 새 인스턴스나 resetter로 초기화한다. env·global fetch·fake timer는 그 테스트가 복원한다.
- DB project는 `AIDO_TEST_POSTGRES_URL`의 전용 service 또는 로컬 Testcontainers에서 `aido_test_<run-id>` DB를 만든다. `DATABASE_URL`을 fallback으로 쓰지 않는다. 자신이 만든 DB/컨테이너만 정리한다.
- 운영/공유 개발 DB를 test DB처럼 쓰지 않는다. 연결 URI·비밀·token은 로그와 보고에 출력하지 않는다.
- 외부 공급자는 Fake 또는 HTTP fixture로 막는다. 유료·외부 호출 평가는 명시된 범위와 예산이 있을 때만 한다.
