import { pushNotificationDataSchema } from "@aido/api";

import { StubMarketingPushOptOutToken } from "#test/doubles/notification/stub-marketing-push-opt-out-token";

import { PushNotificationPayloadMapper } from "./push-notification-payload.mapper.js";

describe("PushNotificationPayloadMapper — 푸시 payload 조립", () => {
  let factory: PushNotificationPayloadMapper;
  let optOutTokens: StubMarketingPushOptOutToken;

  beforeEach(() => {
    optOutTokens = new StubMarketingPushOptOutToken();
    factory = new PushNotificationPayloadMapper({ marketingOptOutTokens: optOutTokens });
  });

  it("단건 payload는 기본 액션, context, 댓글 routing과 분석 식별자를 조립한다", () => {
    // Given
    const commentId = "cmt92zn3n000b7voxx9quc2th";
    const payload = factory.createSingle({
      data: {
        userId: "user-1",
        type: "TODO_SHARED",
        title: "새 댓글",
        body: "본문",
        todoId: 42,
        friendId: "friend-1",
        metadata: {
          commentId,
          threadRootId: commentId,
          activityKind: "COMMENT",
        },
        campaignKey: "transactional.v1",
        variantId: "comment.created.ko.v1",
      },
      notificationId: 101,
      dispatchId: 202,
    });

    // Then
    expect(payload).toEqual({
      title: "새 댓글",
      body: "본문",
      data: {
        notificationId: 101,
        type: "TODO_SHARED",
        action: { type: "DEEP_LINK" },
        context: { todoId: 42, friendId: "friend-1" },
        routing: {
          commentId,
          threadRootId: commentId,
          activityKind: "COMMENT",
        },
        navigation: {
          kind: "TODO_COMMENT",
          todoId: 42,
          commentId,
          threadCommentId: commentId,
          activityKind: "COMMENT",
        },
        campaignKey: "transactional.v1",
        variantId: "comment.created.ko.v1",
        dispatchId: 202,
      },
      ttlSeconds: 43_200,
      priority: "high",
    });
    expect(optOutTokens.issuedUserIds).toEqual([]);
  });

  it("단건과 배치 모두 알림 종류의 보관 시간을 싣는다(할 일 리마인더 1시간, 재방문 안내 하루)", () => {
    // Given
    const reminder = {
      userId: "user-1",
      type: "TODO_REMINDER",
      title: "곧 시작",
      body: "본문",
    } as const;
    const winback = {
      userId: "user-1",
      type: "WINBACK",
      title: "다시 와요",
      body: "본문",
    } as const;

    // When
    const single = factory.createSingle({ data: reminder, notificationId: 1, dispatchId: 2 });
    const batch = factory.createBatch({ data: winback, notificationId: 3, dispatchId: 4 });

    // Then
    expect([single, batch]).toEqual([
      expect.objectContaining({ ttlSeconds: 3600, priority: "high" }),
      expect.objectContaining({ ttlSeconds: 86_400, priority: "high" }),
    ]);
  });

  it("마케팅 단건은 opt-out token과 interactive category를 포함한다", () => {
    // When
    const payload = factory.createSingle({
      data: {
        userId: "user-1",
        type: "LUNCH_NUDGE",
        title: "점심",
        body: "본문",
        purpose: "ENGAGEMENT",
      },
      notificationId: 1,
      dispatchId: 2,
    });

    // Then
    expect(payload.categoryId).toBe("MARKETING");
    expect(payload.data).toMatchObject({
      purpose: "ENGAGEMENT",
      marketingOptOutToken: "opt-out:user-1",
    });
    expect(optOutTokens.issuedUserIds).toEqual(["user-1"]);
  });

  it("마케팅 배치도 단건과 같은 interactive category와 opt-out data를 싣는다", () => {
    // When
    const payload = factory.createBatch({
      data: {
        userId: "user-1",
        type: "SYSTEM_NOTICE",
        title: "새 기능",
        body: "본문",
        purpose: "ENGAGEMENT",
        campaignKey: "feature-discovery-2026-08",
      },
      notificationId: 10,
      dispatchId: 20,
    });

    // Then
    expect(payload).toMatchObject({
      userId: "user-1",
      dispatchId: 20,
      requiresFeatureCapability: true,
      title: "(광고) 새 기능",
      body: "본문\n수신 거부: 설정 > 알림",
      data: {
        notificationId: 10,
        dispatchId: 20,
        marketingOptOutToken: "opt-out:user-1",
      },
    });
    expect(payload.categoryId).toBe("MARKETING");
  });

  it("명시 action URL은 타입과 함께 보존한다", () => {
    // When
    const payload = factory.createSingle({
      data: {
        userId: "user-1",
        type: "SYSTEM_NOTICE",
        title: "공지",
        body: "본문",
        action: { type: "BROWSER", url: "https://aido.kr/notice" },
      },
      notificationId: 1,
      dispatchId: 2,
    });

    // Then
    expect(payload.data).toMatchObject({
      action: { type: "BROWSER", url: "https://aido.kr/notice" },
    });
  });

  it("날씨 옮기기 링크는 DEEP_LINK url에만 실려 종류로 이동하는 구 앱은 그대로 /weather를 연다", () => {
    // Given 1.13.x 앱은 WEATHER_* 종류만 보고 action url·context·routing은 읽지 않는다
    const data = {
      userId: "user-1",
      type: "WEATHER_MORNING" as const,
      purpose: "SCHEDULED_SERVICE" as const,
      title: "오후 3시 ‘한강 산책’ 때 비 소식이 있어요 ☔",
      body: "강수 확률 70% · 시간 옮기기",
      action: { type: "DEEP_LINK" as const, url: "/weather/reschedule?todoIds=12,15&reason=rain" },
    };

    // When
    const payload = factory.createBatch({ data, notificationId: 1, dispatchId: 2 });

    // Then
    expect(payload.minAppVersion).toBeUndefined();
    expect(payload.data).toEqual({
      notificationId: 1,
      dispatchId: 2,
      type: "WEATHER_MORNING",
      purpose: "SCHEDULED_SERVICE",
      action: { type: "DEEP_LINK", url: "/weather/reschedule?todoIds=12,15&reason=rain" },
      navigation: { kind: "WEATHER_RESCHEDULE", todoIds: [12, 15], reason: "rain" },
    });
    expect(pushNotificationDataSchema.parse(payload.data)).toEqual(payload.data);
  });

  it.each([
    { type: "INVITE_JOINED" as const, purpose: "TRANSACTIONAL" as const },
    { type: "INVITE_REWARDED" as const, purpose: "TRANSACTIONAL" as const },
    { type: "PREMIUM_GRANT_ENDING" as const, purpose: "ENGAGEMENT" as const },
  ])(
    "$type payload는 공유 푸시 data 스키마를 통과하고 타입을 그대로 싣는다",
    ({ type, purpose }) => {
      // Given
      const data = {
        userId: "user-1",
        type,
        title: "제목",
        body: "본문",
        metadata: { redemptionId: "redemption-1" },
        campaignKey: "invite_joined_v1",
        purpose,
      };

      // When
      const payload = factory.createSingle({ data, notificationId: 7, dispatchId: 8 });

      // Then
      expect(pushNotificationDataSchema.parse(payload.data)).toMatchObject({
        notificationId: 7,
        type,
        action: { type: "DEEP_LINK" },
      });
    },
  );

  describe("광고성 푸시 표기", () => {
    it.each([
      {
        locale: "ko" as const,
        title: "(광고) 오늘 점심 전에 하나 끝내볼까요",
        body: "아직 0개예요\n수신 거부: 설정 > 알림",
      },
      {
        locale: "en" as const,
        title: "(Ad) 오늘 점심 전에 하나 끝내볼까요",
        body: "아직 0개예요\nOpt out: Settings > Notifications",
      },
    ])(
      "$locale 광고성 푸시는 제목 앞 표기와 본문 끝 수신 거부 방법을 붙인다",
      ({ locale, title, body }) => {
        // Given
        const data = {
          userId: "user-1",
          type: "LUNCH_NUDGE" as const,
          title: "오늘 점심 전에 하나 끝내볼까요",
          body: "아직 0개예요",
        };

        // When
        const payload = factory.createSingle({ data, notificationId: 1, dispatchId: 2, locale });

        // Then
        expect(payload).toMatchObject({ title, body, categoryId: "MARKETING" });
      },
    );

    it.each([
      {
        name: "서비스 알림(온보딩 안내)",
        type: "SYSTEM_NOTICE" as const,
        purpose: "SCHEDULED_SERVICE" as const,
      },
      {
        name: "거래 알림(체험 종료)",
        type: "PREMIUM_TRIAL_ENDING" as const,
        purpose: "TRANSACTIONAL" as const,
      },
      {
        name: "거래 알림(보상 종료)",
        type: "PREMIUM_GRANT_ENDING" as const,
        purpose: "TRANSACTIONAL" as const,
      },
    ])("$name은 표기·광고 카테고리·수신 거부 토큰이 없다", ({ type, purpose }) => {
      // Given
      const data = { userId: "user-1", type, purpose, title: "제목", body: "본문" };

      // When
      const payload = factory.createSingle({
        data,
        notificationId: 1,
        dispatchId: 2,
        locale: "ko",
      });

      // Then
      expect(payload).toMatchObject({ title: "제목", body: "본문" });
      expect(payload.categoryId).toBeUndefined();
      expect(payload.data).not.toHaveProperty("marketingOptOutToken");
    });

    it("체험 종료 알림은 앱에 SYSTEM_NOTICE 타입과 구독 화면 navigation으로 보낸다", () => {
      // Given
      const data = {
        userId: "user-1",
        type: "PREMIUM_TRIAL_ENDING" as const,
        purpose: "TRANSACTIONAL" as const,
        title: "3일 뒤 연간 구독이 시작돼요",
        body: "12월 9일 결제 예정 · 해지는 스토어에서",
        action: { type: "DEEP_LINK" as const, url: "/settings/subscription" },
      };

      // When
      const payload = factory.createSingle({ data, notificationId: 1, dispatchId: 2 });

      // Then
      expect(pushNotificationDataSchema.parse(payload.data)).toMatchObject({
        type: "SYSTEM_NOTICE",
        action: { type: "DEEP_LINK", url: "/settings/subscription" },
        navigation: { kind: "SUBSCRIPTION" },
        purpose: "TRANSACTIONAL",
      });
    });
  });
});
