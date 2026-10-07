import { TestBed } from "@suites/unit";
/**
 * MarkAllAsReadUseCase 단위 테스트 — 전체 읽음 처리 + 캐시 무효화
 */
import type { Mocked } from "vitest";

import { createNotificationCacheMock } from "#test/mocks/ports/index";

import {
  NOTIFICATION_CACHE,
  type NotificationCachePort,
} from "../../ports/notification-cache.port.js";
import {
  NOTIFICATION_REPOSITORY,
  type NotificationRepositoryPort,
} from "../../ports/notification.repository.port.js";
import { MarkAllAsReadUseCase } from "./mark-all-as-read.use-case.js";

describe("MarkAllAsReadUseCase", () => {
  let useCase: MarkAllAsReadUseCase;
  let notificationRepo: Mocked<NotificationRepositoryPort>;
  let cache: Mocked<NotificationCachePort>;

  const mockUserId = "user-1";

  beforeEach(async () => {
    const { unit, unitRef } = await TestBed.solitary(MarkAllAsReadUseCase)
      .mock<NotificationCachePort>(NOTIFICATION_CACHE)
      .impl(() => createNotificationCacheMock())
      .compile();
    useCase = unit;
    notificationRepo = unitRef.get(NOTIFICATION_REPOSITORY);
    cache = unitRef.get<NotificationCachePort>(NOTIFICATION_CACHE);
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
