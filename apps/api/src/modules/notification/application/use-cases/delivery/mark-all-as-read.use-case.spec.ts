import type { Mocked } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import { createNotificationCacheMock } from "#test/mocks/ports/index";

import { MarkAllAsRead } from "./mark-all-as-read.use-case.js";

describe("MarkAllAsRead", () => {
  let useCase: MarkAllAsRead;
  let notificationRepo: Mocked<
    ConstructorParameters<typeof MarkAllAsRead>[0]["notificationRepository"]
  >;
  let cache: Mocked<ConstructorParameters<typeof MarkAllAsRead>[0]["cache"]>;

  const mockUserId = "user-1";

  beforeEach(async () => {
    const markAllAsReadDependencies = mockDeep<ConstructorParameters<typeof MarkAllAsRead>[0]>({
      cache: createNotificationCacheMock(),
    });
    const unit = new MarkAllAsRead(markAllAsReadDependencies);
    useCase = unit;
    notificationRepo = markAllAsReadDependencies.notificationRepository;
    cache = markAllAsReadDependencies.cache;
  });

  it("모든 알림을 읽음 처리하고 캐시를 무효화해야 한다", async () => {
    notificationRepo.markAllAsRead.mockResolvedValue({ count: 5 });

    const result = await useCase.execute(mockUserId, "1.11.0");

    expect(notificationRepo.markAllAsRead).toHaveBeenCalledWith(mockUserId, undefined);
    expect(cache.invalidateUnreadCount).toHaveBeenCalledWith(mockUserId);
    expect(result.count).toBe(5);
  });

  it("기존 앱의 전체 읽음 처리는 표시할 수 있는 알림만 변경한다", async () => {
    // Given
    notificationRepo.markAllAsRead.mockResolvedValue({ count: 2 });

    // When
    const result = await useCase.execute(mockUserId, "1.10.1");

    // Then
    const types = notificationRepo.markAllAsRead.mock.calls[0]?.[1];
    expect(types).toContain("NUDGE_RECEIVED");
    expect(types).not.toContain("NUDGE_REPLIED");
    expect(types).not.toContain("NUDGE_THANKED");
    expect(result.count).toBe(2);
    expect(cache.invalidateUnreadCount).toHaveBeenCalledWith(mockUserId);
  });
});
