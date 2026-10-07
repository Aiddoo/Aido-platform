import type { Mocked } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import { createNotificationCacheMock } from "#test/mocks/ports/index";

import { type NotificationCachePort } from "../../ports/delivery/notification-cache.port.js";
import { type NotificationInboxReaderPort } from "../../ports/delivery/notification-inbox.reader.port.js";
import { GetUnreadCount } from "./get-unread-count.use-case.js";

describe("GetUnreadCount", () => {
  let useCase: GetUnreadCount;
  let notificationRepo: Mocked<NotificationInboxReaderPort>;
  let cache: Mocked<NotificationCachePort>;

  const mockUserId = "user-1";

  beforeEach(async () => {
    const getUnreadCountDependencies = mockDeep<ConstructorParameters<typeof GetUnreadCount>[0]>({
      cache: createNotificationCacheMock(),
    });
    const unit = new GetUnreadCount(getUnreadCountDependencies);
    useCase = unit;
    notificationRepo = getUnreadCountDependencies.notificationInboxReader;
    cache = getUnreadCountDependencies.cache;

    cache.wrapUnreadCount.mockImplementation((_userId, factory) => factory());
  });

  it("캐시를 통해 읽지 않은 알림 수를 반환해야 한다", async () => {
    notificationRepo.countUnread.mockResolvedValue(5);

    const result = await useCase.execute(mockUserId);

    expect(cache.wrapUnreadCount).toHaveBeenCalledWith(mockUserId, expect.any(Function), "legacy");
    expect(result).toBe(5);
  });

  it("1.11.0의 미읽음 수는 기존 앱과 분리된 캐시에서 모든 알림을 센다", async () => {
    // Given
    notificationRepo.countUnread.mockResolvedValue(7);

    // When
    const result = await useCase.execute(mockUserId, "1.11.0");

    // Then
    expect(cache.wrapUnreadCount).toHaveBeenCalledWith(mockUserId, expect.any(Function), "all");
    expect(notificationRepo.countUnread).toHaveBeenCalledWith(mockUserId, undefined);
    expect(result).toBe(7);
  });

  it("기존 앱의 미읽음 수에는 답장·감사 알림을 포함하지 않는다", async () => {
    // Given
    notificationRepo.countUnread.mockResolvedValue(3);

    // When
    await useCase.execute(mockUserId, "1.10.1");

    // Then
    const types = notificationRepo.countUnread.mock.calls[0]?.[1];
    expect(types).toContain("NUDGE_RECEIVED");
    expect(types).not.toContain("NUDGE_REPLIED");
    expect(types).not.toContain("NUDGE_THANKED");
  });
});
