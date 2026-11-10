import { NotificationBuilder } from "#test/builders/index";
import { InMemoryNotificationRepository } from "#test/doubles/notification/in-memory-notification.repository";
import { PassThroughNotificationCache } from "#test/doubles/notification/pass-through-notification-cache";

import { GetUnreadNotificationCountUseCase } from "./get-unread-notification-count.use-case.js";

const USER_ID = "user-1";

function seedNotifications() {
  return [
    NotificationBuilder.create(USER_ID).withId(1).withType("NUDGE_RECEIVED").build(),
    NotificationBuilder.create(USER_ID).withId(2).withType("NUDGE_REPLIED").build(),
    NotificationBuilder.create(USER_ID).withId(3).withType("NUDGE_THANKED").build(),
    NotificationBuilder.create(USER_ID).withId(4).asRead().build(),
    NotificationBuilder.create("other-user").withId(5).build(),
  ];
}

describe("GetUnreadNotificationCountUseCase — 미읽음 알림 수", () => {
  it("버전을 보내지 않은 앱은 legacy 캐시 범위에서 답장·감사 알림을 빼고 센다", async () => {
    // Given
    const cache = new PassThroughNotificationCache();
    const useCase = new GetUnreadNotificationCountUseCase({
      notificationInboxReader: new InMemoryNotificationRepository(seedNotifications()),
      cache,
    });

    // When
    const result = await useCase.execute({ userId: USER_ID });

    // Then
    expect(result).toBe(1);
    expect(cache.readScopes).toEqual(["legacy"]);
  });

  it("최신 앱은 기존 앱과 분리된 캐시 범위에서 모든 미읽음 알림을 센다", async () => {
    // Given
    const cache = new PassThroughNotificationCache();
    const useCase = new GetUnreadNotificationCountUseCase({
      notificationInboxReader: new InMemoryNotificationRepository(seedNotifications()),
      cache,
    });

    // When
    const result = await useCase.execute({ userId: USER_ID, appVersion: "1.13.0" });

    // Then
    expect(result).toBe(3);
    expect(cache.readScopes).toEqual(["all"]);
  });

  it("기존 앱의 미읽음 수에는 답장·감사 알림을 포함하지 않는다", async () => {
    // Given
    const useCase = new GetUnreadNotificationCountUseCase({
      notificationInboxReader: new InMemoryNotificationRepository(seedNotifications()),
      cache: new PassThroughNotificationCache(),
    });

    // When
    const result = await useCase.execute({ userId: USER_ID, appVersion: "1.10.1" });

    // Then
    expect(result).toBe(1);
  });
});
