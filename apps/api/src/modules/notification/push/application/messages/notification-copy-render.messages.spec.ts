import {
  NUDGE_REPLY_KINDS,
  SUBSCRIPTION_PLAN_TYPES,
  WEATHER_CONDITIONS,
  type WeatherCondition,
} from "@aido/api/vocabulary";

import type { SupportedLocale } from "#api/shared/domain/locale";

import { NOTIFICATION_MILESTONES } from "../../domain/notification-milestone.constants.js";
import type {
  NotificationMessage,
  NotificationVariantContext,
} from "./notification-copy-catalog.messages.js";
import { formatWeatherNotificationTime } from "./notification-copy-format.messages.js";
import { renderNotificationCopy } from "./notification-copy-render.messages.js";
import { createRetentionNotificationMessage } from "./retention-notification.messages.js";
import {
  createEveningReminderNotificationMessage,
  createLunchNudgeNotificationMessage,
  createMorningNoTodoNotificationMessage,
  createMorningReminderNotificationMessage,
  createNudgeSuggestionNotificationMessage,
  createSocialDigestNotificationMessage,
  createStreakAtRiskNotificationMessage,
  createTodoReminderNotificationMessage,
  createTodoSeriesPausedNotificationMessage,
  createWeeklyAchievementNotificationMessage,
} from "./scheduler-notification.messages.js";
import {
  createCheerReceivedNotificationMessage,
  createFollowAcceptedNotificationMessage,
  createFollowRequestNotificationMessage,
  createFriendCompletedNotificationMessage,
  createInviteJoinedNotificationMessage,
  createInviteProgressNotificationMessage,
  createInviteQualifyReminderNotificationMessage,
  createInviteRewardedNotificationMessage,
  createNudgeReceivedNotificationMessage,
  createNudgeReplyNotificationMessage,
  createNudgeThanksNotificationMessage,
  createTodoCommentNotificationMessage,
  createTodoCreationNudgeNotificationMessage,
} from "./social-notification.messages.js";
import { getNotificationFriendFallback } from "./social-notification.messages.js";
import {
  createAiSuggestionNotificationMessage,
  createBillingIssueNotificationMessage,
  createMarketingConsentReconfirmNotificationMessage,
  createMilestoneNotificationMessage,
  createMonthlyReportNotificationMessage,
  createOnboardingNotificationMessage,
  createPremiumGrantEndingNotificationMessage,
  createPremiumRenewalUpcomingNotificationMessage,
  createPremiumTrialEndingNotificationMessage,
  createWeeklyReportNotificationMessage,
  createWinbackNotificationMessage,
} from "./system-notification.messages.js";
import {
  createWeatherEveningFallbackNotificationMessage,
  createWeatherEveningNotificationMessage,
  createWeatherEveningUnavailableNotificationMessage,
  createWeatherMorningFallbackNotificationMessage,
  createWeatherMorningNotificationMessage,
  createWeatherMorningUnavailableNotificationMessage,
} from "./weather-notification.messages.js";

/** 한 알림을 같은 입력·variant seed로 만든다. 이름을 모를 때는 그 언어의 대체 이름을 쓴다. */
type CopyCase = readonly [
  name: string,
  create: (
    locale: SupportedLocale,
    variantContext: NotificationVariantContext,
  ) => NotificationMessage,
];

const LOCALES: readonly SupportedLocale[] = ["ko", "en"];
const SEED_COUNT = 200;
const TIMEZONE = "Asia/Seoul";

// 받침 있는 이름·없는 이름·영문·emoji·대체 이름·잠금 화면 미리보기를 넘는 긴 이름·자리표시자 문법
const NAMES: readonly (readonly [label: string, name: (locale: SupportedLocale) => string])[] = [
  ["받침 없음", () => "민재"],
  ["받침 있음", () => "민준"],
  ["영문", () => "Mina"],
  ["emoji", () => "John 🐈"],
  ["대체 이름", (locale) => getNotificationFriendFallback(locale)],
  ["긴 이름", () => "가나다라마바사아자차카타파하".repeat(2)],
  ["자리표시자 문법", () => "{senderName} {{x}}"],
];

