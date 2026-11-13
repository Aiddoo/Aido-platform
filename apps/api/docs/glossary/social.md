# social 용어집

친구·차단·신고·응원·콕 찌르기·초대 기능을 설계·리뷰할 때 읽는다. 쓰는 법은 [용어집](../glossary.md)이다.

친구 사이의 관계와 가벼운 상호작용을 소유한다. 형제 slice는 서로의 public으로만 읽고, 두 slice 이상이 쓰는 값(하루 보내기 구간·쿨다운·사용량 포트)은 `social/shared`에 둔다. 차단 조회는 친구·응원·콕·초대·댓글이 모두 읽어 `social-block-queries.public`(`SocialBlockQueriesModule`)으로 따로 연다.

| 용어        | 코드                                                                      | 뜻                                                                                                                   |
| ----------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Aido ID     | `UserTag`(VO), `USER_TAG_LENGTH`                                          | 대문자·숫자 8자 사용자 태그. 친구 요청 경로(`/follows/:userTag`)와 검색에 쓴다. 형식이 틀리면 `SYS_0002`             |
| 표시 이름   | `readDisplayName`, `getUserDisplayName`                                   | 알림 보낸 사람 이름. 프로필 이름, 없으면 Aido ID다. 사용자 행이 없으면 userId를 보내지 않고 `SYS_0001`               |
| 하루 구간   | `dailySendWindowAt`, `DailySendWindow`                                    | 응원·콕 하루 한도를 세는 요청 시간대(`X-Timezone`)의 오늘 0시~다음 0시. 잠금을 기다리다 자정을 넘겨도 요청 시각 기준 |
| 쿨다운      | `evaluateSendCooldown`, `SendCooldown`                                    | 마지막으로 보낸 뒤 정해진 시간 동안 다시 못 보낸다. 남은 초는 ms 차이를 올림한다                                     |
| 하루 사용량 | `DailySendUsageReaderPort`, `CheerUsageReaderPort`·`NudgeUsageReaderPort` | identity·access가 읽는 응원·콕 오늘 보낸 수와 다음 현지 자정(`resetsAt`, 공개 모양이라 Date)                         |

## friends

| 용어           | 코드                                                                   | 뜻                                                                                                                                            |
| -------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 친구 관계      | `Friendship`(Aggregate), `FriendshipId`, `FriendshipStatus`            | 한 방향 관계(follower → following, 테이블 `Follow`). 상태는 `FOLLOW_STATUSES`(PENDING·ACCEPTED)                                               |
| 친구(맞팔)     | `MutualFriendReaderPort`, `countMutualFriends`                         | 두 방향이 모두 ACCEPTED인 상대. 친구 수·친구 판정은 모두 이 기준이다. 판정은 60초, 친구 id·수는 5분 캐시이고 `*Current*`는 캐시 없이 읽는다   |
| 친구 요청      | `SendFriendRequestUseCase`, `SendFriendRequestByTagUseCase`            | 상대에게 PENDING 관계를 만든다. 상대가 먼저 보낸 대기 요청이 있으면 두 방향을 바로 수락한다(`isAutoAccepted`)                                 |
| 수락·거절      | `AcceptFriendRequestUseCase`, `RejectFriendRequestUseCase`             | 받은 PENDING 요청을 친구로 바꾸거나 지운다. 받은 대기 요청이 없으면 `FOLLOW_0903`                                                             |
| 친구 끊기      | `RemoveFriendUseCase`                                                  | 친구면 두 방향을, 내가 보낸 요청뿐이면 그 요청을 지운다. 내 관계가 없으면 `FOLLOW_0907`                                                       |
| 친구 목록 순서 | `sortOrder`, `moveTo`, `ReorderFriendUseCase`, `planFriendMoveToEdge`  | 수락한 관계는 follower 목록 맨 뒤(최대+1)에 들어간다. 옮기면 사이 친구를 한 칸씩 민다. 없는 친구면 `FOLLOW_0910`                              |
| 친구 성립 시각 | `friendsSince`                                                         | 수락한 관계의 `updatedAt`. 순서를 밀린 친구도 바뀐다                                                                                          |
| 친구 한도      | `hasReachedFriendLimit`, `FriendLimitReaderPort`, `friendLimitReached` | 요금제 친구 수 상한(null은 무제한). 대상 확인보다 먼저 검사하고 넘으면 `FOLLOW_0909`(details에 featureQuota)                                  |
| 바로 친구 맺기 | `EstablishFriendshipUseCase`, `FriendshipEstablisherPort`              | 초대 수락처럼 요청 없이 친구를 맺는다. 결과는 FRIENDS·REQUESTED(상대 자리 꽉 참)·ALREADY_FRIENDS·UNAVAILABLE(내 자리 꽉 참)                   |
| 관계 끊기      | `SeverFriendshipUseCase`, `FriendshipSeverancePort`                    | 차단이 부른다. 두 사람 사이 관계를 방향·상태와 상관없이 지우고, 지웠으면 커밋 뒤 두 사람의 친구 캐시를 비운다                                 |
| 첫 친구        | `NotifyFirstFriendMilestoneUseCase`                                    | 관계를 바꾼 트랜잭션 안에서 친구 수가 정확히 1이 된 사람에게 FIRST_FRIEND 알림 작업을 넣는다                                                  |
| 친구 잠금      | `FriendLockKeys.pair`·`list`                                           | 요청·수락·끊기·차단·초대가 같은 쌍 잠금과 두 사람의 목록 잠금을 잡는다. 문자열은 배포 사이 같은 잠금이라 바꾸지 않는다                        |
| 사용자 검색    | `SearchUsersUseCase`, `UserSearchTerm`(VO), `UserSearchCursor`(VO)     | 이름·Aido ID 검색. 검색어는 NFC·앞뒤 공백·연속 공백을 정리하고 비면 `FOLLOW_0911`. 커서는 (rank, id, 총수) base64url이고 틀리면 `FOLLOW_0912` |

