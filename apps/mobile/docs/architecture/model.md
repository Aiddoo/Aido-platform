# 모델

모델은 앱의 업무 규칙이고, mapper는 바깥 값을 모델로 바꾸는 유일한 곳이다. 업무 규칙이 바뀌면 모델만, 서버 필드가 바뀌면 mapper만 고친다. 기준 파일은 `features/notes/memo/domains/memo.model.ts`와 `apis/memo.mapper.ts`다. 폴더 골격은 [structure](./structure.md), Api·쿼리·폼은 [data](./data.md)에 있다.

## 모델과 Policy

`domains/{entity}.model.ts` 하나에 한 엔티티의 모양과 업무 규칙을 모은다.

- **모양.** Zod 클라이언트 모델 `xSchema`와 `type X = z.infer<typeof xSchema>`다. 서버 응답 모양이 아니라 앱이 쓰는 모양이다. 목록 인터페이스의 타입(`FilterX = (x: X) => boolean`, `OrderByX`)도 여기에 둔다.
- **규칙은 이름 있는 모듈 `function`이다.** 이름은 `can`·`should`·`is`·`has`(긍정형), `get`, `calculate`, `find`(없으면 `null`), `with`(불변 갱신), `filterBy`·`orderBy`로 시작한다. 정렬은 es-toolkit `orderBy`·`take`로 한다(원본을 바꾸지 않고, Hermes에 `toSorted`가 없다).
- **Policy는 모듈 함수를 모은 객체다.** `export const XPolicy = { fnA, fnB } as const`. 인라인 함수, 별칭, 메서드, `this`, class를 쓰지 않는다. 그래서 콜백으로 넘겨도 안전하다(`notifications.filter(NotificationPolicy.isUnread)`).
- **Policy 멤버의 첫 인자는 모델 전체다.** 값 하나만 필요해도 `notification: Notification`으로 받고 `Pick`·`Partial`·객체 리터럴로 좁히지 않는다. 목록 규칙은 `readonly X[]`를 받는다. 모델 일부(폼 값, 검색어, route id, `select` 결과)만 가진 곳의 규칙은 Policy 밖 export 함수다.
- **한 파일, 한 엔티티, 한 Policy.** 두 엔티티가 섞이면 파일을 나눈다(`push-notification.model.ts`, `push-notification-response.model.ts`). 모델을 만드는 `create*` 함수는 Policy에 넣지 않는다. 규칙 없는 모델에는 빈 Policy를 만들지 않는다.
- **업무 규칙 표**는 모델 파일 안 비공개 상수이고 `satisfies Record<Union, …>`를 건다. 서버가 종류를 더하면 빌드가 깨진다.
- **시각은 인자다.** 지금·오늘·시간대를 받고 `Date.now()`·`new Date()`·기기 시간대를 읽지 않는다. 기간 규칙은 `shouldShow*(record, now)`이고 상수 이름에 단위를 넣는다(`PUSH_NOTICE_SNOOZE_DAYS`).
- **import는 zod, `@aido/api/vocabulary`·`common`·`errors`, 순수 `shared/date`, 다른 모델뿐이다.** 계약(`@aido/api` 루트·`contracts/*`), i18n, `shared/ui`, `react-native`, React, `constants/`를 import하지 않는다(lint).
- **Zod는 최신 문법만 쓴다.** `z.int()`, `z.iso.*`, `z.email()`·`z.url()`, `z.enum(튜플)`, `z.discriminatedUnion`, `z.codec`, `.brand<'X'>()`. `z.nativeEnum`, `z.string().email()`, `.passthrough()`는 쓰지 않는다.

Policy는 의미 값(등급, 단계, 종류)을 돌려준다. 그 값을 문구·색으로 그리는 일은 아래 자리가 맡는다.

