import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { PassThroughNotificationCache } from "#test/doubles/notification/pass-through-notification-cache";
import { SilentLogger } from "#test/doubles/platform/silent-logger";

import { InvalidateRecipientUnreadCountsUseCase } from "./invalidate-recipient-unread-counts.use-case.js";

describe("InvalidateRecipientUnreadCountsUseCase — 계정 삭제 커밋 뒤 받은 사람 캐시 정리", () => {
  it("한 사람의 캐시 정리가 실패해도 나머지를 계속 정리하고 실패한 사람을 남긴다", async () => {
    // Given
    const cache = new PassThroughNotificationCache();
    cache.failUnreadCountInvalidationFor.add("recipient-1");
    const logger = new SilentLogger();
    const useCase = new InvalidateRecipientUnreadCountsUseCase({ cache, logger });

    // When
    const settled = useCase.execute({
      userIds: [UserId.reconstitute("recipient-1"), UserId.reconstitute("recipient-2")],
    });

    // Then
    await expect(settled).resolves.toBeUndefined();
    expect(cache.invalidatedUnreadCountUserIds).toEqual(["recipient-1", "recipient-2"]);
    expect(logger.messages).toEqual([expect.objectContaining({ userId: "recipient-1" })]);
  });
});
