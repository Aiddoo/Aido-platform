import type { CreateNotificationData } from "#api/modules/notification/inbox/application/ports/notification-draft.port";
import type { NotificationHistoryReaderPort } from "#api/modules/notification/inbox/application/ports/notification-history.reader.port";
import type { NotificationInboxReaderPort } from "#api/modules/notification/inbox/application/ports/notification-inbox.reader.port";
import {
  DuplicateNotificationError,
  type NotificationRepositoryPort,
} from "#api/modules/notification/inbox/application/ports/notification.repository.port";
import type { InboxNotification } from "#api/modules/notification/inbox/application/read-models/inbox-notification.read-model";
import { NotificationId } from "#api/modules/notification/inbox/domain/notification-id.vo";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  createNotificationDraftFixture,
  NOTIFICATION_FIXTURE_ACTOR_ID,
  NOTIFICATION_FIXTURE_NOW,
  NOTIFICATION_FIXTURE_OTHER_USER_ID,
  NOTIFICATION_FIXTURE_USER_ID,
} from "#test/fixtures/notification/notification.fixture";

export interface NotificationStoreSubject {
  readonly repository: NotificationRepositoryPort;
  readonly inboxReader: NotificationInboxReaderPort;
  readonly historyReader: NotificationHistoryReaderPort;
}

const USER_ID = NOTIFICATION_FIXTURE_USER_ID;
const OTHER_USER_ID = NOTIFICATION_FIXTURE_OTHER_USER_ID;
const LATER = NOTIFICATION_FIXTURE_NOW.add({ minutes: 1 });

async function create(
  repository: NotificationRepositoryPort,
  overrides: Partial<CreateNotificationData> = {},
): Promise<InboxNotification> {
  return repository.createNotification(createNotificationDraftFixture(overrides));
}

function idsOf(rows: readonly InboxNotification[]): number[] {
  return rows.map((row) => row.id);
}