친구 요청 오류는 출시 앱이 받는 순서다: 자기 자신 `FOLLOW_0904` → 한도 `FOLLOW_0909` → 대상 없음 `FOLLOW_0905` → 내가 차단함 `BLOCK_2203` → 나를 차단함(없는 사용자와 같은 `FOLLOW_0905`) → 이미 친구 `FOLLOW_0902` → 이미 보냄 `FOLLOW_0901`.

| 상태(한 방향)    | 행동                              | 다음                 | 다시·금지                                                       |
| ---------------- | --------------------------------- | -------------------- | --------------------------------------------------------------- |
| 없음             | `Friendship.create`               | PENDING, 순서 0      | 같은 방향 관계가 있으면 `FOLLOW_0901`(ACCEPTED면 `FOLLOW_0902`) |
| PENDING          | `accept(sortOrder)`               | ACCEPTED, 목록 맨 뒤 | 받은 쪽이 PENDING이 아니면 `FOLLOW_0903`                        |
| ACCEPTED         | `accept`(같은 순서)               | —                    | `false`(저장하지 않음)                                          |
| ACCEPTED         | `moveTo(sortOrder)`               | 새 순서              | 같은 순서면 `false`                                             |
| PENDING          | 거절·철회(`delete`)               | 없음                 | —                                                               |
| PENDING·ACCEPTED | 친구 끊기·차단(`delete`, 두 방향) | 없음                 | 끊기는 내 관계가 없으면 `FOLLOW_0907`, 차단은 지운 수 0         |

## blocks

| 용어      | 코드                                                      | 뜻                                                                                                                                        |
| --------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 차단      | `UserBlock`(Aggregate), `UserBlockId`, `BlockUserUseCase` | 방향은 있지만 효과는 양쪽에 같다. 친구 관계를 끊고 서로의 콘텐츠·상호작용을 막으며 차단당한 사람에게 알리지 않는다. 만든 뒤 바뀌지 않는다 |
| 차단 해제 | `UnblockUserUseCase`                                      | 차단 행을 지운다. 없던 차단을 풀어도 성공이고 끊긴 친구 관계는 되살리지 않는다                                                            |
| 차단 관계 | `UserBlockRelation`, `UserBlockReaderPort`                | 두 사람 사이 `isBlocking`(내가 막음)·`isBlockedBy`(상대가 막음). 활성 UoW 안에서는 같은 트랜잭션으로 읽는다                               |
| 차단 제외 | `hasNoBlockWith`                                          | 응원·콕·검색 목록이 어느 방향이든 차단한 상대의 행을 한 SQL의 NOT EXISTS로 거른다                                                         |
| 차단 목록 | `GetBlockedUsersUseCase`, `BlockedUserReaderPort`         | 최근에 차단한 순서(차단 시각·id 내림차순). 탈퇴 중인 사용자는 목록·개수에서 뺀다                                                          |

