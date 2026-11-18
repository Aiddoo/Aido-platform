import { resolveNotificationInboxScope } from "../../shared/domain/notification-client-capability.domain-service.js";
import { carriesUnreadBadge, pushBadgeFor } from "./push-badge.domain-service.js";

describe("푸시 배지 대상", () => {
  it.each([
    ["1.17.0", true],
    ["1.17.3", true],
    ["2.0.0", true],
    ["1.16.9", false],
    ["1.15.1", false],
    [null, false],
  ] as const)("앱 %s 기기에 배지를 싣는지: %s", (appVersion, expected) => {
    // When
    const carries = carriesUnreadBadge(appVersion);

    // Then
    expect(carries).toBe(expected);
  });

  it("배지를 싣는 앱은 모든 종류를 보는 알림함 범위라 그 범위의 안 읽은 수를 그대로 쓴다", () => {
    // Given
    const firstBadgeAppVersion = "1.17.0";

    // When
    const scope = resolveNotificationInboxScope(firstBadgeAppVersion);
    const badge = pushBadgeFor({ appVersion: firstBadgeAppVersion, unreadCount: 7 });

    // Then
    expect(scope).toBe("all");
    expect(badge).toBe(7);
  });
});
