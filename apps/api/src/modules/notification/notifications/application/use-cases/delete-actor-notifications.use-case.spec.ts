import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { InMemoryNotificationRepository } from "#test/doubles/notification/in-memory-notification.repository";
import { createInboxNotificationFixture } from "#test/fixtures/notification/notification.fixture";

import { DeleteActorNotificationsUseCase } from "./delete-actor-notifications.use-case.js";

const ACTOR_ID = "user-1";

describe("DeleteActorNotificationsUseCase — 탈퇴한 사람이 남긴 알림 정리", () => {
  it("탈퇴한 사람이 보낸 알림만 지우고 그 알림을 받은 사람을 돌려준다", async () => {
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
    const useCase = new DeleteActorNotificationsUseCase({ repository });

    // When
    const result = await useCase.execute({ actorId: UserId.reconstitute(ACTOR_ID) });

    // Then
    expect(result.affectedUserIds.map((userId) => userId.value)).toEqual([
      "recipient-1",
      "recipient-2",
    ]);
    expect(repository.rowOf(1)).toBeUndefined();
    expect(repository.rowOf(2)).toBeUndefined();
    expect(repository.rowOf(3)).toBeDefined();
  });
});