| 상태 | 행동                                   | 다음 | 다시·금지                                                                                    |
| ---- | -------------------------------------- | ---- | -------------------------------------------------------------------------------------------- |
| 없음 | `UserBlock.create`(`BlockUserUseCase`) | 차단 | 자기 자신은 잠금 전에 `BLOCK_2201`, 탈퇴·비활성 대상은 `BLOCK_2202`. 이미 차단이면 처음 차단 |
| 차단 | `UnblockUserUseCase`(`delete`)         | 없음 | 없어도 성공                                                                                  |

차단은 친구 잠금(`FriendLockKeys`)을 잡은 뒤 저장하고 같은 트랜잭션에서 `FriendshipSeverancePort`로 관계를 끊는다. 차단·해제가 바뀌면 두 사람의 응원·콕 수 캐시를 비운다.

## reports

| 용어        | 코드                                                            | 뜻                                                                                                                                      |
| ----------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 신고        | `UserReport`(Aggregate), `UserReportId`, `ReportContentUseCase` | 다른 사용자의 프로필·콘텐츠를 운영자에게 알린 것. 사유는 SPAM·HARASSMENT·INAPPROPRIATE·IMPERSONATION·OTHER, 상세는 500자 이하           |
| 신고 대상   | `UserReportTarget`(VO)                                          | PROFILE은 콘텐츠 id가 없고 TODO·NUDGE_MESSAGE·CHEER_MESSAGE는 양의 정수, COMMENT는 엔티티 id다. 틀리면 자기 신고보다 먼저 `REPORT_2253` |
| 중복 신고   | `duplicateReportWindowStart`                                    | 같은 신고자가 같은 대상을 24시간 안에 다시 신고하면 처음 신고를 돌려주고 운영자에게 다시 알리지 않는다                                  |
| 하루 한도   | `dailyReportWindowStart`, `hasReachedDailyReportLimit`          | 지금부터 거꾸로 24시간 동안 20건. 넘으면 `REPORT_2254`                                                                                  |
| 운영자 알림 | `UserReportNotifierPort`, `UserReportSubmissionReadModel`       | 커밋 뒤 고객센터 메일로 보낸다. 라벨·한국 시각 문구는 메일 어댑터가 만들고, 실패해도 신고는 남는다                                      |
| 처리        | `resolve`, `ResolveUserReportUseCase`, `saveIfUnchanged`        | 운영자가 조치 메모를 남겨 RESOLVED로 바꾼다. 읽은 뒤 다른 운영자가 먼저 처리했으면 그 첫 처리 기록을 돌려준다                           |

| 상태     | 행동                              | 다음     | 다시·금지                                                                         |
| -------- | --------------------------------- | -------- | --------------------------------------------------------------------------------- |
| 없음     | `UserReport.create`               | OPEN     | 자기 신고 `REPORT_2251`, 없는 대상 `REPORT_2252`, 24시간 안 같은 대상은 처음 신고 |
| OPEN     | `resolve({ resolvedById, note })` | RESOLVED | 없는 신고 `REPORT_2255`                                                           |
| RESOLVED | `resolve`                         | —        | `false`(첫 처리 기록을 그대로 둔다)                                               |

## cheers

| 용어        | 코드                                                            | 뜻                                                                                                     |
| ----------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 응원        | `Cheer`(Aggregate), `CheerId`, `CheerMessage`(VO)               | 친구에게 보내는 짧은 메시지. 메시지는 선택이고 200자 이하(넘으면 `SYS_0002`)                           |
| 응원 보내기 | `SendCheerUseCase`, `CheerLockKeys.dailyQuota`·`cooldown`       | 하루 한도·같은 친구 쿨다운 잠금 아래에서 저장하고 같은 트랜잭션에 알림 작업을 넣는다                   |
| 응원 한도   | `CheerLimitReaderPort`, `GetCheerLimitUseCase`                  | 요금제 하루 응원 수(null은 무제한). 하루 구간은 요청 시간대 오늘이다                                   |
| 응원 쿨다운 | `evaluateCheerCooldown`, `GetCheerCooldownUseCase`              | 같은 친구에게 마지막 응원부터 24시간                                                                   |
| 읽음        | `markRead`, `MarkCheerReadUseCase`, `MarkManyCheersReadUseCase` | 받은 사람만 읽음으로 바꾼다. 여러 개는 안 읽은 것만 한 문장으로 바꾸고 바꾼 수를 준다                  |
| 응원 목록   | `CheerReaderPort`, `CheerReadModel`, `CheerCountCachePort`      | 받은·보낸 응원을 생성 시각·id 내림차순으로 준다. 차단한 상대와 주고받은 응원은 빼고, 수는 1분 캐시한다 |