const TODO_TITLES: readonly (readonly [label: string, title: string])[] = [
  ["짧은 제목", "한강 산책"],
  ["긴 한국어 제목", "긴할일".repeat(10)],
  ["긴 영어 제목", "Write the quarterly report"],
  ["emoji 제목", "🏃‍♀️".repeat(30)],
  ["자리표시자 문법", "{todoTitle} {{x}}"],
];

const USER_MESSAGE = "{senderName:이/가} 그대로 {count} {{x}}";

const COUNTS = [1, 2, 999] as const;

/** 서울 15:00 */
const AFTERNOON = new Date("2026-07-16T06:00:00.000Z");
/** 서울 15:30 */
const HALF_PAST = new Date("2026-07-16T06:30:00.000Z");

function weatherDay(condition: WeatherCondition, temperatureMin = -3.4, temperatureMax = 28.6) {
  return {
    date: "2026-07-16",
    condition,
    temperatureMin,
    temperatureMax,
    precipitationChance: 30,
    precipitationType: "RAIN",
  } as const;
}

function formatTimeFor(locale: SupportedLocale) {
  return (instant: Date) => formatWeatherNotificationTime(instant, { locale, timezone: TIMEZONE });
}

const SCHEDULER_CASES: readonly CopyCase[] = [
  ...TODO_TITLES.flatMap(([label, todoTitle]) =>
    (["60min", "10min"] as const).map((stage): CopyCase => [
      `할 일 리마인더 ${stage} · ${label}`,
      (locale, variantContext) =>
        createTodoReminderNotificationMessage({ todoTitle, stage, locale, variantContext }),
    ]),
  ),
  [
    "반복 할 일 멈춤",
    (locale, variantContext) =>
      createTodoSeriesPausedNotificationMessage({ locale, variantContext }),
  ],
  [
    "아침 할 일 없음",
    (locale, variantContext) => createMorningNoTodoNotificationMessage({ locale, variantContext }),
  ],
  ...COUNTS.map((count): CopyCase => [
    `아침 리마인더 ${count}개`,
    (locale, variantContext) =>
      createMorningReminderNotificationMessage({ count, locale, variantContext }),
  ]),
  ...(
    [
      ["전부 완료 · 연속 31일", { completed: 3, total: 3, streak: 31 }],
      ["전부 완료 · 연속 30일", { completed: 3, total: 3, streak: 30 }],
      ["전부 완료 · 연속 14일", { completed: 3, total: 3, streak: 14 }],
      ["전부 완료 · 연속 7일", { completed: 3, total: 3, streak: 7 }],
      ["전부 완료 · 연속 2일", { completed: 3, total: 3, streak: 2 }],
      ["전부 완료 · 연속 999일", { completed: 3, total: 3, streak: 999 }],
      ["전부 완료 · 연속 없음", { completed: 3, total: 3 }],
      ["일부 완료 · 1개 남음", { completed: 1, total: 2 }],
      ["일부 완료 · 2개 남음", { completed: 1, total: 3 }],
      ["일부 완료 · 연속 위험", { completed: 1, total: 3, streak: 4, isStreakAtRisk: true }],
      [
        "일부 완료 · 1개 남음 · 연속 위험",
        { completed: 1, total: 2, streak: 4, isStreakAtRisk: true },
      ],
      ["일부 완료 · 연속 1일 위험", { completed: 1, total: 3, streak: 1, isStreakAtRisk: true }],
      ["완료 없음 · 연속 위험", { completed: 0, total: 3, streak: 4, isStreakAtRisk: true }],
      ["완료 없음", { completed: 0, total: 3 }],
      ["할 일 없음", { completed: 0, total: 0 }],
    ] as const
  ).map(([label, input]): CopyCase => [
    `저녁 리마인더 ${label}`,
    (locale, variantContext) =>
      createEveningReminderNotificationMessage({ ...input, locale, variantContext }),
  ]),
  [
    "점심 콕",
    (locale, variantContext) => createLunchNudgeNotificationMessage({ locale, variantContext }),
  ],
  ...[1, 5, 999].map((streak): CopyCase => [
    `연속 기록 위험 ${streak}일`,
    (locale, variantContext) =>
      createStreakAtRiskNotificationMessage({ streak, locale, variantContext }),
  ]),
  ...NAMES.map(([label, name]): CopyCase => [
    `콕 제안 · ${label}`,
    (locale, variantContext) =>
      createNudgeSuggestionNotificationMessage({
        friendName: name(locale),
        locale,
        variantContext,
      }),
  ]),
  ...NAMES.map(([label, name]): CopyCase => [
    `친구 완료 요약 한 명 · ${label}`,
    (locale, variantContext) =>
      createSocialDigestNotificationMessage({
        kind: "single",
        friendName: name(locale),
        locale,
        variantContext,
      }),
  ]),
  ...COUNTS.map((completedFriendCount): CopyCase => [
    `친구 완료 요약 ${completedFriendCount}명`,
    (locale, variantContext) =>
      createSocialDigestNotificationMessage({
        kind: "multiple",
        completedFriendCount,
        locale,
        variantContext,
      }),
  ]),
  ...(
    [
      ["전체 완료", 10, 10],
      ["90%", 9, 10],
      ["반올림 100%", 249, 250],
      ["1개 완료", 1, 10],
      ["2개 완료", 2, 10],
      ["0개 완료", 0, 5],
      ["할 일 없음", 0, 0],
    ] as const
  ).map(([label, completedCount, totalCount]): CopyCase => [
    `주간 성취 ${label}`,
    (locale, variantContext) =>
      createWeeklyAchievementNotificationMessage({
        completedCount,
        totalCount,
        locale,
        variantContext,
      }),
  ]),
];

