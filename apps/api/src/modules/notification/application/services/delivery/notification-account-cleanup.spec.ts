import { mockDeep } from "vitest-mock-extended";

import {
  createNotificationCacheMock,
  createNotificationRepositoryMock,
} from "#test/mocks/ports/index";

import { NotificationAccountCleanup } from "./notification-account-cleanup.js";

describe("NotificationAccountCleanup", () => {
  it("bounded context 저장소에 actor 개인정보 정리를 위임한다", async () => {
    const notificationAccountCleanupDependencies = mockDeep<
      ConstructorParameters<typeof NotificationAccountCleanup>[0]
    >({ repository: createNotificationRepositoryMock(), cache: createNotificationCacheMock() });
    const unit = new NotificationAccountCleanup(notificationAccountCleanupDependencies);
    const repository = notificationAccountCleanupDependencies.repository;
    const cache = notificationAccountCleanupDependencies.cache;
    repository.deleteNotificationsByActorId.mockResolvedValue({
      count: 3,
      affectedUserIds: ["recipient-1", "recipient-2"],
    });

    const result = await unit.cleanupInTransaction("user-1");
    expect(result).toEqual({ affectedUserIds: ["recipient-1", "recipient-2"] });
    expect(repository.deleteNotificationsByActorId).toHaveBeenCalledWith("user-1");
    expect(cache.invalidateUnreadCount).not.toHaveBeenCalled();

    cache.invalidateUnreadCount.mockRejectedValueOnce(new Error("캐시 연결 오류"));
    await expect(unit.settleAfterCommit(result)).resolves.toBeUndefined();
    expect(cache.invalidateUnreadCount).toHaveBeenCalledTimes(2);
    expect(cache.invalidateUnreadCount).toHaveBeenCalledWith("recipient-1");
    expect(cache.invalidateUnreadCount).toHaveBeenCalledWith("recipient-2");
  });
});
