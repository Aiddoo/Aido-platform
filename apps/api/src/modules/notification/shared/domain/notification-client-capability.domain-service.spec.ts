import { NOTIFICATION_TYPE } from "@aido/api/vocabulary";
import { describe, expect, it } from "vitest";

import {
  notificationInboxScopes,
  notificationTypesOfCategory,
  resolveNotificationInboxScope,
  supportsNotificationType,
  toWireNotificationType,
  visibleNotificationTypes,
} from "./notification-client-capability.domain-service.js";

describe("알림 클라이언트 호환성", () => {
  it.each([
    { version: undefined, expected: false },
    { version: null, expected: false },
    { version: "invalid", expected: false },
    { version: "1.10.1", expected: false },
    { version: "1.11.0", expected: true },
    { version: "1.11.0+12", expected: true },
    { version: "2.0.0", expected: true },
  ])("앱 버전 $version의 콕 답장 지원 여부는 $expected이다", ({ version, expected }) => {
    // Given
    const appVersion = version;

    // When
    const result = supportsNotificationType("NUDGE_REPLIED", appVersion);

    // Then
    expect(result).toBe(expected);
  });

  it.each([
    "INVITE_JOINED",
    "INVITE_REWARDED",
    "INVITE_PROGRESS",
    "INVITE_QUALIFY_REMINDER",
    "PREMIUM_GRANT_ENDING",
  ] as const)("%s는 1.12.1에는 숨기고 1.13.0부터 보인다", (type) => {
    // Given
    const releasedVersion = "1.12.1";
    const updatedVersion = "1.13.0";

    // When
    const released = supportsNotificationType(type, releasedVersion);
    const updated = supportsNotificationType(type, updatedVersion);

    // Then
    expect(released).toBe(false);
    expect(updated).toBe(true);
  });

  it("기존 알림은 버전 헤더가 없어도 보낸다", () => {
    // Given
    const appVersion = undefined;

    // When
    const result = supportsNotificationType("FOLLOW_NEW", appVersion);

    // Then
    expect(result).toBe(true);
  });

  it("1.12.1 알림함은 초대 알림만 빼고 콕 답장은 유지한다", () => {
    // Given
    const appVersion = "1.12.1";

    // When
    const types = visibleNotificationTypes(appVersion);

    // Then
    expect(types).toContain("NUDGE_REPLIED");
    expect(types).not.toContain("INVITE_JOINED");
    expect(types).not.toContain("PREMIUM_GRANT_ENDING");
    expect(types).not.toContain("INVITE_PROGRESS");
    expect(types).not.toContain("INVITE_QUALIFY_REMINDER");
    // 서버 전용 체험 종료·연간 갱신 안내는 SYSTEM_NOTICE로 보내므로 모든 앱 알림함에 보인다
    expect(types).toContain("PREMIUM_TRIAL_ENDING");
    expect(types).toContain("PREMIUM_RENEWAL_UPCOMING");
    expect(types).toHaveLength(Object.values(NOTIFICATION_TYPE).length - 5 + 2);
  });

  it("서버 전용 체험 종료·연간 갱신 알림은 모든 앱에 SYSTEM_NOTICE로 보내고 계약 타입은 그대로 둔다", () => {
    // Given
    const types = [
      "PREMIUM_TRIAL_ENDING",
      "PREMIUM_RENEWAL_UPCOMING",
      "PREMIUM_GRANT_ENDING",
      "SYSTEM_NOTICE",
    ] as const;

    // When
    const wire = types.map(toWireNotificationType);

    // Then
    expect(wire).toEqual([
      "SYSTEM_NOTICE",
      "SYSTEM_NOTICE",
      "PREMIUM_GRANT_ENDING",
      "SYSTEM_NOTICE",
    ]);
  });

  it("공지 카테고리는 계약 표에 서버 전용 체험 종료 알림을 더해 고른다", () => {
    // Given
    const category = "NOTICE" as const;

    // When
    const types = notificationTypesOfCategory(category);

    // Then
    expect(types).toContain("PREMIUM_TRIAL_ENDING");
    expect(types).toContain("PREMIUM_GRANT_ENDING");
    expect(notificationTypesOfCategory("TODO")).not.toContain("PREMIUM_TRIAL_ENDING");
  });

  it("최신 앱은 전체 알림을 조건 없이 조회한다", () => {
    // Given
    const appVersion = "1.13.0";

    // When
    const types = visibleNotificationTypes(appVersion);

    // Then
    expect(types).toBeUndefined();
  });

  it("앱이 지원하는 알림 단계마다 알림 수 캐시를 분리하고 무효화 대상에 모두 포함한다", () => {
    // Given
    const versions = ["1.10.1", "1.12.1", "1.13.0"];

    // When
    const scopes = versions.map((version) => resolveNotificationInboxScope(version));

    // Then
    expect(scopes).toEqual(["legacy", "since-1.11.0", "all"]);
    expect(notificationInboxScopes()).toEqual(["all", "legacy", "since-1.11.0"]);
  });
});