| 모델에 넣지 않는 것                 | 둘 곳                                                                         |
| ----------------------------------- | ----------------------------------------------------------------------------- |
| 문구·i18n 키, 포맷, 색 토큰, 아이콘 | `utils/{name}.view-model.ts`, 컴포넌트의 `satisfies Record<…>` 맵이나 `match` |
| 좌표·도형                           | `utils/{name}.geometry.ts`                                                    |
| 표시 방식(배너·조용히, 칸 배치)     | `utils/`의 UI 판단, 창 배치는 `shared/ui/adaptive-pane/window-layout.ts`      |
| 폼 값·초안·저장 모양                | `schemas/*-form`·`-draft`·`-storage.schema.ts`                                |
| 서버가 계산한 값의 재계산           | 하지 않는다([계산 경계](#서버클라이언트-계산-경계))                           |
| 다른 기능 Policy의 재수출·위임      | 쓰는 곳이 그 Policy를 직접 부른다                                             |

```ts
// features/notification/domains/notification.model.ts
import { notificationTypeSchema } from '@aido/api/common';
import { instantSchema } from '@src/shared/date/instant';
import { z } from 'zod';

export type NotificationType = z.infer<typeof notificationTypeSchema>;

// 알림을 누르면 열 곳. 서버 navigation 종류와 1:1이고 칸은 앱이 쓰는 것만 둔다
export const notificationTargetSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('NOTIFICATIONS') }),
  z.object({ kind: z.literal('FRIEND_FEED'), friendId: z.string() }),
  z.object({
    kind: z.literal('TODO'),
    todoId: z.int().positive(),
    ownerId: z.string().nullable(),
    dateKey: z.iso.date().nullable(),
  }),
  // … 종류마다 한 줄
]);
export type NotificationTarget = z.infer<typeof notificationTargetSchema>;

export const notificationSchema = z.object({
  id: z.int().positive(),
  type: notificationTypeSchema,
  isRead: z.boolean(),
  target: notificationTargetSchema,
  receivedCheer: z
    .object({
      cheerId: z.int().positive(),
      senderId: z.string(),
      senderName: z.string().nullable(),
    })
    .nullable(),
  createdAt: instantSchema,
});
export type Notification = z.infer<typeof notificationSchema>;

// 프리미엄 AI 기능이 만든 알림. 서버가 종류를 더하면 이 표가 빌드를 막는다
const IS_AI_FEATURE_TYPE = {
  // 종류마다 한 줄
} as const satisfies Record<NotificationType, boolean>;

function isAiFeature(notification: Notification) {
  return IS_AI_FEATURE_TYPE[notification.type];
}

function isUnread(notification: Notification) {
  return !notification.isRead;
}

export const NotificationPolicy = { isAiFeature, isUnread } as const;
```

## Mapper

- `apis/{entity}.mapper.ts`에만, 엔티티당 하나다. 서버 DTO든 OS·SDK 값이든 "바깥 값 ↔ 모델"은 이 파일에서 바꾼다.
- 순수 함수다. 포트·시계·로그를 쓰지 않고 DI에 넣지 않는다.
- 이름은 `to{Model}(dto)`, `to{X}Request(values)`, `to{X}FormValues(model)`, `parse{X}(unknown): X | null`이다. 같은 요청을 만드는 곳이 여럿이면 mapper 하나로 모은다.
- 버린 칸을 로그로 남겨야 하는 입력(푸시 data)은 `parse{X}`가 `{ x: X | null, droppedPaths }`를 돌려준다. 경로에는 값을 싣지 않고, 로그는 부르는 훅이 남긴다.
- 계약의 열거·유니온은 `satisfies Record<ContractEnum, …>`나 `match().exhaustive()`로 빠짐없이 바꾼다. brand·enum은 `schema.parse`로 붙이고 `as`로 단정하지 않는다.
- 결과는 plain 값이다. 날짜는 문자열 brand(`Instant`, `DateKey`, `TimeOfDay`)로 바꾸고 `Date`·class를 넣지 않는다. 그래야 Query의 structural sharing이 같은 값의 참조를 지킨다(`memo.mapper.structural-sharing.test.ts`).

```ts
// apis/notification.mapper.ts: 서버 navigation이 바뀌면 여기만 고친다
export function toNotificationTarget(
  navigation: NotificationNavigationDto | undefined,
): NotificationTarget {
  if (navigation == null) {
    return { kind: 'NOTIFICATIONS' };
  }
  return (
    match(navigation)
      .returnType<NotificationTarget>()
      .with({ kind: 'FRIEND_FEED' }, ({ friendId }) => ({ kind: 'FRIEND_FEED', friendId }))
      .with({ kind: 'TODO' }, ({ todoId, todoOwnerId, todoDate }) => ({
        kind: 'TODO',
        todoId,
        ownerId: todoOwnerId ?? null,
        dateKey: todoDate ?? null,
      }))
      // … 종류마다 .with 한 줄
      .exhaustive()
  );
}

// apis/push-notification.mapper.ts: 푸시 data를 읽는 곳은 이 함수 하나다. 칸 하나가 틀리면 그 칸만 버리고 경로를 돌려준다
export function parsePushNotification(data: unknown): ParsedPushNotification {
  const exact = pushNotificationPayloadSchema.safeParse(data);
  if (exact.success) {
    return { notification: toPushNotification(exact.data), droppedPaths: [] };
  }
  const lenient = lenientPushNotificationPayloadSchema.safeParse(data); // 칸마다 .catch
  return {
    notification: lenient.success ? toPushNotification(lenient.data) : null,
    droppedPaths: exact.error.issues.map(({ path }) => path.map(String).join('.')),
  };
}
```

## 스키마

`schemas/`에는 모델이 아닌 모양만 둔다. 파일은 `{name}-{접미사}.schema.ts`다(ls-lint).

| 접미사                 | 모양                                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------- |
| `-form`                | 폼 값. 계약의 요청 스키마에서 `pick`·`omit`·`extend`로 유도한다                             |
| `-params`              | route 값(`{name}ParamsSchema`, [state-and-routing](./state-and-routing.md))                 |
| `-request`·`-response` | 서버와 주고받는 모양. 계약에서 유도하고 모델이 아니다                                       |
| `-payload`             | 다른 프로세스와 주고받는 메시지(푸시 data, 위젯 timeline props)                             |
| `-storage`             | 기기 저장 모양과 저장 값 정의 `defineStoredValue`. 모델과 같으면 모델 스키마를 `extend`한다 |
| `-draft`               | 저장하는 작성 중 초안                                                                       |
| `-query-key`           | 쿼리 키에 들어가는 값                                                                       |
| `-entry`               | 앱에 묶은 정적 목록 한 줄(whats-new 릴리스)                                                 |

모델이 `schemas/`를 import하지 않는다. 방향은 `schemas/` → `domains/`다.

## 서버와 공유

계약은 `@aido/api`가, 앱 모델은 앱이 소유한다. 서버·앱 공유 값은 `@aido/api`에 추가만 한다.

| 진입점                          | 내용                                                                     | import할 수 있는 곳                                      |
| ------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------- |
| `@aido/api/vocabulary`          | 용어 튜플·상수·한도(`NOTIFICATION_CATEGORY`, `MEMO_LIMITS`)              | 어디서나                                                 |
| `@aido/api/common`              | 응답 봉투, 날짜·시각 스키마, 공용 값 스키마(`entityIdSchema`, 알림 종류) | 어디서나. 모델도 쓴다                                    |
| `@aido/api/errors`              | `ErrorCode`·`Errors`, 코드별 `details` 스키마, `HttpStatus`              | 어디서나                                                 |
| `@aido/api`(루트)·`contracts/*` | 요청·응답 스키마와 DTO 타입                                              | `apis/`, `schemas/`, `shared/infra/http`, 테스트 fixture |

- 한 모양은 한 번만 정의한다. 계약에서 `pick`·`omit`·`extend`로 유도하고 같은 필드를 다시 적지 않는다. 공백 정리는 `trimmed(contract.shape.title)` 하나로 한다.
- 앱 안에서 여러 기능이 쓰는 같은 모양은 `shared/domains/`에 하나다(`user-summary.model.ts`, `cursor-page.model.ts`).
- 값 목록은 vocabulary 튜플에서 유도한다(`z.enum(AI_REPORT_TYPES)`). 한도 숫자를 앱에서 다시 적지 않는다. 앱에만 있는 공유 값은 vocabulary나 common으로 올린다.
- DTO 타입 별칭은 `{X}Dto`로 통일한다(`import type { Memo as MemoDto } from '@aido/api'`).
- 기능 오류는 `domains/{feature}.error.ts` 하나에 둔다: 코드 표, `isXxxError`, `ErrorCode` → 폼 칸 매핑. `details`는 공유 스키마로 읽고 mapper를 거꾸로 import하지 않는다. 분류·표시 규칙은 [error-handling](../error-handling.md)이 원본이다.
- mapper fixture는 계약 스키마로 검증해 만든다. 계약과 어긋난 fixture로 통과하는 테스트를 막는다([testing](../testing.md)).

## 파싱

바깥에서 오는 값은 경계 한 곳에서 한 방식으로 읽는다.

| 입력                       | 방식                                                              | 실패할 때                        |
| -------------------------- | ----------------------------------------------------------------- | -------------------------------- |
| 서버 응답                  | `parseApiResponse`(strict, `shared/errors/parse-api-response.ts`) | throw → 경계 + Sentry            |
| 앞으로 서버가 더할 열거    | 계약 `.catch(UNKNOWN)` + 로그                                     | 그 칸만 대체                     |
| 푸시 data·딥링크·위젯 명령 | mapper `parse{X}(unknown): X \| null`                             | `null` → 안전한 기본 이동 + 로그 |
| route params               | route 파일 `safeParse` → `Redirect`, 안쪽은 같은 스키마           | 화면 단위로 되돌림               |
| 기기 저장 값               | `defineStoredValue`(`.catch`, `migrate`)                          | `fallback`                       |
| 폼                         | `zodResolver` 하나                                                | 칸 오류                          |
| 빌드 설정                  | `parse`                                                           | 시작할 때 throw                  |

## null·undefined

"없음" 검사는 `== null`, 기본값은 `??`다. 곳마다 `null`·`undefined` 중 무엇을 쓰는지는 [nullish의 클라이언트 표](../../../../docs/conventions/nullish.md#6-클라이언트-모바일)가 원본이다. 모델에는 두 가지만 기억한다.

- 모델·Policy·`find*`의 "없음"은 `null`이다. 모델 스키마에 `.optional()`을 쓰지 않고, 계약이 `.optional()`로 더한 응답 칸은 mapper가 `null`로 바꾼다.
- `?? undefined`로 `null`의 출처를 지우지 않는다. 결과가 세 갈래 이상이면 판별 유니온이다.

## 호환 (1.15.2)

원본은 [compatibility](../../../../docs/conventions/compatibility.md)다.

- 앱은 이 버전의 코드와 지금 서버만 본다. 옛 앱·옛 서버 응답을 위한 분기와 대체 경로, mapper 기본값을 두지 않는다.
- 남기는 것은 셋이다.
  1. **업그레이드한 기기의 저장 값.** `defineStoredValue`의 `migrate`나 repository 이주로 한 번 옮기고, 옛 키를 읽는 코드는 1.16에서 지운다.
  2. **이미 퍼진 링크.** 초대 링크, 위젯 URI, 공개 딥링크. 새 경로는 추가만 한다.
  3. **앞으로 나올 서버 값.** 열거의 `.catch(UNKNOWN)`과 `parse{X}`의 `null`.
- 기기 저장 key·초대 링크·위젯 URI는 외부 계약이라 바꾸지 않는다.

## 서버·클라이언트 계산 경계

| 서버가 계산하고 앱은 읽기만                                                                            | 앱이 계산                                           |
| ------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| 프리미엄 여부, 한도, 남은 횟수, `resetsAt`, 1회 길이 상한                                              | 메모 미리보기, 묶기, 정렬 표시                      |
| 차감·환불, 멱등 처리, AI 계획, 겹침 판정                                                               | 낙관적 갱신, 폼 검증(서버가 최종 판단)              |
| 반복 회차 생성, 순간 값 `scheduledTime`, 휴면                                                          | 달력 표시, `날짜 + 벽시계`의 현지 표시, 오늘        |
| 쿨다운, 초대·보상 상태                                                                                 | 선택 상태, 시트 열림, 레이아웃                      |
| 일간 완료(여러 날 할 일은 기간의 모든 날), 날씨와 겹친 할 일·옮길 시각 후보, 알림 목적지(`navigation`) | 변경 직후 그날 완료의 낙관적 갱신, 지난 후보 숨기기 |

앱은 왼쪽 값을 다시 계산하지 않는다. 응답에 필요한 값이 없으면 앱에서 만들지 않고, 새 응답 필드는 서버 작업으로 따로 승인받는다.
