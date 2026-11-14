# 새 기능 추가

서버에 새 기능(slice)이나 기존 slice의 새 행동을 더할 때 이 순서대로 따른다. 규칙의 근거는 각 단계가 링크한 문서에 있고, 기준 구현은 [notes/memos](../src/modules/notes/memos)다.

## 0. 소유자부터 정한다

- 데이터와 판단을 누가 소유하는지 먼저 정한다. 이름만 보고 새 Context를 만들지 않는다. 기존 Context의 Aggregate가 바뀌면 그 slice에 UseCase를 더하고, 새 Aggregate Root면 새 slice다([구조](architecture.md#폴더-구조)).
- 다른 Context의 데이터가 필요하면 그 Context가 public으로 연 포트를 쓴다. 테이블을 직접 읽지 않는다. 없으면 소유 Context에 좁은 조회 포트를 먼저 연다.
- 판단은 서버, 표시는 앱이다. 앱이 같은 판단을 다시 하지 않도록 결과를 응답에 싣는다([서버가 계산할 것](architecture.md#서버가-계산할-것)).

## 1. 뼈대를 만든다

```sh
pnpm gen:api-slice   # context · slice(복수) · aggregate(단수) · id 종류(serial|cuid)
```

| 생성 위치                                                   | 내용                                                                                                                                                                                                                    |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/src/modules/<context>/<slice>/`                   | Aggregate·id VO·이름 VO·도메인 오류(`<slice>.errors.ts`), Repository Port, Create·List UseCase, Drizzle 저장소·행 매퍼, v1 Controller·DTO·응답 매퍼, `*.module.ts`·`*.providers.ts`·`*.public.ts`, lock-keys·log-events |
| `apps/api/test/`                                            | fixture, InMemory 저장소, 저장소 계약 suite, Drizzle integration spec                                                                                                                                                   |
| `packages/api/src/contracts/<aggregate>/v1/`, `vocabulary/` | 요청·응답 Zod schema와 공유 상수                                                                                                                                                                                        |
| `apps/api/src/platform/database/schema/<context>.schema.ts` | 테이블. 파일이 있으면 끝에 더하고 import를 합치며, 없으면 만들고 `tables.schema.ts`에 한 줄 더한다                                                                                                                      |
| `<context>.module.ts`                                       | slice Module을 imports·exports에 더한다                                                                                                                                                                                 |

생성기가 출력하는 마무리(`db:generate`, AppModule은 Context Module만, `@aido/api` build → `pnpm check`)를 따른다. 쓰지 않는 생성 파일은 지운다. 빈 폴더를 남기지 않는다.

생성 응답은 표준 모양(`{ <aggregate> }`, 목록은 `cursorPageSchema`, 문자열 ID는 `entityIdSchema`)이고 `message`를 넣지 않는다. 템플릿이나 템플릿이 import하는 공용 코드를 바꾸면 `pnpm test:generator`가 임시 worktree에 serial·cuid slice를 만들어 lint·이름·typecheck·경계·단위 테스트를 돈다(생성기를 바꾼 push는 pre-push가 돌린다).

## 2. 도메인을 채운다

- Aggregate는 `create`·`reconstitute`·`toPrimitives()`만 팩토리·꺼내기 이름으로 쓴다. 상태 전이 메서드는 바뀌면 `true`를 돌려준다([도메인 모델](domain-modeling.md)).
- 값 검증은 VO `create`, 여러 모델에 걸친 판단은 `*.domain-service.ts` 순수 함수(판별 유니온 반환, `now`는 인자)다.
- 서버만 아는 값 목록은 `domain/<slice>.constants.ts` 튜플, 앱과 함께 아는 값은 `@aido/api/vocabulary` 튜플이다. 리터럴 유니온을 손으로 쓰지 않는다([이름 사전](conventions.md#공유-값은-한-곳에서-선언한다)).

## 3. UseCase와 포트

- 행동 하나가 `<Verb><Noun>UseCase.execute(command)` 하나다. "잠금 → 읽기 → 도메인 행동 → 저장 → enqueue·publish"가 위에서 아래로 읽히게 쓴다.
- 같은 Aggregate를 바꾸는 UseCase는 모두 같은 잠금을 읽기 전에 잡는다([저장과 잠금](persistence.md#저장과-잠금)).
- 업무 오류는 `<slice>.errors.ts`의 이름 있는 함수(`memoNotFound(memoId)`)로 만들고 기존 `ErrorCode`를 쓴다. 거부는 `application/`, 불변식은 `domain/`의 errors 파일이다. 새 코드가 필요하면 `@aido/api/errors`와 ko·en 오류 문구에 함께 더한다.
- 포트는 abstract class, 구현은 `Drizzle<Noun>Repository`·`<Vendor><Capability>Adapter`다. 조립은 `*.providers.ts`의 `provideUseCase`이고 의존성은 `Pick<Port, "…">`로 좁힌다.
- 외부 공급자는 어댑터 + `*.wire.ts` Zod + `<vendor>-outbound.policy.ts`로만 부르고 트랜잭션 밖에서 한다([외부 호출](outbound.md)). 고르는 방법은 [공급자 선택](configuration.md#공급자-선택)이다.
- 후속 작업이 상태를 바꾸면 같은 트랜잭션 enqueue(`defineQueue`) 또는 `publish` + durable 구독이다. 커밋 뒤 in-process는 캐시 정리만이다([작업과 이벤트](jobs-and-events.md)).
- 새 설정은 slice `<context>-<slice>.config.ts`의 `defineConfig`, 운영에서 위험한 값은 시작 검증에 더한다([설정](configuration.md)).

## 4. HTTP와 계약

- 계약은 `packages/api`가 소유한다. 새 목록은 `cursorPageSchema`, 새 응답에 앱이 읽지 않는 값(`message` 등)을 넣지 않는다([HTTP 계약](http-contracts.md)).
- 서버 DTO는 `http/v1/<noun>.dto.ts` 한 파일에 `schema.meta({ id })`로 모은다. Controller는 검증·Command 변환·응답 매핑만 하고 `@ApiDoc`으로 응답 schema를 선언한다(운영 밖에서는 선언과 실제 응답을 [대조](http-contracts.md#응답-계약-검사)한다).
- 앱 헤더는 `RequestClient` 데코레이터로 읽는다. 시각은 계약에서 문자열, 변환은 presentation 경계에서 한다.

**출시 앱 호환 체크리스트**([호환](../../../docs/conventions/compatibility.md))

- [ ] 기존 route·status·필수 입력·응답 필드·오류 코드·details를 바꾸지 않았다. 더한 것은 optional이고 생략하면 지금과 같다.
- [ ] `test:contract`가 통과한다. released fixture를 재생성하지 않았다.
- [ ] DB는 추가 마이그레이션만, 큐 이름·스케줄 key·job key·잠금 키 문자열은 그대로다.
- [ ] 유료 기능이면 [유료 기능 추가](entitlements.md#유료-기능-추가)를 따랐다.

## 5. 관측

- 로그 이벤트는 `<slice>.log-events.ts`의 `<context>.<subject>.<outcome>`, 민감값은 남기지 않는다([관측](observability.md)).
- 사람이 봐야 하는 실패(재시도 소진, 돈·데이터가 걸린 거절)는 `<slice>.alerts.ts` 카탈로그에 key·severity·요약·대응을 더하고 `OperationalAlertPort.raise`로 올린다. 재시도로 회복되는 실패는 로그만이다.
- 새 스케줄은 `defineQueue`에 `missed`와 함께 넣으면 스케줄 감시 대상이 된다.

## 6. 테스트

| 쓴다                                                       | 어디서                                                         |
| ---------------------------------------------------------- | -------------------------------------------------------------- |
| VO 검증·상태 전이(바뀜·안 바뀜)·도메인 서비스 판정         | Unit                                                           |
| UseCase 분기: 권한·한도·멱등·오류 우선순위·부수효과 건너뜀 | Unit + InMemory 저장소·`FixedClock`(파일 안 작은 factory)      |
| 저장소 의미: 정렬·잠금·제약 충돌                           | 포트 계약 suite를 InMemory(unit)와 Drizzle(integration)이 함께 |
| 새 endpoint의 공개 계약·오류                               | E2E(응답 `.parse`)                                             |

쓰지 않는 것: 전달만 하는 Controller·UseCase, provider 조립, 필드 복사 매퍼, 상수, 로그 문구, mock 호출 횟수. 더블은 InMemory·Fake·Recording이고 mock 라이브러리를 쓰지 않는다. 기다림은 `vi.waitFor`·`expect.poll`, `retry` 금지다([테스트](testing.md)).

## 7. 문서와 PR

- 규칙을 새로 만들었으면 그 주제 문서 한 곳에 쓰고 링크한다. 기능 문서가 필요하면 `apps/api/docs/<feature>.md`(200줄 이하)를 만들고 [서버 문서 안내](README.md)에 한 줄 더한다.
- `pnpm check` → 변경한 범위의 unit·integration → 계약이 바뀌면 `test:contract`·관련 E2E 순서로 확인하고, 실행한 명령과 결과를 PR에 적는다.
- 커밋은 한국어 Conventional Commits다([Git](../../../docs/conventions/git.md)).
- 릴리스 묶음은 stack PR이다. 각 PR은 `stack:<release>` 라벨을 달고 혼자 빌드·테스트를 통과해야 한다. CI·머지 방법은 [Git](../../../docs/conventions/git.md#stack)이다.

## 예시: 메모 고정

메모 고정(`PATCH /v1/memos/:id/pin`)이 이 순서의 결과다.

```text
domain/memo.aggregate.ts                         changePinned(isPinned, now): boolean   # 같은 값이면 false
application/memos.errors.ts                      memoNotFound(memoId)
application/memos.lock-keys.ts                   MemoLockKeys.existingMemo(memoId, userId)   # 메모·순서 두 키
application/use-cases/change-memo-pinned.use-case.ts
  unitOfWork.run → mutationLock.acquire(MemoLockKeys.existingMemo(memoId, userId))
  → findByIdAndUserId ?? throw memoNotFound → memo.changePinned(…) false면 저장 생략 → save
presentation/http/v1/memo.dto.ts                 ToggleMemoPinDto = toggleMemoPinSchema.meta({ id })
presentation/http/v1/memo-response.mapper.ts     응답 문구·toIsoString
notes-memos.providers.ts                         provideUseCase(ChangeMemoPinnedUseCase, { … })
test/fixtures/notes/memo.fixture.ts · test/doubles/notes/in-memory-memo.repository.ts
src/modules/notes/memos/application/use-cases/change-memo-pinned.use-case.spec.ts
```

파일: [change-memo-pinned.use-case.ts](../src/modules/notes/memos/application/use-cases/change-memo-pinned.use-case.ts), [memo.aggregate.ts](../src/modules/notes/memos/domain/memo.aggregate.ts), [notes-memos.providers.ts](../src/modules/notes/memos/notes-memos.providers.ts), [memo-repository.contract.ts](../test/contracts/notes/memo-repository.contract.ts).