const WEATHER_CASES: readonly CopyCase[] = [
  ...TODO_TITLES.flatMap(([label, title]) =>
    (
      [
        ["비 · 다른 할 일 없음", "rain", 1],
        ["비 · 다른 할 일 1개", "rain", 2],
        ["비 · 다른 할 일 4개", "rain", 5],
        ["뇌우", "storm", 1],
        ["눈", "snow", 1],
      ] as const
    ).map(([hazardLabel, hazard, todoCount]): CopyCase => [
      `아침 날씨 할 일 ${hazardLabel} · ${label}`,
      (locale, variantContext) =>
        createWeatherMorningNotificationMessage({
          briefing: {
            kind: "todoWet",
            hazard,
            todo: { id: 1, title, scheduledAt: AFTERNOON },
            todoIds: Array.from({ length: todoCount }, (_, index) => index + 1),
            precipitationChance: 70,
          },
          formatTime: formatTimeFor(locale),
          timezone: TIMEZONE,
          locale,
          variantContext,
        }),
    ]),
  ),
  ...[AFTERNOON, HALF_PAST].map((scheduledAt): CopyCase => [
    `아침 날씨 더위 · ${scheduledAt.toISOString()}`,
    (locale, variantContext) =>
      createWeatherMorningNotificationMessage({
        briefing: {
          kind: "todoHot",
          todo: { id: 1, title: "테니스", scheduledAt },
          todoIds: [1],
          peakApparentTemperature: 35.4,
        },
        formatTime: formatTimeFor(locale),
        timezone: TIMEZONE,
        locale,
        variantContext,
      }),
  ]),
  ...[true, false].flatMap((isSnow) =>
    [AFTERNOON, HALF_PAST].map((startsAt): CopyCase => [
      `아침 날씨 나중에 ${isSnow ? "눈" : "비"} · ${startsAt.toISOString()}`,
      (locale, variantContext) =>
        createWeatherMorningNotificationMessage({
          briefing: { kind: "wetLater", startsAt, isSnow },
          formatTime: formatTimeFor(locale),
          timezone: TIMEZONE,
          locale,
          variantContext,
        }),
    ]),
  ),
  ...WEATHER_CONDITIONS.map((condition): CopyCase => [
    `아침 날씨 요약 · ${condition}`,
    (locale, variantContext) =>
      createWeatherMorningNotificationMessage({
        briefing: { kind: "summary", day: weatherDay(condition) },
        formatTime: formatTimeFor(locale),
        timezone: TIMEZONE,
        locale,
        variantContext,
      }),
  ]),
  ...[true, false].flatMap((isSnow) =>
    (["dawn", "morning", "afternoon", "evening", null] as const).flatMap((dayPart) =>
      [true, false].map((isChilly): CopyCase => [
        `저녁 날씨 내일 ${isSnow ? "눈" : "비"} · ${dayPart ?? "시간 모름"} · ${isChilly ? "쌀쌀함" : "보통"}`,
        (locale, variantContext) =>
          createWeatherEveningNotificationMessage({
            briefing: {
              kind: "wetTomorrow",
              isSnow,
              dayPart,
              day: weatherDay("RAIN", 8.6),
              isChilly,
            },
            locale,
            variantContext,
          }),
      ]),
    ),
  ),
  ...WEATHER_CONDITIONS.flatMap((condition) =>
    [true, false].map((isChilly): CopyCase => [
      `저녁 날씨 내일 요약 · ${condition} · ${isChilly ? "쌀쌀함" : "보통"}`,
      (locale, variantContext) =>
        createWeatherEveningNotificationMessage({
          briefing: { kind: "tomorrowSummary", day: weatherDay(condition), isChilly },
          locale,
          variantContext,
        }),
    ]),
  ),
  [
    "아침 날씨 위치 없음",
    (locale, variantContext) =>
      createWeatherMorningFallbackNotificationMessage({ locale, variantContext }),
  ],
  [
    "저녁 날씨 위치 없음",
    (locale, variantContext) =>
      createWeatherEveningFallbackNotificationMessage({ locale, variantContext }),
  ],
  [
    "아침 날씨 예보 없음",
    (locale, variantContext) =>
      createWeatherMorningUnavailableNotificationMessage({ locale, variantContext }),
  ],
  [
    "저녁 날씨 예보 없음",
    (locale, variantContext) =>
      createWeatherEveningUnavailableNotificationMessage({ locale, variantContext }),
  ],
];

