import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";

import type { CreateNotificationData } from "../../../inbox/application/ports/notification-draft.port.js";
import type { MarketingReconfirmRecipient } from "../ports/marketing-consent-reconfirm.port.js";
import { ReconfirmMarketingConsentsUseCase } from "./reconfirm-marketing-consents.use-case.js";

const NOW = Temporal.Instant.from("2026-12-01T02:00:00.000Z");

/** 표시한 사용자를 다시 고르지 않는 대역. 조건부 UPDATE는 실제 PG에서 확인한다. */
function createReconfirm(
  targets: readonly MarketingReconfirmRecipient[],
  quietUserIds: ReadonlySet<string> = new Set(),
) {
  const reconfirmed = new Set<string>();
  const cutoffs: Temporal.Instant[] = [];
  const sent: CreateNotificationData[] = [];
  const useCase = new ReconfirmMarketingConsentsUseCase({
    reconfirmAccess: {
      findMarketingReconfirmTargets: async (params) => {
        cutoffs.push(params.cutoff);
        return targets.filter((target) => !reconfirmed.has(target.userId)).slice(0, params.limit);
      },
      claimMarketingReconfirm: async (users) => {
        const userIds = users.map((user) => user.value);
        const claimed = targets.filter(
          (target) => userIds.includes(target.userId) && !reconfirmed.has(target.userId),
        );
        for (const target of claimed) {
          reconfirmed.add(target.userId);
        }
        return claimed;
      },
    },
    localeReader: {
      getLocales: async (users) =>
        new Map(users.map(({ value: userId }) => [userId, userId.endsWith("en") ? "en" : "ko"])),
    },
    timezoneReader: {
      getTimezones: async (userIds) => new Map(userIds.map((userId) => [userId, "Asia/Seoul"])),
    },
    quietHoursReader: {
      findUsersInQuietHours: async (users) =>
        new Set(users.map((user) => user.value).filter((userId) => quietUserIds.has(userId))),
    },
    notificationPublisher: {
      publishBatch: async (notices) => {
        sent.push(...notices);
        return { count: notices.length };
      },
    },
    unitOfWork: new ImmediateUnitOfWork(),
    logger: { log: () => {} },
  });
  return { useCase, sent, cutoffs };
}

describe("ReconfirmMarketingConsentsUseCase — 광고성 수신 동의 2년 재확인", () => {
  it("2년 전 기준으로 고른 사용자에게 처음 동의한 날짜와 함께 한 번만 알린다", async () => {
    // Given
    const { useCase, sent, cutoffs } = createReconfirm([
      {
        userId: "user-ko",
        marketingAgreedAt: Temporal.Instant.from("2024-11-08T16:00:00.000Z"),
        marketingPushAgreedAt: Temporal.Instant.from("2024-12-01T00:00:00.000Z"),
      },
      {
        userId: "user-en",
        marketingAgreedAt: null,
        marketingPushAgreedAt: Temporal.Instant.from("2024-11-08T16:00:00.000Z"),
      },
    ]);

    // When
    const first = await useCase.execute({ now: NOW });
    const second = await useCase.execute({ now: NOW });

    // Then
    expect(cutoffs[0]).toEqual(Temporal.Instant.from("2024-12-01T02:00:00.000Z"));
    expect(first.notifiedCount).toBe(2);
    expect(second.notifiedCount).toBe(0);
    expect(
      sent.map(({ userId, title, body, type, purpose, action }) => ({
        userId,
        title,
        body,
        type,
        purpose,
        action,
      })),
    ).toEqual([
      {
        userId: "user-ko",
        title: "광고성 알림 수신에 동의 중이에요",
        body: "2024.11.09 동의 · 설정에서 바꿀 수 있어요",
        type: "SYSTEM_NOTICE",
        purpose: "TRANSACTIONAL",
        action: { type: "DEEP_LINK", url: "/settings/notifications" },
      },
      {
        userId: "user-en",
        title: "You’re opted in to marketing alerts",
        body: "Agreed Nov 9, 2024 · Change in Settings",
        type: "SYSTEM_NOTICE",
        purpose: "TRANSACTIONAL",
        action: { type: "DEEP_LINK", url: "/settings/notifications" },
      },
    ]);
  });

  it("동의 시각이 없는 대상(동시에 철회됨)은 표시만 하고 알리지 않는다", async () => {
    // Given
    const { useCase, sent } = createReconfirm([
      { userId: "user-ko", marketingAgreedAt: null, marketingPushAgreedAt: null },
    ]);

    // When
    const result = await useCase.execute({ now: NOW });

    // Then
    expect(result.notifiedCount).toBe(0);
    expect(sent).toEqual([]);
  });

  it("현지 야간인 사용자는 표시하지 않고 남겨, 낮이 된 다음 실행에서 알린다", async () => {
    // Given: 런던은 지금 야간(02:00), 서울은 낮(11:00)
    const quietUserIds = new Set(["user-london"]);
    const { useCase, sent } = createReconfirm(
      [
        {
          userId: "user-seoul",
          marketingAgreedAt: Temporal.Instant.from("2024-11-08T16:00:00.000Z"),
          marketingPushAgreedAt: null,
        },
        {
          userId: "user-london",
          marketingAgreedAt: Temporal.Instant.from("2024-11-08T16:00:00.000Z"),
          marketingPushAgreedAt: null,
        },
      ],
      quietUserIds,
    );

    // When
    const night = await useCase.execute({ now: NOW });
    quietUserIds.clear();
    const daytime = await useCase.execute({ now: NOW });

    // Then
    expect(night.notifiedCount).toBe(1);
    expect(daytime.notifiedCount).toBe(1);
    expect(sent.map((notice) => notice.userId)).toEqual(["user-seoul", "user-london"]);
  });
});
