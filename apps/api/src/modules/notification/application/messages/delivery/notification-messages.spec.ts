import { createNotificationLabelPreview } from "./notification-copy.renderer.js";
import {
  createBillingIssueNotificationMessage,
  createEveningReminderNotificationMessage,
  createInviteJoinedNotificationMessage,
  createInviteProgressNotificationMessage,
  createInviteQualifyReminderNotificationMessage,
  createInviteRewardedNotificationMessage,
  createMorningReminderNotificationMessage,
  createNudgeReceivedNotificationMessage,
  createOnboardingNotificationMessage,
  createTodoCommentNotificationMessage,
  createTodoReminderNotificationMessage,
  createWeatherMorningNotificationMessage,
  createWeeklyAchievementNotificationMessage,
  createWinbackNotificationMessage,
} from "./notification-messages.js";

const VARIANT_CONTEXT = {
  campaignKey: "copy_test_v1",
  recipientId: "user-1",
  occurrenceKey: "2026-08-28",
};

const COMMENT_ACTIVITY_CASES: readonly [
  activityKind: "COMMENT" | "REPLY",
  commentCount: number,
  expectedText: string,
][] = [
  ["COMMENT", 1, "댓글"],
  ["COMMENT", 3, "3"],
  ["REPLY", 1, "답글"],
  ["REPLY", 3, "3"],
];

const EVENING_REMINDER_CASES: readonly [
  templateKey: string,
  input: {
    readonly completed: number;
    readonly total: number;
    readonly streak?: number;
    readonly isStreakAtRisk?: boolean;
  },
][] = [
  ["evening.streak_30", { completed: 3, total: 3, streak: 30 }],
  ["evening.streak_14", { completed: 3, total: 3, streak: 14 }],
  ["evening.streak_7", { completed: 3, total: 3, streak: 7 }],
  ["evening.streak", { completed: 3, total: 3, streak: 2 }],
  ["evening.complete", { completed: 3, total: 3 }],
  ["evening.streak_risk_partial", { completed: 1, total: 3, streak: 4, isStreakAtRisk: true }],
  ["evening.partial", { completed: 1, total: 3 }],
  ["evening.streak_risk_none", { completed: 0, total: 3, streak: 4, isStreakAtRisk: true }],
  ["evening.none", { completed: 0, total: 3 }],
];

const ONBOARDING_CASES = [
  ["onboarding.day_1", { day: 1 }],
  ["onboarding.day_2", { day: 2 }],
  ["onboarding.day_3", { day: 3 }],
  ["onboarding.day_7", { day: 7, completedCount: 4 }],
] as const;

function graphemeCount(value: string): number {
  return Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(value))
    .length;
}