const SOCIAL_CASES: readonly CopyCase[] = [
  ...NAMES.flatMap(([label, name]) =>
    NUDGE_REPLY_KINDS.map((replyKind): CopyCase => [
      `콕 답장 ${replyKind} · ${label}`,
      (locale, variantContext) =>
        createNudgeReplyNotificationMessage({
          senderName: name(locale),
          todoTitle: "긴할일".repeat(10),
          replyKind,
          locale,
          variantContext,
        }),
    ]),
  ),
  ...NAMES.flatMap(([label, name]) =>
    TODO_TITLES.map(([titleLabel, todoTitle]): CopyCase => [
      `콕 감사 · ${label} · ${titleLabel}`,
      (locale, variantContext) =>
        createNudgeThanksNotificationMessage({
          senderName: name(locale),
          todoTitle,
          locale,
          variantContext,
        }),
    ]),
  ),
  ...NAMES.flatMap(([label, name]): CopyCase[] => [
    [
      `친구 요청 · ${label}`,
      (locale, variantContext) =>
        createFollowRequestNotificationMessage({
          senderName: name(locale),
          locale,
          variantContext,
        }),
    ],
    [
      `친구 수락 · ${label}`,
      (locale, variantContext) =>
        createFollowAcceptedNotificationMessage({
          senderName: name(locale),
          locale,
          variantContext,
        }),
    ],
    [
      `초대 가입 · ${label}`,
      (locale, variantContext) =>
        createInviteJoinedNotificationMessage({
          inviteeName: name(locale),
          locale,
          variantContext,
        }),
    ],
    [
      `초대 첫날 · ${label}`,
      (locale, variantContext) =>
        createInviteProgressNotificationMessage({
          inviteeName: name(locale),
          locale,
          variantContext,
        }),
    ],
    [
      `초대 하루 더 · ${label}`,
      (locale, variantContext) =>
        createInviteQualifyReminderNotificationMessage({
          inviterName: name(locale),
          locale,
          variantContext,
        }),
    ],
    [
      `콕 받음 · ${label} · 할 일 없음`,
      (locale, variantContext) =>
        createNudgeReceivedNotificationMessage({
          senderName: name(locale),
          locale,
          variantContext,
        }),
    ],
    [
      `콕 받음 · ${label} · 할 일 없음 · 한마디`,
      (locale, variantContext) =>
        createNudgeReceivedNotificationMessage({
          senderName: name(locale),
          message: USER_MESSAGE,
          locale,
          variantContext,
        }),
    ],
    [
      `할 일 만들기 콕 · ${label}`,
      (locale, variantContext) =>
        createTodoCreationNudgeNotificationMessage({
          senderName: name(locale),
          locale,
          variantContext,
        }),
    ],
    [
      `할 일 만들기 콕 · ${label} · 한마디`,
      (locale, variantContext) =>
        createTodoCreationNudgeNotificationMessage({
          senderName: name(locale),
          message: USER_MESSAGE,
          locale,
          variantContext,
        }),
    ],
    [
      `응원 · ${label}`,
      (locale, variantContext) =>
        createCheerReceivedNotificationMessage({
          senderName: name(locale),
          locale,
          variantContext,
        }),
    ],
    [
      `응원 · ${label} · 한마디`,
      (locale, variantContext) =>
        createCheerReceivedNotificationMessage({
          senderName: name(locale),
          message: USER_MESSAGE,
          locale,
          variantContext,
        }),
    ],
    [
      `친구 완료 · ${label}`,
      (locale, variantContext) =>
        createFriendCompletedNotificationMessage({
          friendName: name(locale),
          locale,
          variantContext,
        }),
    ],
  ]),
  ...TODO_TITLES.flatMap(([titleLabel, todoTitle]): CopyCase[] => [
    [
      `콕 받음 · 할 일 ${titleLabel}`,
      (locale, variantContext) =>
        createNudgeReceivedNotificationMessage({
          senderName: "민재",
          todoTitle,
          locale,
          variantContext,
        }),
    ],
    [
      `콕 받음 · 할 일 ${titleLabel} · 한마디`,
      (locale, variantContext) =>
        createNudgeReceivedNotificationMessage({
          senderName: "민재",
          todoTitle,
          message: USER_MESSAGE,
          locale,
          variantContext,
        }),
    ],
  ]),
  ...(
    [
      [7, 1],
      [2, 1],
      [1, 1],
      [0, 2],
      [0, 1],
      [1, 0],
      [2, 0],
    ] as const
  ).map(([premiumDays, friendSlots]): CopyCase => [
    `초대 보상 프리미엄 ${premiumDays}일 · 친구 ${friendSlots}명`,
    (locale, variantContext) =>
      createInviteRewardedNotificationMessage({
        premiumDays,
        friendSlots,
        locale,
        variantContext,
      }),
  ]),
  ...(
    [
      ...NAMES.map(([label, name]) => [label, name] as const),
      ["이름 없음", () => null],
      ["빈 이름", () => "   "],
    ] as const
  ).flatMap(([label, name]): CopyCase[] => [
    ...COUNTS.map((commentCount): CopyCase => [
      `댓글 ${commentCount}개 · ${label}`,
      (locale, variantContext) =>
        createTodoCommentNotificationMessage({
          activityKind: "COMMENT",
          commentCount,
          senderName: name(locale),
          locale,
          variantContext,
        }),
    ]),
    ...COUNTS.flatMap((commentCount) =>
      (["COMMENT", "REPLY"] as const).map((replyTarget): CopyCase => [
        `답글 ${commentCount}개 · ${replyTarget}에 · ${label}`,
        (locale, variantContext) =>
          createTodoCommentNotificationMessage({
            activityKind: "REPLY",
            commentCount,
            replyTarget,
            senderName: name(locale),
            locale,
            variantContext,
          }),
      ]),
    ),
    [
      `댓글 좋아요 · ${label}`,
      (locale, variantContext) =>
        createTodoCommentNotificationMessage({
          activityKind: "LIKE",
          senderName: name(locale),
          locale,
          variantContext,
        }),
    ],
  ]),
];

