# Aido API

서버 작업의 진입점이다. 업무는 `src/modules`, 실행 기술은 `src/platform`, 순수 공통 코드는 `src/shared`에 있다. 수정 대상의 실제 코드를 사례로 삼고, 필요한 문서만 읽는다. 공통 코드 규칙은 [루트 AGENTS](../../AGENTS.md#공통-코드-규칙)에 있다.

## 작업에 맞는 문서

| 판단할 내용                                      | 참고                                                                                                    |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| 레이어·상태 소유·포트·유료 기능·반복 할 일       | [.claude/architecture.md](.claude/architecture.md)                                                      |
| Controller·UseCase·Port 작성, 요청 헤더·throttle | [.claude/api-conventions.md](.claude/api-conventions.md)                                                |
| Zod·HTTP 응답·출시 앱 호환                       | [.claude/rest-contracts.md](.claude/rest-contracts.md), [호환](../../docs/conventions/compatibility.md) |
| ORM·트랜잭션·마이그레이션                        | [.claude/drizzle.md](.claude/drizzle.md)                                                                |
| 검증 범위·격리된 테스트 실행                     | [.claude/testing-guide.md](.claude/testing-guide.md)                                                    |
| 로그 이벤트 키·개인정보·공급자 오류              | [.claude/logging-guide.md](.claude/logging-guide.md)                                                    |
| AI 업체·프롬프트·비용                            | [docs/server/ai.md](../../docs/server/ai.md)                                                            |
| 푸시 기기·발송·큐                                | [docs/push-notifications.md](docs/push-notifications.md)                                                |
| 날짜·시간대·떠 있는 시각                         | [날짜 규칙](../../docs/conventions/dates.md)                                                            |
| 파일·역할 명명                                   | [docs/server/naming.md](../../docs/server/naming.md)                                                    |
| 배포 준비·롤백                                   | [DEPLOYMENT.md](DEPLOYMENT.md)                                                                          |

아래 규칙과 다른 기존 코드는 맞는 사례로 보지 않는다.

## 서버 규칙

- HTTP → Presentation → UseCase → Domain/Port ← Infrastructure다. Controller는 UseCase를 직접 주입한다. Domain은 순수 업무 규칙이고 Nest·ORM·SDK는 조립·Infrastructure에 둔다.
- 서버가 계산한다. 권한, 한도, 남은 횟수, 초기화 시각은 응답(`featureQuota`)에 싣고 앱은 표시만 한다.
- 플랜 숫자는 `@aido/api/vocabulary`의 `PLAN_CATALOG` 한 곳에만 둔다.
- 포트 이름과 타입은 앱의 말로 짓는다. 메일·관리자 알림·AI 업체를 바꿀 때 어댑터 밖이 바뀌면 포트가 틀린 것이다.
- 외부 호출은 `OutboundPolicy` 안에서 하고, 재시도 층은 한 호출에 하나다.
- 출시 앱 계약은 추가만 한다. DTO는 `@aido/api`, 오류는 `@aido/api/errors`, 상수는 `@aido/api/vocabulary`다. 상대 import는 `.js`, 별칭은 `#api/*`·`#test/*`다.
- 앱 헤더는 `RequestClient`로 읽고 Controller에서 `@Headers("x-…")`를 쓰지 않는다.
- 로그는 `<context>.<subject>.<outcome>` 키와 필드만 남긴다. 토큰·키·할 일 제목·전사·AI 입출력은 로그와 Sentry에 남기지 않는다.
- 사람이 볼 경보는 `OPERATIONAL_ALERT` 하나로 올린다. 업무 코드에서 Sentry를 직접 부르지 않는다.
- 할 일 시간은 떠 있는 시각이다. 진실은 `startDate + scheduledLocalTime`이고 `scheduledTime`은 파생값이다.
- 트랜잭션은 `UNIT_OF_WORK.run`과 CLS로 잡는다. 외부 발송은 트랜잭션 밖에서 한다. job은 pg-boss만 쓰고 핸들러는 멱등이어야 한다.

## 완료

요청한 동작, 호출 경로, 오류·호환 조건을 확인한다. 검증은 위험에 맞게 고르고 통과한 검사를 이유 없이 반복하지 않는다. 문서만 바꾸면 링크·경로·사실만 확인한다.

폐기 가능한 로컬 test DB에서는 승인을 기다리지 않고 테스트를 돌린다. 운영 대상 삭제·마이그레이션, 유료 호출, 외부 발송은 승인 범위를 확인한다.

결과에는 달라진 것, 실제 확인한 범위, 남은 한계를 적는다.
