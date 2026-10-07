import type { Mocked } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import { PaginationService } from "#api/shared/application/pagination/index";
import { NotificationBuilder } from "#test/builders/index";

import { type NotificationInboxReaderPort } from "../../ports/delivery/notification-inbox.reader.port.js";
import { GetNotifications } from "./get-notifications.use-case.js";

describe("GetNotifications", () => {
  let useCase: GetNotifications;
  let notificationRepo: Mocked<NotificationInboxReaderPort>;
  let paginationService: Mocked<PaginationService>;

  const mockUserId = "user-1";

  beforeEach(async () => {
    NotificationBuilder.resetIdCounter();

    const getNotificationsDependencies = mockDeep<
      ConstructorParameters<typeof GetNotifications>[0]
    >({});
    const unit = new GetNotifications(getNotificationsDependencies);
    useCase = unit;
    notificationRepo = getNotificationsDependencies.notificationInboxReader;
    paginationService = getNotificationsDependencies.paginationService;

    paginationService.normalizeCursorPagination.mockReturnValue({
      cursor: undefined,
      size: 20,
      take: 21,
    });
    paginationService.createCursorPaginatedResponse.mockImplementation((params) => {
      const { items, size } = params;
      const hasNext = items.length > size;
      const actualItems = hasNext ? items.slice(0, size) : items;
      return {
        items: actualItems,
        pagination: {
          hasNext,
          nextCursor: null,
          size,
        },
      };
    });
  });

  it("알림 목록을 페이지네이션으로 조회해야 한다", async () => {
    const notifications = [
      NotificationBuilder.create(mockUserId).withId(1).build(),
      NotificationBuilder.create(mockUserId).withId(2).build(),
    ];
    notificationRepo.findNotificationsByUser.mockResolvedValue(notifications);

    const result = await useCase.execute({ userId: mockUserId, size: 20, appVersion: "1.11.0" });

    expect(paginationService.normalizeCursorPagination).toHaveBeenCalledWith({
      cursor: undefined,
      size: 20,
    });
    expect(notificationRepo.findNotificationsByUser).toHaveBeenCalledWith({
      userId: mockUserId,
      cursor: undefined,
      size: 20,
      unreadOnly: undefined,
      types: undefined,
    });
    expect(result.items).toHaveLength(2);
  });

  it("unreadOnly 필터를 전달해야 한다", async () => {
    notificationRepo.findNotificationsByUser.mockResolvedValue([]);

    await useCase.execute({ userId: mockUserId, unreadOnly: true });

    expect(notificationRepo.findNotificationsByUser).toHaveBeenCalledWith(
      expect.objectContaining({ unreadOnly: true }),
    );
  });

  it("category가 'SOCIAL'이면 소셜 타입 배열을 전달해야 한다", async () => {
    notificationRepo.findNotificationsByUser.mockResolvedValue([]);

    await useCase.execute({ userId: mockUserId, category: "SOCIAL" });

    expect(notificationRepo.findNotificationsByUser).toHaveBeenCalledWith(
      expect.objectContaining({
        types: expect.arrayContaining([
          "FOLLOW_NEW",
          "FOLLOW_ACCEPTED",
          "NUDGE_RECEIVED",
          "CHEER_RECEIVED",
          "FRIEND_COMPLETED",
        ]),
      }),
    );
  });

  it("category가 'NOTICE'이면 공지 타입 배열을 전달해야 한다", async () => {
    notificationRepo.findNotificationsByUser.mockResolvedValue([]);

    await useCase.execute({ userId: mockUserId, category: "NOTICE" });

    expect(notificationRepo.findNotificationsByUser).toHaveBeenCalledWith(
      expect.objectContaining({
        types: expect.arrayContaining(["SYSTEM_NOTICE", "ADMIN_BROADCAST", "ADMIN_TARGETED"]),
      }),
    );
  });

  it("1.11.0의 전체 목록은 모든 알림 타입을 조회한다", async () => {
    notificationRepo.findNotificationsByUser.mockResolvedValue([]);

    await useCase.execute({ userId: mockUserId, category: "ALL", appVersion: "1.11.0" });

    expect(notificationRepo.findNotificationsByUser).toHaveBeenCalledWith(
      expect.objectContaining({ types: undefined }),
    );
  });

  it.each([undefined, "1.10.0", "1.10.1"])(
    "앱 버전 %s의 목록 조회에서 새 알림은 페이지네이션 전에 제외한다",
    async (appVersion) => {
      // Given
      notificationRepo.findNotificationsByUser.mockResolvedValue([]);

      // When
      await useCase.execute({ userId: mockUserId, appVersion, cursor: 5 });

      // Then
      const types = notificationRepo.findNotificationsByUser.mock.calls[0]?.[0].types;
      expect(types).toContain("NUDGE_RECEIVED");
      expect(types).not.toContain("NUDGE_REPLIED");
      expect(types).not.toContain("NUDGE_THANKED");
    },
  );

  it("커서를 전달해야 한다", async () => {
    paginationService.normalizeCursorPagination.mockReturnValue({
      cursor: 5,
      size: 20,
      take: 21,
    });
    notificationRepo.findNotificationsByUser.mockResolvedValue([]);

    await useCase.execute({ userId: mockUserId, cursor: 5, size: 20 });

    expect(notificationRepo.findNotificationsByUser).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: 5 }),
    );
  });
});