응원 보내기 오류는 출시 앱이 받는 순서다: 자기 자신 `CHEER_1204` → 친구 아님 `CHEER_1203` → 메시지 길이 → 하루 한도 `CHEER_1201` → 쿨다운 `CHEER_1202`.

| 상태    | 행동            | 다음    | 다시·금지                                     |
| ------- | --------------- | ------- | --------------------------------------------- |
| 없음    | `Cheer.create`  | 안 읽음 | 자기 자신 `CHEER_1204`                        |
| 안 읽음 | `markRead(now)` | 읽음    | 받은 사람이 아니거나 없는 응원은 `CHEER_1205` |
| 읽음    | `markRead`      | —       | `false`(저장·캐시 정리를 건너뛴다)            |

## nudges

| 용어           | 코드                                                                        | 뜻                                                                                                                            |
| -------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 콕 찌르기      | `Nudge`(Aggregate), `NudgeId`, `SendNudgeUseCase`                           | 친구의 공개 할 일에 보내는 재촉. 메시지는 선택이고 200자 이하(`NudgeMessage`, `social/shared`)                                |
| 콕 대상 할 일  | `NudgeTargetTodo`(VO)                                                       | 받는 친구가 소유한 공개 할 일. 기간 할 일은 시작~종료일, 하루 할 일은 시작일이 요청 시간대 오늘일 때만 찌른다                 |
| 콕 한도        | `NudgeLimitReaderPort`, `GetNudgeLimitUseCase`, `GetDailyNudgeUsageUseCase` | 요청 시간대 하루에 보낸 콕 수(리마인드 콕은 세지 않는다). null은 무제한                                                       |
| 콕 쿨다운      | `evaluateNudgeCooldown`, `NudgeLockKeys.dailyQuota`·`cooldown`              | 같은 할 일에 24시간. 조회 API(`GetNudgeCooldownUseCase`)는 그 친구에게 마지막으로 보낸 콕 기준이다(출시 계약)                 |
| 답장           | `reply(kind)`, `ReplyToNudgeUseCase`, `NUDGE_REPLY_KINDS`                   | STARTING·THANKFUL·LATER. 첫 답장 시각은 남기고 변경 시각만 바꾸며 읽음도 겸한다. 알림은 첫 답장에만 간다                      |
| 감사           | `markThanked`, `SendNudgeThanksUseCase`                                     | 완료한 공개 할 일에서 받은 콕 중 지금 친구이고 아직 감사받지 않은 보낸 사람마다 가장 최근 콕 하나에 남긴다. 100명씩 저장·알림 |
| 답장·감사 가능 | `isNudgeInteractionAvailable`, `NudgeInteractionConfigPort`                 | 지금 친구이고 받은 사람의 공개 할 일일 때만. 서버 설정으로 끄면 `NUDGE_1111`(1.15.1 이하 앱에는 `NUDGE_1105`로 바꿔 보낸다)   |
| 감사 미리보기  | `GetNudgeThanksPreviewUseCase`                                              | 완료 전이면 빈 미리보기, 비공개면 감사 수만, 공개면 받을 친구 목록까지 준다                                                   |
| 콕 목록        | `NudgeReaderPort`, `NudgeReadModel`, `NudgeCountCachePort`                  | 받은·보낸 콕을 생성 시각·id 내림차순으로 준다. 차단한 상대와 주고받은 콕은 목록·개수·단건에서 빠지고 수는 1분 캐시한다        |

콕 보내기 오류는 출시 앱이 받는 순서다: 자기 자신 `NUDGE_1104` → 친구 아님 `NUDGE_1103` → 메시지 길이 `SYS_0002` → 없거나 남의 것이거나 비공개 할 일 `TODO_0801` → 오늘 할 일 아님 `NUDGE_1106` → 하루 한도 `NUDGE_1101` → 쿨다운 `NUDGE_1102`.

| 상태                | 행동               | 다음                        | 다시·금지                                                         |
| ------------------- | ------------------ | --------------------------- | ----------------------------------------------------------------- |
| 없음                | `Nudge.create`     | 안 읽음·답장 없음·감사 없음 | 자기 자신 `NUDGE_1104`                                            |
| 안 읽음             | `markRead(now)`    | 읽음                        | 이미 읽었으면 `false`. 없거나 남의 콕이면 `NUDGE_1105`            |
| 답장 없음·다른 답장 | `reply(kind, now)` | 그 답장, 읽음               | 같은 답장이면 `false`(알림 없음). 이용 조건이 깨지면 `NUDGE_1109` |
| 감사 없음           | `markThanked(now)` | 감사                        | 이미 감사면 `false`. 완료 전이면 `NUDGE_1110`                     |