const BILLING_NOW = new Date("2026-12-06T03:00:00.000Z");
const BILLING_ENDS = [
  ["오늘", new Date("2026-12-06T10:00:00.000Z")],
  ["내일", new Date("2026-12-07T00:00:00.000Z")],
  ["3일 뒤", new Date("2026-12-09T00:00:00.000Z")],
] as const;

const SYSTEM_CASES: readonly CopyCase[] = [
  ...[0, 3, 6, 7, 13, 14, 20, 21, 29, 30, 365].map((inactiveDays): CopyCase => [
    `복귀 ${inactiveDays}일`,
    (locale, variantContext) =>
      createWinbackNotificationMessage({ inactiveDays, locale, variantContext }),
  ]),
  ...([0, 1, 2, 3] as const).map((day): CopyCase => [
    `온보딩 ${day}일`,
    (locale, variantContext) =>
      createOnboardingNotificationMessage({ day, locale, variantContext }),
  ]),
  ...([5, 7] as const).flatMap((day) =>
    [0, 1, 7].map((completedCount): CopyCase => [
      `온보딩 ${day}일 · 완료 ${completedCount}개`,
      (locale, variantContext) =>
        createOnboardingNotificationMessage({ day, completedCount, locale, variantContext }),
    ]),
  ),
  ...NOTIFICATION_MILESTONES.map((milestone): CopyCase => [
    `마일스톤 ${milestone}`,
    (locale) => createMilestoneNotificationMessage({ milestone, locale }),
  ]),
  [
    "주간 리포트",
    (locale, variantContext) => createWeeklyReportNotificationMessage({ locale, variantContext }),
  ],
  [
    "월간 리포트",
    (locale, variantContext) => createMonthlyReportNotificationMessage({ locale, variantContext }),
  ],
  ["AI 제안", (locale) => createAiSuggestionNotificationMessage({ locale })],
  ["결제 문제", (locale) => createBillingIssueNotificationMessage({ locale })],
  ["프리미엄 지급 종료", (locale) => createPremiumGrantEndingNotificationMessage({ locale })],
  ...BILLING_ENDS.flatMap(([label, endsAt]) =>
    [...SUBSCRIPTION_PLAN_TYPES, null].map((planType): CopyCase => [
      `체험 종료 · 자동 갱신 · ${planType ?? "요금제 모름"} · ${label}`,
      (locale, variantContext) =>
        createPremiumTrialEndingNotificationMessage({
          locale,
          timezone: TIMEZONE,
          endsAt,
          now: BILLING_NOW,
          willRenew: true,
          planType,
          variantContext,
        }),
    ]),
  ),
  ...BILLING_ENDS.map(([label, endsAt]): CopyCase => [
    `체험 종료 · 해지 · ${label}`,
    (locale, variantContext) =>
      createPremiumTrialEndingNotificationMessage({
        locale,
        timezone: TIMEZONE,
        endsAt,
        now: BILLING_NOW,
        willRenew: false,
        planType: "ANNUAL",
        variantContext,
      }),
  ]),
  ...BILLING_ENDS.map(([label, renewsAt]): CopyCase => [
    `연간 갱신 예정 · ${label}`,
    (locale, variantContext) =>
      createPremiumRenewalUpcomingNotificationMessage({
        locale,
        timezone: TIMEZONE,
        renewsAt,
        now: BILLING_NOW,
        variantContext,
      }),
  ]),
  ...["Asia/Seoul", "America/Los_Angeles"].map((timezone): CopyCase => [
    `광고성 수신 동의 재확인 · ${timezone}`,
    (locale) =>
      createMarketingConsentReconfirmNotificationMessage({
        locale,
        timezone,
        agreedAt: new Date("2024-11-08T20:00:00.000Z"),
      }),
  ]),
];

