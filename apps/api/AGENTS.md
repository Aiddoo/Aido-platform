# Aido API

서버 작업의 진입점이다. 현재 구현은 `src/modules`, 실행 기술은 `src/platform`, 순수 공통 코드는 `src/shared`에 있다. 필요한 범위의 코드와 문서를 읽고 요청한 결과까지 구현·확인한다.

## 작업에 맞는 문서

| 판단할 내용                     | 참고                                                     |
| ------------------------------- | -------------------------------------------------------- |
| 레이어·상태 소유·모듈 공개 경계 | [.claude/architecture.md](.claude/architecture.md)       |
| Controller·UseCase·Port 작성    | [.claude/api-conventions.md](.claude/api-conventions.md) |
| Zod·HTTP 응답·구 앱 호환        | [.claude/rest-contracts.md](.claude/rest-contracts.md)   |
| ORM·트랜잭션·마이그레이션       | [.claude/prisma.md](.claude/prisma.md)                   |
| 검증 범위·격리된 테스트 실행    | [.claude/testing-guide.md](.claude/testing-guide.md)     |
| 로그·개인정보·공급자 오류       | [.claude/logging-guide.md](.claude/logging-guide.md)     |
| 파일·역할 명명                  | [docs/server/naming.md](../../docs/server/naming.md)     |
| 배포 준비                       | [DEPLOYMENT.md](DEPLOYMENT.md)                           |

모든 문서를 작업마다 읽을 필요는 없다. 수정 대상의 실제 코드가 상세 사례이며, 아래 규칙과 다른 기존 구현은 완료된 전환으로 가정하지 않는다.

## 유지할 경계

- HTTP → Presentation → UseCase → Domain/Port → Infrastructure 순서로 책임을 나눈다. Controller는 UseCase를 직접 주입한다.
- Domain은 순수 업무 규칙, Application은 흐름과 consumer-owned Port를 소유한다. Nest·ORM·vendor I/O는 조립/Infrastructure에 둔다.
- 상태 전이·값 검증이 있을 때만 Aggregate·Entity·VO를 사용한다. 조회·집계·렌더링에 형식적인 상태 모델이나 전달 전용 Facade를 만들지 않는다.
- 외부 Context는 실제 필요한 capability만 `*-*.public.ts`로 소비한다. 내부 Repository·UseCase를 공개하거나 순환을 `forwardRef`로 덮기 전에 방향을 확인한다.
- DTO는 `@aido/api`, 오류는 `@aido/api/errors`, 순수 공용 상수는 `@aido/api/vocabulary`를 쓴다. 상대 import는 `.js`, 서버 별칭은 `#api/*`, 테스트는 `#test/*`다.
- 트랜잭션은 `UNIT_OF_WORK.run`과 활성 CLS transaction을 사용한다. 외부 발송은 DB transaction 밖에서 실행하고 기존 커밋·재시도·실패 격리 의미를 보존한다.
- HTTP·DB·queue·cache 계약을 의도 없이 변경하지 않는다. 요청에 포함된 계약 변경은 소비자·배포 영향을 함께 처리한다.

## 완료와 실행 범위

요청한 동작, 관련 호출 경로와 오류·호환 조건을 확인하고 발생한 회귀까지 해결한다. 검증은 변경 위험에 맞게 선택하며 통과한 검사를 이유 없이 반복하지 않는다. 문서만 바꾼 작업에는 링크·경로·사실 확인을 사용하고 서버 전체 테스트를 관성적으로 실행하지 않는다.

생산 접근과 외부 발송이 차단된 폐기 가능한 로컬 fixture/test DB임이 확인된 테스트는 매 단계 승인을 기다리지 않고 실행·수정·관련 재검증한다. 기존 작업자 데이터나 운영 대상에 대한 삭제·마이그레이션, 실제 유료 호출·외부 발송은 그 작업의 승인 범위를 확인한다.

결과에는 무엇이 달라졌는지, 실제 확인한 범위와 남은 한계를 적는다. 향후 계획을 현재 완료 상태로 표현하지 않는다.
