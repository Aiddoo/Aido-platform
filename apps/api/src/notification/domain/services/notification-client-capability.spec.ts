import { describe, expect, it } from "vitest";

import {
  resolveNotificationInboxScope,
  supportsNudgeInteractions,
  visibleNotificationTypes,
} from "./notification-client-capability.js";

describe("알림 클라이언트 호환성", () => {
  it.each([
    { version: undefined, expected: false },
    { version: null, expected: false },
    { version: "invalid", expected: false },
    { version: "1.10.0", expected: false },
    { version: "1.10.1", expected: false },
    { version: "1.11.0", expected: true },
    { version: "1.11.0+12", expected: true },
    { version: "1.12.0", expected: true },
    { version: "2.0.0", expected: true },
  ])("앱 버전 $version의 콕 답장·감사 지원 여부는 $expected이다", ({ version, expected }) => {
    // Given
    const appVersion = version;

    // When
    const result = supportsNudgeInteractions(appVersion);

    // Then
    expect(result).toBe(expected);
  });

  it("기존 앱에 새 알림만 필터링하면 빈 배열을 반환한다", () => {
    // Given
    const appVersion = "1.10.1";

    // When
    const types = visibleNotificationTypes(appVersion, ["NUDGE_REPLIED", "NUDGE_THANKED"]);

    // Then
    expect(types).toEqual([]);
  });

  it("기존·새 앱의 알림 수 캐시를 분리한다", () => {
    // Given
    const existingVersion = "1.10.1";
    const updatedVersion = "1.11.0";

    // When
    const existingScope = resolveNotificationInboxScope(existingVersion);
    const updatedScope = resolveNotificationInboxScope(updatedVersion);

    // Then
    expect(existingScope).toBe("legacy");
    expect(updatedScope).toBe("all");
  });
});