const RETENTION_CASES: readonly CopyCase[] = (
  [
    { stage: "D0", copyKey: "d0_no_todo" },
    { stage: "D1", copyKey: "d1_no_todo" },
    { stage: "D1", copyKey: "d1_has_todo_no_completion" },
    { stage: "D3", copyKey: "d3_restart" },
    { stage: "D7", copyKey: "d7_has_progress" },
    { stage: "D7", copyKey: "d7_restart" },
  ] as const
).map((selection): CopyCase => [
  `리텐션 ${selection.stage} ${selection.copyKey}`,
  (locale, { recipientId, occurrenceKey }) =>
    createRetentionNotificationMessage({
      ...selection,
      locale,
      selectionContext: { recipientId, occurrenceKey },
    }),
]);

const NOTIFICATION_COPY_CASES: readonly CopyCase[] = [
  ...SCHEDULER_CASES,
  ...WEATHER_CASES,
  ...SOCIAL_CASES,
  ...SYSTEM_CASES,
  ...RETENTION_CASES,
];

function variantContextOf(seed: number): NotificationVariantContext {
  return {
    campaignKey: "copy_render_v1",
    recipientId: `user-${seed}`,
    occurrenceKey: "2026-11-10",
  };
}

/** seed를 바꿔 가며 고를 수 있는 variant를 모두 한 번씩 만든다. variantId 순으로 정렬한다. */
function renderEveryVariant(
  create: CopyCase[1],
  locale: SupportedLocale,
): { readonly seed: number; readonly message: NotificationMessage }[] {
  const byVariant = new Map<
    string,
    { readonly seed: number; readonly message: NotificationMessage }
  >();
  for (let seed = 0; seed < SEED_COUNT; seed += 1) {
    const message = create(locale, variantContextOf(seed));
    if (!byVariant.has(message.variantId)) {
      byVariant.set(message.variantId, { seed, message });
    }
  }
  return [...byVariant.values()].sort((a, b) =>
    a.message.variantId.localeCompare(b.message.variantId),
  );
}

