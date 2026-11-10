import {
  createPremiumRenewalUpcomingNotificationMessage,
  createPremiumTrialEndingNotificationMessage,
} from "./system-notification.messages.js";

describe("createPremiumTrialEndingNotificationMessage — 체험 종료 안내 문구", () => {
  // 서울 2026-12-06 12:00, 체험 끝은 서울 2026-12-09 09:00
  const now = new Date("2026-12-06T03:00:00.000Z");
  const endsAt = new Date("2026-12-09T00:00:00.000Z");

  it.each([
    {
      locale: "ko" as const,
      planType: "ANNUAL" as const,
      title: "3일 뒤 연간 구독이 시작돼요",
      body: "12월 9일 결제 예정 · 해지는 스토어에서",
    },
    {
      locale: "ko" as const,
      planType: "MONTHLY" as const,
      title: "3일 뒤 월간 구독이 시작돼요",
      body: "12월 9일 결제 예정 · 해지는 스토어에서",
    },
    {
      locale: "ko" as const,
      planType: null,
      title: "3일 뒤 구독이 시작돼요",
      body: "12월 9일 결제 예정 · 해지는 스토어에서",
    },
    {
      locale: "en" as const,
      planType: "ANNUAL" as const,
      title: "Your annual plan starts in 3 days",
      body: "Billing on Dec 9 · Cancel in your store",
    },
    {
      locale: "en" as const,
      planType: "MONTHLY" as const,
      title: "Your monthly plan starts in 3 days",
      body: "Billing on Dec 9 · Cancel in your store",
    },
    {
      locale: "en" as const,
      planType: null,
      title: "Your subscription starts in 3 days",
      body: "Billing on Dec 9 · Cancel in your store",
    },
  ])(
    "$locale · 자동 갱신 · 요금제 $planType이면 그 요금제로 결제 예정을 알린다",
    ({ locale, planType, title, body }) => {
      // Given
      const input = { locale, timezone: "Asia/Seoul", endsAt, now, willRenew: true, planType };

      // When
      const message = createPremiumTrialEndingNotificationMessage(input);

      // Then
      expect(message).toMatchObject({ title, body });
    },
  );

  it.each([
    {
      locale: "ko" as const,
      title: "무료 체험이 3일 뒤 끝나요",
      body: "12월 9일까지 이용 · 결제는 없어요",
    },
    {
      locale: "en" as const,
      title: "Your free trial ends in 3 days",
      body: "Use it until Dec 9 · No charge",
    },
  ])(
    "$locale · 해지한 체험은 요금제와 결제 예정 없이 끝난다고만 알린다",
    ({ locale, title, body }) => {
      // Given
      const input = {
        locale,
        timezone: "Asia/Seoul",
        endsAt,
        now,
        willRenew: false,
        planType: "ANNUAL" as const,
      };

      // When
      const message = createPremiumTrialEndingNotificationMessage(input);

      // Then
      expect(message).toMatchObject({ title, body });
    },
  );

  it("남은 일수와 날짜는 받는 사람 시간대 달력으로 센다", () => {
    // Given
    const input = {
      locale: "ko" as const,
      timezone: "America/Los_Angeles",
      endsAt,
      now,
      willRenew: true,
      planType: "ANNUAL" as const,
    };

    // When
    const message = createPremiumTrialEndingNotificationMessage(input);

    // Then
    // LA로는 지금이 12/5 19:00, 끝이 12/8 16:00이라 3일 뒤 12월 8일이다
    expect(message).toMatchObject({
      title: "3일 뒤 연간 구독이 시작돼요",
      body: "12월 8일 결제 예정 · 해지는 스토어에서",
    });
  });

  it("다음 날 끝나면 내일, 같은 날 끝나면 오늘로 쓴다", () => {
    // Given
    const tomorrow = { endsAt: new Date("2026-12-07T00:00:00.000Z"), now };
    const today = { endsAt: new Date("2026-12-06T10:00:00.000Z"), now };

    // When
    const messages = [tomorrow, today].map((input) =>
      createPremiumTrialEndingNotificationMessage({
        ...input,
        locale: "ko",
        timezone: "Asia/Seoul",
        willRenew: false,
        planType: null,
      }),
    );

    // Then
    expect(messages.map((message) => message.title)).toEqual([
      "내일 무료 체험이 끝나요",
      "오늘 무료 체험이 끝나요",
    ]);
  });
});

describe("createPremiumRenewalUpcomingNotificationMessage — 연간 구독 갱신 안내 문구", () => {
  // 서울 2026-11-02 12:00, 갱신은 서울 2026-11-09 09:00
  const now = new Date("2026-11-02T03:00:00.000Z");
  const renewsAt = new Date("2026-11-09T00:00:00.000Z");

  it.each([
    {
      locale: "ko" as const,
      title: "7일 뒤 연간 구독이 갱신돼요",
      body: "11월 9일 결제 예정 · 해지는 스토어에서",
    },
    {
      locale: "en" as const,
      title: "Your annual plan renews in 7 days",
      body: "Billing on Nov 9 · Cancel in your store",
    },
  ])("$locale · 남은 일수와 결제 날짜를 받는 사람 달력으로 쓴다", ({ locale, title, body }) => {
    // Given
    const input = { locale, timezone: "Asia/Seoul", renewsAt, now };

    // When
    const message = createPremiumRenewalUpcomingNotificationMessage(input);

    // Then
    expect(message).toMatchObject({ title, body });
  });

  it("다음 날 갱신되면 내일로 쓴다", () => {
    // Given
    const input = {
      locale: "en" as const,
      timezone: "Asia/Seoul",
      renewsAt: new Date("2026-11-03T00:00:00.000Z"),
      now,
    };

    // When
    const message = createPremiumRenewalUpcomingNotificationMessage(input);

    // Then
    expect(message.title).toBe("Your annual plan renews tomorrow");
  });
});
