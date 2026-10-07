# 서버 이름과 코드 컨벤션

전환 대상은 [migration.md](./migration.md), CI 강제 규칙은 [ci.md](./ci.md)를 따른다.
신규 Context는 같은 레이어·접미사·의존 방향으로 작성한다. 필요 없는 빈 폴더와 유지용 파일은 만들지 않는다.

## 이름

| 역할             | 위치·파일                                                 | 이름                                    |
| ---------------- | --------------------------------------------------------- | --------------------------------------- |
| 조립             | Context root, `.module.ts`, `.providers.ts`               | `PlanningModule`, `createTodoProviders` |
| Aggregate Root   | `domain/aggregates/*.aggregate.ts`                        | `Todo`, `Subscription`                  |
| 내부 Entity      | `domain/entities/*.entity.ts`                             | `TodoItem`                              |
| VO               | `domain/value-objects/*.vo.ts`                            | `TodoSchedule`, `Coordinates`           |
| Policy·상태 타입 | `domain/policies`, `domain/types`                         | 업무 규칙·상태 이름                     |
| Use Case         | `application/use-cases/<slice>/*.use-case.ts`             | `CreateTodo`, `GetTodoDetails`          |
| 쓰기 Port        | `application/ports/<slice>/*.repository.ts`               | `TodoRepository`                        |
| 조회 Port        | `application/ports/<slice>/*.read-repository.ts`          | `TodoReadRepository`                    |
| 외부 사실 Port   | `application/ports/<slice>/*.gateway.ts`                  | `IdentityUserGateway`                   |
| 영속화 구현      | `infrastructure/persistence/<slice>/*.repository.impl.ts` | `PrismaTodoRepositoryImpl`              |
| Gateway 구현     | 소유 Context의 `infrastructure/gateways`                  | `IdentityUserGatewayImpl`               |
| 응답             | `presentation/mappers`, `presentation/schemas`            | 공개 REST 계약으로 변환                 |

파일은 kebab-case, 클래스·타입은 PascalCase, 변수·필드는 camelCase다. boolean은
`is/has/can/should`, 시각은 `At`, 기간은 `Ms/Seconds/Minutes`를 명시한다. `data`, `value`,
`result`는 문맥이 분명한 짧은 범위에만 사용한다. 시간·횟수·ID를 혼동시키는 이름을 쓰지 않는다.

상태·의존성은 `#` private field로 관리한다. 불변 참조는 `readonly`, 입력·출력 타입은
읽기 전용을 기본으로 한다. Domain의 Date·배열은 외부 변경으로 상태가 바뀌지 않도록 복사한다.
Nest decorator와 DI token은 Composition Root·Presentation·Infrastructure에서만 사용한다.

## null과 undefined

- PATCH `undefined`: 미전달이며 변경하지 않는다.
- PATCH `null`: 공개 계약이 허용한 초기화다. Persistence Mapper에서 제거하지 않는다.
- Repository의 조회 실패: `null`이다. 공개 nullable/optional 필드는 기존 계약을 유지한다.
- 일반 비교: `===`, `!==`. 양쪽 nullish를 의도적으로 묶으면 `== null`, 구분하면 각각 엄격 비교한다.
- boolean 부정은 `!flag`, 숫자·문자열 presence는 `!== undefined` 등으로 명시한다.
- `0`, `false`, 빈 문자열을 누락으로 처리하지 않는다. 기본값은 의미에 맞게 `??`를 사용한다.
- 초기화 가능한 PATCH에 `input.field ?? existing.field`를 사용하지 않는다.

## 유틸리티와 분기

es-toolkit은 컬렉션의 묶기·인덱싱·중복 제거·분할에 직접 사용한다. 가능한 root import를
사용하고 같은 역할의 자체 wrapper를 만들지 않는다. 단순한 map/filter와 조건문은 그대로 둔다.

ts-pattern은 구분 가능한 상태·결과·이벤트 union의 exhaustive 분기에 사용한다. 단순한
boolean guard를 match로 바꾸지 않는다. 업무 규칙을 서버·클라이언트 공통 유틸리티에 넣지 않는다.

서버와 공유 REST 계약은 2칸 들여쓰기·큰따옴표·줄 길이 100이다. 외부 고정 계약 fixture와
생성 산출물은 형식 변경에서 제외한다. 기존 Mobile의 포맷을 관련 없는 변경으로 섞지 않는다.

## 추상화와 주석

기존 라이브러리·공유 구현을 먼저 사용한다. Adapter는 실제 외부 경계와 consumer-owned 계약을
연결하고 Strategy는 교체 가능한 동작이 여러 개일 때 사용한다. 한 줄 전달 함수·형식만 갖춘
범용 Base Repository·필드별 VO를 늘리지 않는다. 코드가 설명하는 주석은 제거하고, 호환성·
트랜잭션·멱등성·재시도의 이유와 제약은 남긴다.