describe.each(LOCALES)("%s 푸시 문구 렌더 스냅샷", (locale) => {
  it.each(NOTIFICATION_COPY_CASES)("%s", (_name, create) => {
    // When
    const rendered = renderEveryVariant(create, locale).map(({ message }) => ({
      variantId: message.variantId,
      title: message.title,
      body: message.body,
    }));

    // Then
    expect(rendered).toMatchSnapshot();
  });
});

describe.each(LOCALES)("%s 알림함 다시 렌더링", (locale) => {
  const otherLocale: SupportedLocale = locale === "ko" ? "en" : "ko";

  it.each(NOTIFICATION_COPY_CASES)("%s", (_name, create) => {
    for (const { seed, message } of renderEveryVariant(create, locale)) {
      // Given - 저장했다 읽은 것처럼 JSON을 거친 사실
      const other = create(otherLocale, variantContextOf(seed));
      const stored = {
        copyKey: message.copyKey,
        copyFacts: JSON.parse(JSON.stringify(message.copyFacts)),
      };

      // When
      const sameLocale = renderNotificationCopy(stored, locale);
      const switchedLocale = renderNotificationCopy(stored, otherLocale);

      // Then - 같은 언어는 푸시 문구 그대로, 다른 언어는 그 언어로 만든 푸시 문구와 같다
      expect(other.copyKey).toBe(message.copyKey);
      expect(other.copyFacts).toEqual(message.copyFacts);
      expect(sameLocale).toEqual({ title: message.title, body: message.body });
      expect(switchedLocale).toEqual({ title: other.title, body: other.body });
    }
  });
});

describe("renderNotificationCopy — 저장 문구로 되돌아가는 경우", () => {
  it.each([
    ["모르는 템플릿", { copyKey: "scheduler.UNKNOWN.v1", copyFacts: {} }],
    ["모르는 variant", { copyKey: "scheduler.MORNING_REMINDER.v9", copyFacts: { count: 1 } }],
    ["점이 없는 키", { copyKey: "MORNING_REMINDER", copyFacts: {} }],
    ["맞지 않는 사실", { copyKey: "scheduler.MORNING_REMINDER.v1", copyFacts: { count: "3" } }],
    ["사실 없음", { copyKey: "scheduler.MORNING_REMINDER.v1", copyFacts: null }],
    [
      "시간대 없는 날씨 사실",
      {
        copyKey: "weather.MORNING_RAIN_LATER.default",
        copyFacts: { startsAt: "2026-07-16T06:00:00.000Z", timezone: null },
      },
    ],
  ] as const)("%s이면 null을 돌려준다", (_label, stored) => {
    // When
    const copy = renderNotificationCopy(stored, "en");

    // Then
    expect(copy).toBeNull();
  });

  it("광고성 표기 같은 푸시 전용 장식을 붙이지 않는다", () => {
    // Given
    const message = createWeeklyReportNotificationMessage({ locale: "ko" });

    // When
    const copy = renderNotificationCopy(message, "ko");

    // Then
    expect(copy?.title.startsWith("(광고)")).toBe(false);
    expect(copy).toEqual({ title: message.title, body: message.body });
  });
});
