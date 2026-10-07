import type { Mocked } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import { createNotificationCacheMock } from "#test/mocks/ports/notification-cache.mock";
import { createNotificationRepositoryMock } from "#test/mocks/ports/notification.mock";

import { type NotificationCachePort } from "../../ports/delivery/notification-cache.port.js";
import { type NotificationRepositoryPort } from "../../ports/delivery/notification.repository.port.js";
import { MarkNotificationOpened } from "./mark-notification-opened.use-case.js";

describe("MarkNotificationOpened", () => {
  let useCase: MarkNotificationOpened;
  let repository: Mocked<NotificationRepositoryPort>;
  let cache: Mocked<NotificationCachePort>;

  const mockUserId = "user-1";
  const mockNotificationId = 42;

  beforeEach(async () => {
    const markNotificationOpenedDependencies = mockDeep<
      ConstructorParameters<typeof MarkNotificationOpened>[0]
    >({
      notificationRepository: createNotificationRepositoryMock(),
      cache: createNotificationCacheMock(),
    });
    const unit = new MarkNotificationOpened(markNotificationOpenedDependencies);
    useCase = unit;
    repository = markNotificationOpenedDependencies.notificationRepository;
    cache = markNotificationOpenedDependencies.cache;
  });

  it("열림 기록에 성공하면 미읽음 카운트를 무효화하고 true를 반환한다", async () => {
    repository.markAsOpened.mockResolvedValue(true);

    const result = await useCase.execute(mockUserId, mockNotificationId);

    expect(result).toBe(true);
    expect(repository.markAsOpened).toHaveBeenCalledWith(mockNotificationId, mockUserId);
    expect(cache.invalidateUnreadCount).toHaveBeenCalledWith(mockUserId);
  });

  it("열림 기록이 없으면(이미 열림/타 사용자/부재) 캐시를 무효화하지 않고 false를 반환한다", async () => {
    repository.markAsOpened.mockResolvedValue(false);

    const result = await useCase.execute(mockUserId, mockNotificationId);

    expect(result).toBe(false);
    expect(cache.invalidateUnreadCount).not.toHaveBeenCalled();
  });
});
