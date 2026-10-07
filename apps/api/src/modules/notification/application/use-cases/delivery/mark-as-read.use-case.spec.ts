import type { Mocked } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import { NotificationBuilder } from "#test/builders/index";
import { createNotificationCacheMock } from "#test/mocks/ports/index";

import { MarkAsRead } from "./mark-as-read.use-case.js";

describe("MarkAsRead", () => {
  let useCase: MarkAsRead;
  let notificationReader: Mocked<
    ConstructorParameters<typeof MarkAsRead>[0]["notificationInboxReader"]
  >;
  let notificationRepo: Mocked<
    ConstructorParameters<typeof MarkAsRead>[0]["notificationRepository"]
  >;
  let cache: Mocked<ConstructorParameters<typeof MarkAsRead>[0]["cache"]>;

  const mockUserId = "user-1";

  beforeEach(async () => {
    NotificationBuilder.resetIdCounter();

    const markAsReadDependencies = mockDeep<ConstructorParameters<typeof MarkAsRead>[0]>({
      cache: createNotificationCacheMock(),
    });
    const unit = new MarkAsRead(markAsReadDependencies);
    useCase = unit;
    notificationReader = markAsReadDependencies.notificationInboxReader;
    notificationRepo = markAsReadDependencies.notificationRepository;
    cache = markAsReadDependencies.cache;
  });

  it("소유한 미읽음 알림을 읽음 처리하고 캐시를 무효화해야 한다", async () => {
    const notification = NotificationBuilder.create(mockUserId).withId(1).asUnread().build();
    notificationReader.findNotificationById.mockResolvedValue(notification);
    notificationRepo.markAsRead.mockResolvedValue(true);

    await useCase.execute(mockUserId, 1);

    expect(notificationRepo.markAsRead).toHaveBeenCalledWith(1, mockUserId);
    expect(cache.invalidateUnreadCount).toHaveBeenCalledWith(mockUserId);
  });

  it("알림이 없으면 NOTIFICATION_1004", async () => {
    notificationReader.findNotificationById.mockResolvedValue(null);

    await expect(useCase.execute(mockUserId, 999)).rejects.toMatchObject({
      errorCode: "NOTIFICATION_1004",
    });
    expect(notificationRepo.markAsRead).not.toHaveBeenCalled();
  });

  it("다른 사용자의 알림이면 NOTIFICATION_1005", async () => {
    const notification = NotificationBuilder.create("other-user").withId(1).build();
    notificationReader.findNotificationById.mockResolvedValue(notification);

    await expect(useCase.execute(mockUserId, 1)).rejects.toMatchObject({
      errorCode: "NOTIFICATION_1005",
    });
    expect(notificationRepo.markAsRead).not.toHaveBeenCalled();
  });

  it("이미 읽은 알림이면 무동작", async () => {
    const notification = NotificationBuilder.create(mockUserId).withId(1).asRead().build();
    notificationReader.findNotificationById.mockResolvedValue(notification);

    await useCase.execute(mockUserId, 1);

    expect(notificationRepo.markAsRead).not.toHaveBeenCalled();
  });
});