저장(`save`·`saveAll`)은 읽음·감사 시각을 먼저 남은 값으로 덮어쓰지 않는다.

## reminder-nudges

| 용어            | 코드                                                                      | 뜻                                                                                                                        |
| --------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 리마인드 콕     | `ReminderNudge`(Aggregate), `ReminderNudgeId`, `SendReminderNudgeUseCase` | 오늘 할 일을 만들지 않은 친구에게 보내는 독촉. 할 일이 없고 만든 뒤 바뀌지 않는다. 하루 한도가 없고 콕 한도에 세지 않는다 |
| 리마인드 쿨다운 | `evaluateReminderNudgeCooldown`, `ReminderNudgeLockKeys.cooldown`         | 같은 친구에게 1시간. 잠금 문자열 `mutation:v1:remind-nudge:cooldown:*`은 바꾸지 않는다                                    |
| 리마인드 대상   | `ReminderTargetReaderPort.countTodosOn`                                   | 받는 친구에게 보낸 사람 요청 시간대의 오늘 할 일이 있으면 `NUDGE_1107`                                                    |

리마인드 콕 오류 순서: 자기 자신 `NUDGE_1104` → 친구 아님 `NUDGE_1103` → 메시지 길이 `SYS_0002` → 오늘 할 일 있음 `NUDGE_1107` → 쿨다운 `NUDGE_1108`. 알림은 할 일 없는 콕 알림으로 같은 트랜잭션에서 넣는다. 상태 전이는 없다(`ReminderNudge.create`뿐).

## invites

| 용어             | 코드                                             | 뜻                                                                                                                                           |
| ---------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 초대             | `Invite`(Aggregate), `InviteId`(`social/shared`) | 초대한 사람의 코드 하나. 한 사람에게 ACTIVE 초대는 하나다                                                                                    |
| 초대 코드        | `InviteCode`(VO, `social/shared`), `INVITE_CODE` | `23456789BCDFGHJKMNPQRSTVWXZ` 중 6자. 공백·하이픈·소문자는 맞춰 읽고 그 밖은 `SYS_0002`                                                      |
| 내 초대 열기     | `IssueMyInviteUseCase`, `InviteLockKeys.invite`  | 처음 열면 초대 잠금 아래에서 코드를 발급하고 그 뒤로는 같은 코드와 진행 요약을 준다                                                          |
| 코드 발급        | `IssueInviteCodeUseCase`, `saveIfCodeUnused`     | 코드가 겹치면 새 코드로 5번까지 다시 만들고 넘으면 `SYS_0001`                                                                                |
| 코드 바꾸기      | `RotateInviteCodeUseCase`, `revoke`              | 지금 코드를 폐기(REVOKED)하고 새 코드를 발급한다. 폐기한 코드는 행을 남겨 다시 쓰지 않는다                                                   |
| 초대 미리보기    | `PreviewInviteUseCase`                           | 로그인 전 화면이라 이름·프로필 이미지만 준다(이름이 없으면 null, Aido ID는 싣지 않는다). 없는 코드·탈퇴 중 `INVITE_2101`, 폐기 `INVITE_2102` |
| 초대 기능 스위치 | `InviteConfigPort`                               | 꺼지면 초대 기능 전체가 `INVITE_2105`이고 지급은 원장에만 남는다                                                                             |

| 상태   | 행동                                      | 다음               | 다시·금지                    |
| ------ | ----------------------------------------- | ------------------ | ---------------------------- |
| 없음   | `Invite.create`(`IssueInviteCodeUseCase`) | ACTIVE             | 코드가 겹치면 새 코드로 다시 |
| ACTIVE | `revoke(now)`(`RotateInviteCodeUseCase`)  | REVOKED, 폐기 시각 | 이미 REVOKED면 `false`       |

## invite-redemptions

