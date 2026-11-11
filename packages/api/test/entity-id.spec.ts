import { describe, expect, it } from "vitest";

import {
  broadcastCampaignIdParamSchema,
  entityIdSchema,
  revokeSessionSchema,
  targetedNotificationSchema,
} from "../src/index.js";
import { ENTITY_ID_PATTERN } from "../src/vocabulary/index.js";

// 운영 DB에서 확인한 실제 ID 모양들
const ISSUED_HEX_ID = "c0f3a9b2c4d5e6f708192a3b4"; // 지금 발급: c + 24 hex
const LEGACY_CUID_V1 = "clz7x5p8k0001qz0z8z8z8z8z"; // 옛 행: CUID v1 25자
const LEGACY_LONG_USER_ID = "cm1abcdefghijklmnopqrstuvwxy"; // 옛 사용자 ID 하나: c + 28자

describe("ENTITY_ID_PATTERN — 서버가 발급한 엔티티 ID", () => {
  it.each([
    { label: "지금 발급하는 c + 24 hex", id: ISSUED_HEX_ID },
    { label: "옛 CUID v1(25자)", id: LEGACY_CUID_V1 },
    { label: "29자인 옛 사용자 ID", id: `${LEGACY_LONG_USER_ID}z` },
  ])("$label을 받는다", ({ id }) => {
    // Given / When
    const matched = ENTITY_ID_PATTERN.test(id);

    // Then
    expect(matched).toBe(true);
  });

  it.each([
    { label: "대문자", id: "C0F3A9B2C4D5E6F708192A3B4" },
    { label: "하이픈", id: "c0f3a9b2-c4d5-e6f7-0819-2a3b4" },
    { label: "빈 문자열", id: "" },
    { label: "c로 시작하지 않는 UUID", id: "0f3a9b2c-4d5e-4f70-8192-a3b4c5d6e7f8" },
    { label: "65자", id: `c${"a".repeat(64)}` },
  ])("$label은 거절한다", ({ id }) => {
    // Given / When
    const matched = ENTITY_ID_PATTERN.test(id);

    // Then
    expect(matched).toBe(false);
  });

  it("64자까지는 받는다", () => {
    // Given
    const longest = `c${"a".repeat(63)}`;

    // When
    const result = entityIdSchema.safeParse(longest);

    // Then
    expect(result.success).toBe(true);
  });
});

describe("출시 앱 요청이 엔티티 ID 규칙으로도 통과한다", () => {
  it.each([ISSUED_HEX_ID, LEGACY_CUID_V1])(
    "서버가 준 세션 ID %s로 세션 해제를 요청할 수 있다",
    (sessionId) => {
      // Given / When
      const result = revokeSessionSchema.safeParse({ sessionId });

      // Then
      expect(result.success).toBe(true);
    },
  );

  it("관리자 캠페인 ID와 대상 사용자 ID 목록을 받는다", () => {
    // Given
    const targeted = {
      title: "공지",
      body: "점검 안내",
      userIds: [ISSUED_HEX_ID, LEGACY_CUID_V1, `${LEGACY_LONG_USER_ID}z`],
    };

    // When
    const campaign = broadcastCampaignIdParamSchema.safeParse({ campaignId: ISSUED_HEX_ID });
    const notification = targetedNotificationSchema.safeParse(targeted);

    // Then
    expect([campaign.success, notification.success]).toEqual([true, true]);
  });
});
