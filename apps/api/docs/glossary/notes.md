# notes 용어집

메모 기능을 설계·리뷰할 때 읽는다. 서버 기준 구현이라 다른 Context 용어집도 이 모양을 따른다. 쓰는 법은 [용어집](../glossary.md)이다.

| 용어                | 코드                                                  | 뜻                                                                                                                          |
| ------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 메모                | `Memo`(Aggregate)                                     | 사용자가 할 일로 바꾸기 전에 적어 두는 글                                                                                   |
| 메모 내용           | `MemoContent`(VO)                                     | 1자 이상 `MEMO_LIMITS.MAX_CONTENT_LENGTH`자 이하의 글. 할 일 제목은 그 앞 `TODO_LIMITS.TITLE_MAX_LENGTH`자다(`toTodoTitle`) |
| 메모 한도           | `MEMO_LIMITS.MAX_PER_USER`, `memoLimitReached`        | 사용자당 메모 수 상한. 넘으면 내용 검증보다 먼저 `MEMO_2003`                                                                |
| 만들기              | `Memo.create`, `CreateMemoUseCase`                    | 그 사용자 마지막 순서 다음에 고정하지 않은 메모를 만든다                                                                    |
| 생성 요청           | `MemoCreationRequest`(VO), `isSameCreationRequest`    | 앱이 저장 한 번마다 보내는 Idempotency-Key와 글의 해시. 같은 키면 처음 메모를 돌려주고 글이 다르면 `MEMO_2004`              |
| 다시 쓰기           | `rewrite`, `RewriteMemoUseCase`                       | 메모 내용을 바꾸는 행동(API는 "메모 수정")                                                                                  |
| 고정                | `isPinned`, `changePinned`, `ChangeMemoPinnedUseCase` | 목록 맨 위에 두는 표시                                                                                                      |
| 순서                | `sortOrder`, `moveTo`, `ReorderMemoUseCase`           | 고정 안에서·밖에서 사용자가 정한 위치. 기준 메모 앞·뒤나 맨 앞·뒤로 옮기고 사이 메모를 한 칸씩 민다                         |
| 메모 잠금           | `MemoLockKeys.existingMemo`                           | 있는 메모를 바꾸는 요청이 함께 잡는 메모·순서 두 키                                                                         |
| 할 일로 바꾸기      | `ConvertMemoToTodoUseCase`                            | 메모 내용으로 할 일 하나를 만들고 같은 트랜잭션에서 메모를 지운다                                                           |
| 여러 할 일로 바꾸기 | `ConvertMemoToTodosUseCase`                           | 할 일을 차례로 만들고 모두 되면 메모를 지운다. 중간에 실패하면 앞 할 일과 메모가 남는다                                     |
| 계획 메모           | `PlanMemoWriterPort`, `PlanMemoReadModel`             | voice 계획 적용이 손으로 만든 메모와 같은 한도로 키 없이 만들고 지우는 메모                                                 |

| 상태       | 행동                               | 다음                      | 같은 값으로 다시                 |
| ---------- | ---------------------------------- | ------------------------- | -------------------------------- |
| 없음       | `Memo.create`                      | 고정 안 함, 마지막 순서+1 | 같은 Idempotency-Key면 처음 메모 |
| 고정 안 함 | `changePinned(true)`               | 고정                      | `false`(저장하지 않음)           |
| 고정       | `changePinned(false)`              | 고정 안 함                | `false`(저장하지 않음)           |
| 아무 내용  | `rewrite(content)`                 | 새 내용                   | 같은 내용이면 `false`            |
| 아무 순서  | `moveTo(sortOrder)`                | 새 순서                   | 같은 순서면 `false`              |
| 있음       | `DeleteMemoUseCase`·할 일로 바꾸기 | 없음                      | 없거나 남의 메모면 `MEMO_2001`   |

`true`인 행동만 `updatedAt`을 옮기고 저장한다. 순서 바꾸기로 밀린 메모도 `updatedAt`이 바뀐다.