초대 수락 하나가 Root이고, 보상 지급(`RewardGrant`)·보상 이력(`RewardClaim`)은 수락 흐름 안에서 만들고 적용하는 작업 원장 행이다([영속성](../persistence.md#repository와-reader)). 초대 slice는 진행 요약을 `social-invite-redemption-queries.public`으로만 읽는다.

| 용어           | 코드                                                                   | 뜻                                                                                                                                                                           |
| -------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 초대 수락      | `InviteRedemption`(Aggregate), `RedeemInviteUseCase`                   | 초대받은 사람 한 명이 코드를 입력한 기록. 한 사람에 하나이고 수락 때 시간대를 고정한다                                                                                       |
| 수락 판단      | `decideInviteRedemption`                                               | 내 코드 `INVITE_2103` → 차단 `BLOCK_2204` → 같은 초대 재요청은 처음 결과 → 폐기 `INVITE_2102` → 이미 친구 → 다른 초대 수락 `INVITE_2104` → 가입 7일 지남은 친구만(보상 없음) |
| 바로 친구      | `FriendshipEstablisherPort`                                            | 수락하면 요청 없이 친구를 맺는다. 내 자리가 꽉 차면 `INVITE_2106`, 초대한 사람 자리가 꽉 차면 친구 요청만 보낸다                                                             |
| 남용 막기      | `RewardClaim`(Entity), `ClaimHasherPort`                               | 기기(INSTALLATION)·신원(IDENTITY) 해시. 같은 기기·신원이 이미 보상받았으면 두 사람 모두 보상 없이 친구만 된다. 탈퇴해도 남는다                                               |
| 활동일         | `recordActivity`, `RecordInviteeActivityUseCase`                       | 할 일을 마친 날짜(수락 때 고정한 시간대). 마감 전 서로 다른 2일이면 사용 시작(QUALIFIED)이다                                                                                 |
| 사용 시작 마감 | `qualificationExpiresAt`, `ExpireStaleRedemptionsUseCase`              | 수락 뒤 14일. 하루 한 번(03:30 KST) 정비 작업이 지난 JOINED를 EXPIRED로 거절하고 남은 지급을 다시 넣는다                                                                     |
| 사용 시작 알림 | `isQualifyReminderDue`, `SendInviteQualifyReminderUseCase`             | 하루만 더 하면 되고 마감이 3일 안이면 초대받은 사람 시간대 18:00에 한 번 알린다. 야간이면 미룬다                                                                             |
| 보상 지급      | `RewardGrant`(Entity), `GrantInviteRewardsUseCase`, `invite-reward.v1` | (출처, 받는 사람, 종류)마다 한 번. 초대받은 사람 7일 프리미엄, 사용 시작한 사람마다 초대한 사람 7일 프리미엄 + 친구 자리 1                                                   |
| 보상 상한      | `INVITE_REWARD_CAPS`, `InviteRedemptionLockKeys.rewardLedger`          | 초대한 사람 프리미엄은 최근 30일 30일·누적 90일까지. 보상 원장 잠금 아래에서 센다                                                                                            |
| 혜택 반영      | `RewardApplierPort`, `benefitSourceKey`                                | 지급 한 건을 보상 기간·친구 자리로 바꾼다. 출처 키 `reward-grant:<id>`로 한 번만 반영된다                                                                                    |

| 상태                | 행동                               | 다음                       | 다시·금지                                                                     |
| ------------------- | ---------------------------------- | -------------------------- | ----------------------------------------------------------------------------- |
| 없음                | `InviteRedemption.create`          | JOINED, 마감 = 수락 + 14일 | 초대받은 사람의 수락이 이미 있으면 `INVITE_2104`                              |
| JOINED              | `recordActivity(at)`               | JOINED + 활동일            | 같은 날짜·마감 뒤·JOINED 아님은 `false`                                       |
| JOINED(2일)         | `qualify(now)`                     | QUALIFIED                  | 같은 상태면 `false`, 허용 표 밖 전이는 `SYS_0001`                             |
| QUALIFIED           | `markRewarded(now)`                | REWARDED                   | 초대한 사람 지급이 모두 APPLIED일 때만. 같은 상태면 `false`                   |
| JOINED              | `expire(now)`·`expireJoinedBefore` | REJECTED(EXPIRED)          | JOINED 아니면 `false`                                                         |
| JOINED              | `markQualifyReminderSent(now)`     | JOINED + 알림 시각         | 이미 보냈거나 JOINED 아니면 `false`                                           |
| 지급 PENDING·FAILED | `markApplied`                      | APPLIED                    | 이미 APPLIED면 `false`(같은 지급 동시 적용을 막는 조건부 갱신)                |
| 지급 PENDING·FAILED | `markFailed`                       | FAILED, 첫 실행만 시도 +1  | 5번 실패하면 자동 재시도를 멈추고 경보 `social.invite-reward.retry-exhausted` |
