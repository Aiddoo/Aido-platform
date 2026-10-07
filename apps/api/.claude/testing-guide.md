# 서버 테스트: 검증 범위 선택

이 문서는 테스트 종류와 완료 판단의 진입점이다. 작성할 테스트에 필요한 상세 문서만 읽는다.

| 작업                                                         | 참고                                         |
| ------------------------------------------------------------ | -------------------------------------------- |
| 순수 Domain/Application, fixture·Stub, 공급자 Adapter의 wire | [unit-test.md](./unit-test.md)               |
| 실제 Module 조립, PostgreSQL transaction·경쟁 조건·migration | [integration-test.md](./integration-test.md) |
| HTTP validation·권한·응답·구 클라이언트 계약                 | [e2e-test.md](./e2e-test.md)                 |

## 무엇을 검증할지

변경으로 실패할 수 있는 사용자 동작이나 저장 정합성을 먼저 정한다. 테스트 개수나 피라미드 비율을 목표로 삼지 않는다.

| 위험                                                                 | 적합한 검증과 한계                                                                                      |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 값 검증, 상태 전이, 실제 입력에 근거한 판단                          | 순수 Unit. 결과·상태·실패를 검증한다.                                                                   |
| Application 분기, batch miss만 조회, retry·부수효과 순서             | 직접 생성 + 작은 Port Stub/Fake. callback UoW는 실제 rollback 증거가 아니다.                            |
| SQL 조건·projection·정렬 조립                                        | native ORM mock으로 표현을 확인한다. SQL 실행 결과·constraint·동시성은 실제 PG에서 확인한다.            |
| Module token·factory·cross-context capability 연결                   | 실제 Module을 조립한다. 동일 조립을 실행하는 HTTP/PG suite가 있다면 전달 전용 테스트를 중복하지 않는다. |
| row lock, atomic claim/counter, rollback, 중첩 Required, durable job | 실제 PostgreSQL Integration. 비동기 mock이나 임의 sleep으로 증명하지 않는다.                            |
| 외부 공급자 요청·헤더·retry·오류·SDK 출력 검증                       | 설치된 실제 SDK/Adapter + 고정 HTTP fixture. 실제 공급자 품질·SLA를 뜻하지 않는다.                      |
| route·validation·권한·status·raw/envelope·호환성                     | 실제 HTTP 및 필요한 OpenAPI·배포 fingerprint 계약.                                                      |

단순 Controller/UseCase 위임, 인스턴스 존재, 구현을 그대로 복사한 테스트는 새로 만들지 않는다. 기존 테스트를 제거할 때는 잃는 의미 있는 assertion과 대체 증거를 확인한다. 개인정보 비노출, 호출 횟수, 쿼리 수 자체가 계약일 때는 typed spy/mock이 적합하다.

## 작업 중 실행과 최종 확인

1. 변경한 동작과 영향을 받는 소비자의 가장 작은 기존 suite를 실행한다. 공개 계약·SQL·worker 변경이면 그 위험을 다루는 HTTP/PG 범위를 더한다.
2. 실패를 수정한 뒤 실패한 범위와 새 수정이 영향을 주는 범위만 재실행한다. 이미 통과한 무관한 suite를 반복하지 않는다. 누적 통과 결과와 마지막 수정 이후 결과를 구분해 기록한다.
3. 충분한 의미 검증이 끝나면 작업을 완료한다. 초기 구현에서 멈추거나, 테스트 수를 늘리려고 새 harness·의존성·중복 테스트를 만들지 않는다.
4. 넓은 모듈/구조 변경은 소스를 동결한 뒤 완료 담당자가 관련 전체 Unit·Integration·E2E와 lint·format·typecheck를 한 번 최종 확인한다. build는 Module/배포 산출물 등 변경 위험에 맞춰 포함한다. 이후 반복은 새 변경·실패·미해결 우려가 있을 때만 한다. 문서/저위험 수정은 링크·내용·관련 정적 검사로 끝낼 수 있다.

파일·seed·timezone·실제 실행 수·결과와 필요한 로그를 남긴다. 수집/환경 오류로 0개 테스트가 실행됐다면 기능 회귀 결과와 구분한다. Before의 기대 실패와 실제 회귀도 구분한다. 통과만으로 운영 배포·실제 공급자 성능·영구적인 flake 부재를 주장하지 않는다.

```sh
pnpm --filter @aido/server exec vitest run --project unit src/modules/notification/application/use-cases/delivery/reconcile-push-receipts.use-case.spec.ts
pnpm --filter @aido/server exec vitest run --project integration test/integration/push-receipt-consistency.integration-spec.ts --sequence.seed=101
pnpm --filter @aido/server exec vitest run --project e2e test/e2e/notification.e2e-spec.ts
```

순서 의존이 의심되거나 공유 상태를 바꾼 경우에만 다른 seed·timezone으로 영향을 받는 범위를 반복한다. 현재 DB projects는 파일을 직렬 실행하고 기본으로 순서를 섞는다. 설정·스크립트의 정본은 [vitest.config.ts](../vitest.config.ts), [package.json](../package.json)이다.

## 공통 격리와 자율 작업 범위

- `*.spec.ts`는 `unit`, `test/integration/**/*.integration-spec.ts`는 `integration`, `test/e2e/**/*.e2e-spec.ts`는 `e2e` project이다. `performance`는 별도 측정 목적일 때 사용한다.
- `clearMocks`·`restoreMocks`와 fixture ID 초기화는 설정/setup이 소유한다. mutable Fake/Stub 상태는 새 인스턴스나 소유 resetter로 초기화한다. 환경 변수·global fetch·fake timer는 해당 테스트가 복원한다.
- 허가된 저장소 작업 범위에서 관리형 임시 DB/컨테이너 생성·migration·자신의 데이터 초기화·자신이 만든 자원 정리와 가역적인 fixture/코드 교정은 계속 진행할 수 있다. 운영/공유 개발 DB를 disposable test DB처럼 쓰거나 소유하지 않은 자원을 삭제하지 않는다.
- DB project는 `AIDO_TEST_POSTGRES_URL`의 전용 service 또는 로컬 Testcontainers에서 `aido_test_<run-id>` DB를 만든다. `DATABASE_URL`을 운영 DB fallback으로 사용하지 않는다. 종료 후 자신이 만든 DB/컨테이너가 남았다면 소유 자원만 정리하고 결과를 확인한다. 연결 URI·비밀·bearer token은 로그/보고에 출력하지 않는다.
- 기본 테스트는 외부 공급자를 Fake 또는 HTTP fixture로 격리한다. 실제 유료/외부 호출 평가는 별도 명시된 범위와 예산이 있을 때만 수행한다.

HTTP/스키마를 바꾸는 작업은 [rest-contracts.md](./rest-contracts.md), 로그를 바꾸는 작업은 [logging-guide.md](./logging-guide.md)의 관련 계약을 확인한다. 매 수정마다 모든 가이드를 다시 읽을 필요는 없다.