export function describeNotificationRepositoryContract(
  createSubject: () => Promise<NotificationStoreSubject>,
): void {
  describe("알림 저장소 계약", () => {
    describe("생성", () => {
      it("하나를 만들면 기본값(읽지 않음·DEEP_LINK·TRANSACTIONAL)과 카피 키·재료를 그대로 저장한다", async () => {
        // Given
        const { repository } = await createSubject();

        // When
        const created = await create(repository, {
          type: "CHEER_RECEIVED",
          friendId: NOTIFICATION_FIXTURE_ACTOR_ID,
          cheerId: 7,
          copyKey: "social.cheerReceived",
          copyFacts: { friendName: "민지" },
          metadata: { message: "파이팅" },
        });
        const found = await repository.findById(NotificationId.reconstitute(created.id));

        // Then
        expect(created).toMatchObject({
          userId: USER_ID,
          type: "CHEER_RECEIVED",
          isRead: false,
          readAt: null,
          openedAt: null,
          friendId: NOTIFICATION_FIXTURE_ACTOR_ID,
          cheerId: 7,
          copyKey: "social.cheerReceived",
          copyFacts: { friendName: "민지" },
          metadata: { message: "파이팅" },
          actionType: "DEEP_LINK",
          actionUrl: null,
          purpose: "TRANSACTIONAL",
        });
        expect(found?.toPrimitives()).toMatchObject({
          id: created.id,
          userId: USER_ID,
          copyKey: "social.cheerReceived",
          copyFacts: { friendName: "민지" },
          isRead: false,
        });
      });

      it("카피 키가 없으면 null로 저장하고 action·purpose는 받은 값을 쓴다", async () => {
        // Given
        const { repository } = await createSubject();

        // When
        const created = await create(repository, {
          type: "SYSTEM_NOTICE",
          action: { type: "WEBVIEW", url: "https://aido.kr/terms" },
          purpose: "ENGAGEMENT",
        });

        // Then
        expect(created).toMatchObject({
          copyKey: null,
          copyFacts: null,
          actionType: "WEBVIEW",
          actionUrl: "https://aido.kr/terms",
          purpose: "ENGAGEMENT",
        });
      });

      it("여러 개를 만들면 입력 순서대로 돌려주고 각자의 카피 키·재료를 남긴다", async () => {
        // Given
        const { repository } = await createSubject();

        // When
        const created = await repository.createManyNotificationsAndReturn([
          createNotificationDraftFixture({ title: "첫째", copyKey: "first", copyFacts: { n: 1 } }),
          createNotificationDraftFixture({ userId: OTHER_USER_ID, title: "둘째" }),
          createNotificationDraftFixture({ title: "셋째", copyKey: "third", copyFacts: { n: 3 } }),
        ]);

        // Then
        expect(
          created.map(({ userId, title, copyKey, copyFacts }) => ({
            userId,
            title,
            copyKey,
            copyFacts,
          })),
        ).toEqual([
          { userId: USER_ID, title: "첫째", copyKey: "first", copyFacts: { n: 1 } },
          { userId: OTHER_USER_ID, title: "둘째", copyKey: null, copyFacts: null },
          { userId: USER_ID, title: "셋째", copyKey: "third", copyFacts: { n: 3 } },
        ]);
        expect(new Set(idsOf(created)).size).toBe(3);
      });

      it("빈 목록으로 여러 개를 만들면 아무것도 저장하지 않는다", async () => {
        // Given
        const { repository, inboxReader } = await createSubject();

        // When
        const created = await repository.createManyNotificationsAndReturn([]);

        // Then
        expect(created).toEqual([]);
        expect(await inboxReader.countUnread(USER_ID)).toBe(0);
      });

      it("같은 할 일 리마인더 회차는 하나만 저장한다: 단건은 중복 오류, 여러 건은 겹친 행만 건너뛴다", async () => {
        // Given
        const { repository } = await createSubject();
        const reminder = createNotificationDraftFixture({
          type: "TODO_REMINDER",
          todoId: 11,
          metadata: { stage: "AT_TIME" },
          reminderOccurrenceKey: "2026-11-10T0900",
        });
        await repository.createNotification(reminder);

        // When
        const single = await repository.createNotification(reminder).catch((error) => error);
        const many = await repository.createManyNotificationsAndReturn([
          reminder,
          { ...reminder, reminderOccurrenceKey: "2026-11-11T0900" },
        ]);

        // Then
        expect(single).toBeInstanceOf(DuplicateNotificationError);
        expect(many.map((row) => row.todoId)).toEqual([11]);
      });
    });

    it("없는 알림은 찾지 못한다", async () => {
      // Given
      const { repository } = await createSubject();

      // When
      const found = await repository.findById(NotificationId.reconstitute(999_999));

      // Then
      expect(found).toBeNull();
    });

    describe("읽음", () => {
      it("읽지 않은 알림만 읽음으로 바꾸고, 이미 읽은 행에는 false를 주며 처음 읽은 시각을 지킨다", async () => {
        // Given
        const { repository } = await createSubject();
        const created = await create(repository);
        const id = NotificationId.reconstitute(created.id);
        const first = await repository.findById(id);
        const stale = await repository.findById(id);
        first?.markRead(UserId.reconstitute(USER_ID), NOTIFICATION_FIXTURE_NOW);
        stale?.markRead(UserId.reconstitute(USER_ID), LATER);

        // When
        const results = [
          first == null ? null : await repository.markAsRead(first),
          stale == null ? null : await repository.markAsRead(stale),
        ];

        // Then
        const saved = (await repository.findById(id))?.toPrimitives();
        expect(results).toEqual([true, false]);
        expect(saved?.isRead).toBe(true);
        expect(saved?.readAt?.equals(NOTIFICATION_FIXTURE_NOW)).toBe(true);
      });

      it("전체 읽음은 그 사용자의 읽지 않은 알림만, 타입을 주면 그 타입만 바꾸고 바꾼 수를 준다", async () => {
        // Given
        const { repository, inboxReader } = await createSubject();
        await create(repository, { type: "FOLLOW_NEW" });
        await create(repository, { type: "CHEER_RECEIVED" });
        await create(repository, { type: "CHEER_RECEIVED" });
        await create(repository, { userId: OTHER_USER_ID, type: "CHEER_RECEIVED" });

        // When
        const typed = await repository.markAllAsRead(
          USER_ID,
          ["CHEER_RECEIVED"],
          NOTIFICATION_FIXTURE_NOW,
        );
        const unreadAfterTyped = await inboxReader.countUnread(USER_ID);
        const rest = await repository.markAllAsRead(USER_ID, undefined, LATER);
        const again = await repository.markAllAsRead(USER_ID, undefined, LATER);

        // Then
        expect([typed.count, unreadAfterTyped, rest.count, again.count]).toEqual([2, 1, 1, 0]);
        expect(await inboxReader.countUnread(USER_ID)).toBe(0);
        expect(await inboxReader.countUnread(OTHER_USER_ID)).toBe(1);
      });

      it("전체 읽음은 바꾼 행의 읽은 시각을 now로 남긴다", async () => {
        // Given
        const { repository } = await createSubject();
        const created = await create(repository);

        // When
        await repository.markAllAsRead(USER_ID, undefined, NOTIFICATION_FIXTURE_NOW);

        // Then
        const saved = await repository.findById(NotificationId.reconstitute(created.id));
        expect(saved?.readAt?.equals(NOTIFICATION_FIXTURE_NOW)).toBe(true);
      });
    });

    describe("열기", () => {
      it("주인이 처음 열면 열린 시각과 읽음을 함께 기록하고, 다시 열면 false로 처음 시각을 지킨다", async () => {
        // Given
        const { repository } = await createSubject();
        const created = await create(repository);
        const id = NotificationId.reconstitute(created.id);

        // When
        const first = await repository.markAsOpened(id, USER_ID, NOTIFICATION_FIXTURE_NOW);
        const second = await repository.markAsOpened(id, USER_ID, LATER);

        // Then
        const saved = (await repository.findById(id))?.toPrimitives();
        expect([first, second]).toEqual([true, false]);
        expect(saved?.isRead).toBe(true);
        expect(saved?.openedAt?.equals(NOTIFICATION_FIXTURE_NOW)).toBe(true);
        expect(saved?.readAt?.equals(NOTIFICATION_FIXTURE_NOW)).toBe(true);
      });

      it("남의 알림이나 없는 알림은 false이고 행을 바꾸지 않는다", async () => {
        // Given
        const { repository } = await createSubject();
        const created = await create(repository);
        const id = NotificationId.reconstitute(created.id);

        // When
        const results = [
          await repository.markAsOpened(id, OTHER_USER_ID, NOTIFICATION_FIXTURE_NOW),
          await repository.markAsOpened(
            NotificationId.reconstitute(999_999),
            USER_ID,
            NOTIFICATION_FIXTURE_NOW,
          ),
        ];

        // Then
        const saved = (await repository.findById(id))?.toPrimitives();
        expect(results).toEqual([false, false]);
        expect(saved).toMatchObject({ isRead: false, readAt: null, openedAt: null });
      });
    });

    it("행위자 알림 삭제는 friendId나 metadata.senderId가 그 행위자인 알림만 지우고 받은 사용자를 한 번씩 준다", async () => {
      // Given
      const { repository, inboxReader } = await createSubject();
      await create(repository, { friendId: NOTIFICATION_FIXTURE_ACTOR_ID });
      await create(repository, { metadata: { senderId: NOTIFICATION_FIXTURE_ACTOR_ID } });
      await create(repository, {
        userId: OTHER_USER_ID,
        friendId: NOTIFICATION_FIXTURE_ACTOR_ID,
      });
      const kept = await create(repository, { friendId: OTHER_USER_ID });

      // When
      const result = await repository.deleteNotificationsByActorId(NOTIFICATION_FIXTURE_ACTOR_ID);
      const none = await repository.deleteNotificationsByActorId(NOTIFICATION_FIXTURE_ACTOR_ID);

      // Then
      expect(result.count).toBe(3);
      expect(result.affectedUserIds.toSorted()).toEqual([USER_ID, OTHER_USER_ID].toSorted());
      expect(none).toEqual({ count: 0, affectedUserIds: [] });
      const remaining = await inboxReader.listByUser({
        userId: USER_ID,
        afterNotificationId: null,
        limit: 10,
        unreadOnly: false,
        types: undefined,
      });
      expect(idsOf(remaining)).toEqual([kept.id]);
    });

    describe("알림함 조회", () => {
      it("최신순(createdAt·id 내림차순)으로 나열하고 after 알림 뒤부터 이어 준다", async () => {
        // Given
        const { repository, inboxReader } = await createSubject();
        const created = [];
        for (const title of ["1", "2", "3", "4"]) {
          created.push(await create(repository, { title }));
        }
        await create(repository, { userId: OTHER_USER_ID });
        const [oldest, second, third, newest] = idsOf(created);
        const query = {
          userId: USER_ID,
          unreadOnly: false,
          types: undefined,
        } as const;

        // When
        const firstPage = await inboxReader.listByUser({
          ...query,
          afterNotificationId: null,
          limit: 2,
        });
        const nextPage = await inboxReader.listByUser({
          ...query,
          afterNotificationId: firstPage.at(-1)?.id ?? null,
          limit: 5,
        });

        // Then
        expect(idsOf(firstPage)).toEqual([newest, third]);
        expect(idsOf(nextPage)).toEqual([second, oldest]);
      });

      it("after 알림이 없으면 빈 목록이다", async () => {
        // Given
        const { repository, inboxReader } = await createSubject();
        await create(repository);

        // When
        const page = await inboxReader.listByUser({
          userId: USER_ID,
          afterNotificationId: 999_999,
          limit: 5,
          unreadOnly: false,
          types: undefined,
        });

        // Then
        expect(page).toEqual([]);
      });

      it("읽지 않음·타입 조건을 함께 걸고 미읽음 수도 같은 타입 조건으로 센다", async () => {
        // Given
        const { repository, inboxReader } = await createSubject();
        const unreadCheer = await create(repository, { type: "CHEER_RECEIVED" });
        const readCheer = await create(repository, { type: "CHEER_RECEIVED" });
        await create(repository, { type: "FOLLOW_NEW" });
        await repository.markAsOpened(
          NotificationId.reconstitute(readCheer.id),
          USER_ID,
          NOTIFICATION_FIXTURE_NOW,
        );

        // When
        const page = await inboxReader.listByUser({
          userId: USER_ID,
          afterNotificationId: null,
          limit: 10,
          unreadOnly: true,
          types: ["CHEER_RECEIVED"],
        });
        const counts = [
          await inboxReader.countUnread(USER_ID),
          await inboxReader.countUnread(USER_ID, ["CHEER_RECEIVED"]),
          await inboxReader.countUnread(USER_ID, ["NUDGE_RECEIVED"]),
        ];

        // Then
        expect(idsOf(page)).toEqual([unreadCheer.id]);
        expect(counts).toEqual([2, 1, 0]);
      });
    });

    describe("발송 이력", () => {
      it("최근 알림은 사용자·타입·기준 시각과 준 대상 ID가 모두 맞을 때만 있다", async () => {
        // Given
        const { repository, historyReader } = await createSubject();
        await create(repository, {
          type: "NUDGE_RECEIVED",
          friendId: NOTIFICATION_FIXTURE_ACTOR_ID,
          todoId: 3,
          nudgeId: 9,
        });
        const base = {
          userId: USER_ID,
          type: "NUDGE_RECEIVED",
          since: Temporal.Instant.from("2000-01-01T00:00:00Z"),
        } as const;

        // When
        const results = [
          await historyReader.existsRecentNotification(base),
          await historyReader.existsRecentNotification({
            ...base,
            friendId: NOTIFICATION_FIXTURE_ACTOR_ID,
            todoId: 3,
            nudgeId: 9,
          }),
          await historyReader.existsRecentNotification({ ...base, nudgeId: 10 }),
          await historyReader.existsRecentNotification({ ...base, type: "CHEER_RECEIVED" }),
          await historyReader.existsRecentNotification({ ...base, userId: OTHER_USER_ID }),
          await historyReader.existsRecentNotification({
            ...base,
            since: Temporal.Instant.from("2999-01-01T00:00:00Z"),
          }),
        ];

        // Then
        expect(results).toEqual([true, true, false, false, false, false]);
      });

      it("이미 알린 사용자는 같은 타입·알림 날짜·친구의 알림을 가진 사용자만이다", async () => {
        // Given
        const { repository, historyReader } = await createSubject();
        const notificationDate = Temporal.PlainDate.from("2026-03-09");
        await create(repository, {
          type: "FRIEND_COMPLETED",
          friendId: NOTIFICATION_FIXTURE_ACTOR_ID,
          notificationDate,
        });
        await create(repository, {
          userId: OTHER_USER_ID,
          type: "FRIEND_COMPLETED",
          friendId: NOTIFICATION_FIXTURE_ACTOR_ID,
          notificationDate: Temporal.PlainDate.from("2026-03-08"),
        });

        // When
        const notified = await historyReader.findAlreadyNotifiedUserIds({
          userIds: [USER_ID, OTHER_USER_ID],
          type: "FRIEND_COMPLETED",
          notificationDate,
          friendId: NOTIFICATION_FIXTURE_ACTOR_ID,
        });
        const otherFriend = await historyReader.findAlreadyNotifiedUserIds({
          userIds: [USER_ID, OTHER_USER_ID],
          type: "FRIEND_COMPLETED",
          notificationDate,
          friendId: OTHER_USER_ID,
        });

        // Then
        expect([...notified]).toEqual([USER_ID]);
        expect(otherFriend.size).toBe(0);
      });

      it("마일스톤 알림은 metadata.milestone이 같은 그 사용자 알림이 있을 때만 있다", async () => {
        // Given
        const { repository, historyReader } = await createSubject();
        await create(repository, { type: "DAILY_COMPLETE", metadata: { milestone: "STREAK_3" } });

        // When
        const results = [
          await historyReader.hasMilestoneNotification(USER_ID, "STREAK_3"),
          await historyReader.hasMilestoneNotification(USER_ID, "COUNT_10"),
          await historyReader.hasMilestoneNotification(OTHER_USER_ID, "STREAK_3"),
        ];

        // Then
        expect(results).toEqual([true, false, false]);
      });
    });
  });
}
