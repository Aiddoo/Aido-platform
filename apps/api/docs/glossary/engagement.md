# engagement 용어집

댓글·답글·좋아요 기능을 설계·리뷰할 때 읽는다. 쓰는 법은 [용어집](../glossary.md)이다.

| 용어      | 코드                                                                               | 뜻                                                                                                                                   |
| --------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 댓글·묶음 | `TodoComment`(Aggregate), `CommentPlacement`(VO), `TodoCommentContent`(VO)         | 할 일에 단 2단계 대화. 답글은 묶음 머리(`threadCommentId`)와 답한 글(@대상 `replyToCommentId`)을 가진다. 내용은 공백을 지운 1자 이상 |
| 이어 쓰기 | `WriteTodoCommentChainUseCase`, `clientRequestId`                                  | 여러 글을 차례로 앞 글에 답하게 한 문장으로 저장하고 알림 한 건을 보낸다. 같은 멱등 키·같은 명령은 처음 결과, 다른 명령은 `SYS_0002` |
| 수정·삭제 | `EditTodoCommentUseCase`, `DeleteTodoCommentUseCase`                               | 수정은 작성자만, 삭제는 작성자와 할 일 주인. 지운 글은 묘비로 남아 답글이 묶음에 남고 좋아요는 모두 꺼진다(`unlikeAllByCommentId`)   |
| 좋아요    | `TodoCommentLike`(Aggregate), `LikeTodoCommentUseCase`, `UnlikeTodoCommentUseCase` | 한 사람이 한 글에 하나. 같은 댓글 잠금 안에서 글의 `likeCount`와 함께 바뀌고, 작성자 알림은 껐다 켜도 한 번만 간다                   |
| 댓글 잠금 | `TodoCommentLockKeys.comment`·`request`                                            | 글을 바꾸는 요청이 묶음 머리 키까지 함께 잡는다. 문자열은 배포 사이 같은 잠금이라 바꾸지 않는다                                      |
| 표시 이름 | `toDisplayName`, `findUserDisplayName`                                             | 작성자·@대상·알림 보낸 사람. 이름이 없으면 Aido ID(userTag), 지운 계정의 시스템 작성자(`DELETED_COMMENT_AUTHOR`)는 `null`            |
| 대화 조회 | `GetTodoConversationUseCase`, `ListTodoCommentThreadsUseCase`                      | 묶음을 최신·인기순, 묶음 안은 작성 순으로 읽는 서명한 keyset cursor. 차단 관계인 작성자의 글은 위치만 남기고 가린다                  |
| 계정 정리 | `CleanUpAccountTodoCommentsUseCase`, `TodoCommentPurgeRepositoryPort`              | 지운 계정의 좋아요를 지우고 글을 묘비로 시스템 작성자에게 넘긴 뒤 좋아요·답글 수를 실제 행으로 다시 센다(작업 원장 묶음 연산)        |

같은 상태 재요청은 `false`, 다른 상태에서 금지된 행동은 이름 있는 오류다. 수정만 같은 내용이어도 `editedAt`을 남긴다(출시 앱이 '수정됨'을 그린다).

| 상태        | 행동                                       | 다음           | 다시·금지                                              |
| ----------- | ------------------------------------------ | -------------- | ------------------------------------------------------ |
| 댓글 있음   | `edit`·`markDeleted`                       | 새 내용·묘비   | 권한 없으면 `TODO_0832`, 지운 글을 다시 지우면 `false` |
| 지운 댓글   | `edit`·`addLike`·`removeLike`·`placeReply` | —              | `TODO_0833`                                            |
| 묶음 머리   | `addReplies`·`removeReply`                 | 답글 수 ±      | 답글이거나 0에서 빼면 `SYS_0003`                       |
| 좋아요 꺼짐 | `like`(`TodoCommentLike.create`는 켜진 채) | 켜짐           | 켜짐이면 `false`(성공 응답, 수 그대로)                 |
| 좋아요 켜짐 | `unlike`·`markNotified`                    | 꺼짐·알림 보냄 | 꺼졌거나 이미 알렸으면 `false`                         |
