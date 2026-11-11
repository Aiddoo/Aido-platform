import { InMemoryNotificationRepository } from "#test/doubles/notification/in-memory-notification.repository";
import { PassThroughNotificationCache } from "#test/doubles/notification/pass-through-notification-cache";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { createInboxNotificationFixture } from "#test/fixtures/notification/notification.fixture";

import { DeleteActorNotificationsUseCase } from "./delete-actor-notifications.use-case.js";

const ACTOR_ID = "user-1";

describe("DeleteActorNotificationsUseCase — 탈퇴한 사람이 남긴 알림 정리", () => {
  it("트랜잭션 안에서는 지우기만 하고, 커밋 뒤 받은 사람별 캐시 정리는 실패해도 계속한다", async () => {
    // Given
    const repository = new InMemoryNotificationRepository([
      createInboxNotificationFixture({ userId: "recipient-1", id: 1, friendId: ACTOR_ID }),
      createInboxNotificationFixture({
        userId: "recipient-2",
        id: 2,
        metadata: { senderId: ACTOR_ID },
      }),
      createInboxNotificationFixture({ userId: "recipient-3", id: 3, friendId: "someone-else" }),
    ]);
    const cache = new PassThroughNotificationCache();
    const logger = new SilentLogger();
    const useCase = new DeleteActorNotificationsUseCase({ repository, cache, logger });

    // When
    const result = await useCase.cleanupInTransaction(ACTOR_ID);

    // Then
    expect(result).toEqual({ affectedUserIds: ["recipient-1", "recipient-2"] });
    expect(repository.rowOf(1)).toBeUndefined();
    expect(repository.rowOf(2)).toBeUndefined();
    expect(repository.rowOf(3)).toBeDefined();
    expect(cache.invalidatedUnreadCountUserIds).toEqual([]);

    // When
    cache.failUnreadCountInvalidationFor.add("recipient-1");
    await expect(useCase.settleAfterCommit(result)).resolves.toBeUndefined();

    // Then
    expect(cache.invalidatedUnreadCountUserIds).toEqual(["recipient-1", "recipient-2"]);
    expect(logger.messages).toEqual([expect.objectContaining({ userId: "recipient-1" })]);
  });
});