describe("알림 문구 생성", () => {
  describe("createNotificationLabelPreview", () => {
    it("한국어는 말줄임표를 포함해 최대 24 grapheme으로 줄인다", () => {
      const preview = createNotificationLabelPreview({ label: "가".repeat(30), locale: "ko" });
      const graphemes = Array.from(
        new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(preview),
      );

      expect(graphemes).toHaveLength(24);
      expect(preview).toBe(`${"가".repeat(23)}…`);
    });

    it("영어는 말줄임표를 포함해 최대 16 grapheme으로 줄인다", () => {
      const preview = createNotificationLabelPreview({
        label: "Write the quarterly report",
        locale: "en",
      });

      expect(graphemeCount(preview)).toBe(16);
      expect(preview).toBe("Write the quart…");
    });

    it("결합 emoji sequence를 중간에서 자르지 않는다", () => {
      const family = "👨‍👩‍👧‍👦";
      const preview = createNotificationLabelPreview({ label: family.repeat(25), locale: "ko" });

      expect(preview).toBe(`${family.repeat(23)}…`);
    });
  });

  it("같은 variant context는 재시도에도 같은 결과를 만든다", () => {
    const first = createMorningReminderNotificationMessage({
      count: 4,
      variantContext: VARIANT_CONTEXT,
    });
    const retry = createMorningReminderNotificationMessage({
      count: 4,
      variantContext: VARIANT_CONTEXT,
    });

    expect(retry).toEqual(first);
    expect(first.variantId).toMatch(/^copy_test_v1\.morning\.has_todo\.v[1-5]$/);
  });

  it("locale은 variant 선택과 독립적이다", () => {
    const korean = createWinbackNotificationMessage({
      inactiveDays: 7,
      locale: "ko",
      variantContext: VARIANT_CONTEXT,
    });
    const english = createWinbackNotificationMessage({
      inactiveDays: 7,
      locale: "en",
      variantContext: VARIANT_CONTEXT,
    });

    expect(english.variantId).toBe(korean.variantId);
    expect(english.title).not.toBe(korean.title);
  });

  it("긴 todo 제목은 title이 아니라 24-grapheme body preview에만 둔다", () => {
    const todoTitle = "긴할일".repeat(60);
    const message = createTodoReminderNotificationMessage({
      todoTitle,
      stage: "60min",
    });

    expect(message.title).not.toContain(todoTitle);
    expect(message.body).toContain(
      createNotificationLabelPreview({ label: todoTitle, locale: "ko" }),
    );
    expect(message.body).not.toContain(todoTitle);
  });

  it("nudge의 todo 제목도 동일한 preview 경계를 통과한다", () => {
    const todoTitle = "🏃‍♀️".repeat(40);
    const message = createNudgeReceivedNotificationMessage({ senderName: "민재", todoTitle });

    expect(message.title).not.toContain(todoTitle);
    expect(message.body).toContain(
      createNotificationLabelPreview({ label: todoTitle, locale: "ko" }),
    );
  });

  it("영어 할 일 알림은 최대 제목에서도 잠금 화면 길이 예산을 지킨다", () => {
    const stages: readonly ("60min" | "10min" | "immediate")[] = ["60min", "10min", "immediate"];

    for (const stage of stages) {
      for (let occurrenceIndex = 0; occurrenceIndex < 30; occurrenceIndex += 1) {
        const message = createTodoReminderNotificationMessage({
          todoTitle: "T".repeat(200),
          stage,
          locale: "en",
          variantContext: {
            campaignKey: "todo_reminder_length_v1",
            recipientId: "user-1",
            occurrenceKey: String(occurrenceIndex),
          },
        });

        expect(graphemeCount(message.title)).toBeLessThanOrEqual(30);
        expect(graphemeCount(message.body)).toBeLessThanOrEqual(40);
      }
    }
  });

  it("사용자 작성 메시지를 placeholder로 재해석하거나 자르지 않는다", () => {
    const userMessage = "{senderName:이/가} 그대로 {count}";
    const message = createNudgeReceivedNotificationMessage({
      senderName: "민재",
      message: userMessage,
    });

    expect(message.body).toBe(userMessage);
  });

  it("공유 schema 최대 입력을 렌더링한다", () => {
    const message = createNudgeReceivedNotificationMessage({
      senderName: "가".repeat(20),
      todoTitle: "나".repeat(200),
      message: "다".repeat(200),
    });

    expect(message.title.length).toBeLessThanOrEqual(200);
    expect(message.body.length).toBeLessThanOrEqual(500);
    expect(message.body).toContain("다".repeat(200));
  });

  it("공유 schema를 넘는 동적 본문은 경계에서 거부한다", () => {
    expect(() =>
      createNudgeReceivedNotificationMessage({
        senderName: "민재",
        message: "가".repeat(501),
      }),
    ).toThrow();
  });

  it.each(COMMENT_ACTIVITY_CASES)(
    "%s chain count=%d를 의미에 맞게 렌더링한다",
    (activityKind, commentCount, text) => {
      const message = createTodoCommentNotificationMessage({
        activityKind,
        senderName: "민재",
        commentCount,
      });

      expect(`${message.title} ${message.body}`).toContain(text);
    },
  );

  it.each([
    { inviteeName: "매튜", expected: "매튜가 내 초대로 친구가 됐어 🐾" },
    { inviteeName: "존", expected: "존이 내 초대로 친구가 됐어 🐾" },
  ])(
    "초대 수락 알림은 다른 소셜 알림처럼 반말로 이름에 조사를 붙인다 ($inviteeName)",
    ({ inviteeName, expected }) => {
      // Given
      const input = { inviteeName, locale: "ko" as const, variantContext: VARIANT_CONTEXT };

      // When
      const message = createInviteJoinedNotificationMessage(input);

      // Then
      expect(message).toMatchObject({ title: expected, body: "서로의 하루를 응원해봐" });
    },
  );

  it.each([
    {
      inviteeName: "매튜",
      ko: "매튜가 첫날 할 일을 끝냈어 🐾",
      en: "매튜 finished day one 🐾",
    },
    { inviteeName: "존", ko: "존이 첫날 할 일을 끝냈어 🐾", en: "존 finished day one 🐾" },
    { inviteeName: "Mina", ko: "Mina가 첫날 할 일을 끝냈어 🐾", en: "Mina finished day one 🐾" },
  ])(
    "초대한 친구의 첫날 알림은 이름에 조사를 붙이고 콕으로 응원하자고 권한다 ($inviteeName)",
    ({ inviteeName, ko, en }) => {
      // Given
      const input = { inviteeName, variantContext: VARIANT_CONTEXT };

      // When
      const korean = createInviteProgressNotificationMessage({ ...input, locale: "ko" });
      const english = createInviteProgressNotificationMessage({ ...input, locale: "en" });

      // Then
      expect(korean).toMatchObject({ title: ko, body: "콕 찔러서 내일도 해내게 응원해줘" });
      expect(english).toMatchObject({
        title: en,
        body: "Send a nudge to cheer them on for day two",
      });
    },
  );

  it("사용 시작 알림은 초대한 사람 이름으로 하루만 더 하면 발자국을 선물한다고 알린다", () => {
    // Given
    const input = { inviterName: "매튜", variantContext: VARIANT_CONTEXT };

    // When
    const korean = createInviteQualifyReminderNotificationMessage({ ...input, locale: "ko" });
    const english = createInviteQualifyReminderNotificationMessage({ ...input, locale: "en" });

    // Then
    expect(korean).toMatchObject({
      title: "하루만 더 할 일을 끝내볼까? 🐾",
      body: "오늘 할 일을 끝내면 매튜에게 발자국을 선물할 수 있어",
    });
    expect(english).toMatchObject({
      title: "One more day to go 🐾",
      body: "Finish a to-do today and 매튜 gets a paw print",
    });
  });

  it.each([
    {
      rewards: { premiumDays: 7, friendSlots: 1 },
      ko: "프리미엄 7일을 받았고, 친구도 1명 더 추가할 수 있어",
      en: "You got 7 days of Premium and can add 1 more friend",
    },
    {
      rewards: { premiumDays: 2, friendSlots: 1 },
      ko: "프리미엄 2일을 받았고, 친구도 1명 더 추가할 수 있어",
      en: "You got 2 days of Premium and can add 1 more friend",
    },
    {
      rewards: { premiumDays: 0, friendSlots: 2 },
      ko: "이제 친구를 2명 더 추가할 수 있어",
      en: "You can now add 2 more friends",
    },
    {
      rewards: { premiumDays: 1, friendSlots: 0 },
      ko: "프리미엄 1일을 받았어",
      en: "You got 1 day of Premium",
    },
  ])("발자국 알림은 받은 보상을 모두 적고 영어는 복수형을 맞춘다 ($ko)", ({ rewards, ko, en }) => {
    // Given
    const input = { ...rewards, variantContext: VARIANT_CONTEXT };

    // When
    const korean = createInviteRewardedNotificationMessage({ ...input, locale: "ko" });
    const english = createInviteRewardedNotificationMessage({ ...input, locale: "en" });

    // Then
    expect(korean).toMatchObject({ title: "발자국이 찍혔어 🐾", body: ko });
    expect(english).toMatchObject({ title: "You got a paw print 🐾", body: en });
  });

  it("댓글 좋아요는 개수를 받지 않고 actor를 먼저 알린다", () => {
    const message = createTodoCommentNotificationMessage({
      activityKind: "LIKE",
      senderName: "John 🐈",
      locale: "ko",
    });

    expect(message.title).toContain("John 🐈");
    expect(message.title).toContain("댓글");
  });

  it("댓글 개수는 양의 정수만 허용한다", () => {
    expect(() =>
      createTodoCommentNotificationMessage({
        activityKind: "COMMENT",
        senderName: "민재",
        commentCount: 0,
      }),
    ).toThrow(RangeError);
  });

  it("댓글 factory 계약에는 댓글 원문 필드가 없다", () => {
    if (false) {
      createTodoCommentNotificationMessage({
        activityKind: "COMMENT",
        senderName: "민재",
        commentCount: 1,
        // @ts-expect-error 댓글 원문은 push copy 입력이 아니다.
        commentContent: "잠금 화면에 노출되면 안 되는 원문",
      });
    }

    expect(true).toBe(true);
  });

  it("결제 안내는 장난스러운 표현 없이 명확하다", () => {
    // Given
    const expected = {
      title: "결제 정보 확인이 필요해요",
      body: "구독을 이어가려면 결제 수단을 확인해 주세요.",
      variantId: "default",
    };

    // When
    const message = createBillingIssueNotificationMessage();

    // Then
    expect(message).toEqual(expected);
  });

  it.each(EVENING_REMINDER_CASES)(
    "저녁 알림 상태를 %s template으로 분류한다",
    (templateKey, input) => {
      const message = createEveningReminderNotificationMessage({
        ...input,
        variantContext: VARIANT_CONTEXT,
      });

      expect(message.variantId).toMatch(
        new RegExp(`^copy_test_v1\\.${templateKey}\\.(?:v[1-5]|default)$`),
      );
    },
  );

  it.each(ONBOARDING_CASES)("%s 온보딩 알림을 지원한다", (templateKey, input) => {
    const message = createOnboardingNotificationMessage({
      ...input,
      variantContext: VARIANT_CONTEXT,
    });

    expect(message.variantId).toBe(`copy_test_v1.${templateKey}.default`);
  });

  it("완료율에 맞는 주간 성취 copy를 선택한다", () => {
    expect(
      createWeeklyAchievementNotificationMessage({ completedCount: 10, totalCount: 10 }).title,
    ).toContain("100%");
    expect(
      createWeeklyAchievementNotificationMessage({ completedCount: 9, totalCount: 10 }).title,
    ).toContain("90%");
  });

  it("강수 형태를 강수 확률보다 우선한다", () => {
    const message = createWeatherMorningNotificationMessage({
      forecast: {
        temperatureMin: 20,
        temperatureMax: 27,
        precipitationProbability: 10,
        precipitationType: "RAIN",
        skyCondition: "CLEAR",
      },
    });

    expect(message.title).toContain("비");
  });
});
