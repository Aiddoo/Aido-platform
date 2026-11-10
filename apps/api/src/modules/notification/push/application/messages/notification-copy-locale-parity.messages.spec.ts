import type { SupportedLocale } from "#api/shared/domain/locale";

import {
  NOTIFICATION_COPY_CATALOG,
  type NotificationCopyFacts,
} from "./notification-copy-catalog.messages.js";
import { STORED_NOTIFICATION_COPY_TEMPLATES } from "./notification-copy-render.messages.js";

const LOCALES: readonly SupportedLocale[] = ["ko", "en"];

// 기존 선택 계약 스냅샷의 그룹 이름 → notification.json 그룹
const CATALOG_GROUPS = {
  SCHEDULER_TEMPLATES: "scheduler",
  WEATHER_TEMPLATES: "weather",
  SOCIAL_TEMPLATES: "social",
  SYSTEM_TEMPLATES: "system",
  RETENTION_TEMPLATES: "retention",
  WEATHER_FALLBACK: "weatherFallback",
} as const;

type CatalogNode = string | { readonly [key: string]: CatalogNode };

function isCatalogObject(value: unknown): value is { readonly [key: string]: CatalogNode } {
  return typeof value === "object" && value != null && !Array.isArray(value);
}

function childrenOf(value: unknown): [string, unknown][] {
  return isCatalogObject(value) ? Object.entries(value) : [];
}

function templateNodes(locale: SupportedLocale): [key: string, variants: [string, unknown][]][] {
  return Object.values(CATALOG_GROUPS).flatMap((group) =>
    childrenOf(NOTIFICATION_COPY_CATALOG[locale][group]).map(
      ([name, node]): [string, [string, unknown][]] => [`${group}.${name}`, childrenOf(node)],
    ),
  );
}

function placeholdersOf(node: unknown): string[] {
  if (typeof node === "string") {
    return Array.from(node.matchAll(/\{(\w+)\}/g), (match) => match[1] ?? "");
  }
  return childrenOf(node).flatMap(([, child]) => placeholdersOf(child));
}

const longName = "가".repeat(20);
const todoTitle = "할".repeat(24);
const userMessage = "메".repeat(200);
const at = "2026-07-16T03:30:00.000Z";

/** 템플릿별 최대 대표 사실. 분기마다 한 벌씩 둔다. 없는 템플릿은 사실이 없는 고정 문구다. */
const REPRESENTATIVE_FACTS: Readonly<Record<string, readonly NotificationCopyFacts[]>> = {
  "scheduler.TODO_REMINDER_60MIN": [{ todoTitle }],
  "scheduler.TODO_REMINDER_10MIN": [{ todoTitle }],
  "scheduler.MORNING_REMINDER": [{ count: 999 }],
  "scheduler.EVENING_PARTIAL": [{ remaining: 999 }],
  "scheduler.EVENING_STREAK": [{ streak: 999 }],
  "scheduler.EVENING_STREAK_30": [{ streak: 999 }],
  "scheduler.EVENING_STREAK_RISK_PARTIAL": [{ streak: 999, remaining: 999 }],
  "scheduler.EVENING_STREAK_RISK_NONE": [{ streak: 999 }],
  "scheduler.STREAK_AT_RISK": [{ streak: 999 }],
  "weather.MORNING_TODO_RAIN": [0, 1, 99].map((otherCount) => ({
    scheduledAt: at,
    timezone: "Asia/Seoul",
    todoTitle,
    precipChance: 100,
    otherCount,
  })),
  "weather.MORNING_TODO_STORM": [{ scheduledAt: at, timezone: "Asia/Seoul", todoTitle }],
  "weather.MORNING_TODO_SNOW": [{ scheduledAt: at, timezone: "Asia/Seoul", todoTitle }],
  "weather.MORNING_TODO_HEAT": [
    { scheduledAt: at, timezone: "Asia/Seoul", todoTitle, apparentTemp: 99 },
  ],
  "weather.MORNING_RAIN_LATER": [{ startsAt: at, timezone: "Asia/Seoul" }],
  "weather.MORNING_SNOW_LATER": [{ startsAt: at, timezone: "Asia/Seoul" }],
  "weather.MORNING_SUMMARY": [
    { condition: "MOSTLY_CLOUDY", tempMin: -99, tempMax: 99, precipChance: 100 },
  ],
  "weather.EVENING_RAIN": [
    { dayPart: "dawn", chillyTemp: -99 },
    { dayPart: null, chillyTemp: null },
  ],
  "weather.EVENING_SNOW": [
    { dayPart: "dawn", chillyTemp: -99 },
    { dayPart: null, chillyTemp: null },
  ],
  "weather.EVENING_SUMMARY": [true, false].map((isChilly) => ({
    condition: "MOSTLY_CLOUDY",
    tempMin: -99,
    tempMax: 99,
    isChilly,
  })),
  "social.NUDGE_REPLIED": [{ senderName: longName, todoTitle, replyKind: "STARTING" }],
  "social.NUDGE_THANKED": [{ senderName: longName, todoTitle }],
  "social.FOLLOW_NEW": [{ senderName: longName }],
  "social.FOLLOW_ACCEPTED": [{ senderName: longName }],
  "social.INVITE_PROGRESS": [{ inviteeName: longName }],
  "social.INVITE_QUALIFY_REMINDER": [{ inviterName: longName }],
  "social.INVITE_JOINED": [{ inviteeName: longName }],
  "social.INVITE_REWARDED": [
    { premiumDays: 9_999, friendSlots: 9_999 },
    { premiumDays: 9_999, friendSlots: 0 },
    { premiumDays: 0, friendSlots: 9_999 },
  ],
  "social.NUDGE_RECEIVED": [
    { senderName: longName, todoTitle },
    { senderName: longName, todoTitle: null },
  ],
  "social.NUDGE_RECEIVED_WITH_MESSAGE": [
    { senderName: longName, todoTitle, message: userMessage },
    { senderName: longName, todoTitle: null, message: userMessage },
  ],
  "social.REMIND_NUDGE_RECEIVED": [{ senderName: longName }],
  "social.REMIND_NUDGE_RECEIVED_WITH_MESSAGE": [{ senderName: longName, message: userMessage }],
  "social.CHEER_RECEIVED": [{ senderName: longName, message: userMessage }],
  "social.CHEER_RECEIVED_NO_MESSAGE": [{ senderName: longName }],
  "social.FRIEND_COMPLETED": [{ friendName: longName }],
  "social.SOCIAL_DIGEST_MULTI": [{ completedFriendCount: 999 }],
  "social.SOCIAL_DIGEST_SINGLE": [{ friendName: longName }],
  "social.NUDGE_SUGGEST": [{ friendName: longName }],
  "social.TODO_COMMENT": [{ senderName: longName }],
  "social.TODO_COMMENT_CHAIN": [{ senderName: longName, count: 999 }],
  "social.TODO_COMMENT_REPLY": [{ senderName: longName }],
  "social.TODO_COMMENT_REPLY_TO_REPLY": [{ senderName: longName }],
  "social.TODO_COMMENT_REPLY_CHAIN": [{ senderName: longName, count: 999 }],
  "social.TODO_COMMENT_LIKE": [{ senderName: longName }],
  "system.WEEKLY_ACHIEVEMENT": [{ completedCount: 99_999 }],
  "system.WEEKLY_ACHIEVEMENT_ALMOST": [{ rate: 99 }],
  "system.PREMIUM_TRIAL_ENDING_RENEWING": [0, 1, 30].map((days) => ({
    days,
    at,
    timezone: "Asia/Seoul",
    planType: "ANNUAL",
  })),
  "system.PREMIUM_TRIAL_ENDING_CANCELLED": [0, 1, 30].map((days) => ({
    days,
    at,
    timezone: "Asia/Seoul",
  })),
  "system.PREMIUM_RENEWAL_UPCOMING": [{ days: 30, at, timezone: "Asia/Seoul" }],
  "system.MARKETING_CONSENT_RECONFIRM": [{ agreedAt: at, timezone: "Asia/Seoul" }],
  "system.ONBOARDING_DAY5": [{ completedCount: 0 }, { completedCount: 99_999 }],
  "system.ONBOARDING_DAY7": [{ completedCount: 0 }, { completedCount: 99_999 }],
};

// 출시 문구를 그대로 옮긴 예외. 문구를 바꾸려면 Before/After 검토를 따로 거친다
const KO_TONE_EXCEPTIONS: readonly string[] = [
  // 명사(유지)로 끝나는 제목이라 반말이 아니다
  "scheduler.EVENING_STREAK_RISK_PARTIAL.v2: 999개 끝내면 연속 기록 유지",
];
const LENGTH_BUDGET_EXCEPTIONS: Readonly<Record<SupportedLocale, readonly string[]>> = {
  ko: [],
  // 제목 32 grapheme(예산 30)
  en: ["scheduler.TODO_SERIES_PAUSED.v1"],
};

// 인용(‘…’·“…”)은 친구가 한 말·할 일 제목이라 문장 끝에서 뺀다
function koreanSentencesOf(text: string): string[] {
  return text
    .replace(/[‘“][^’”]*[’”]/g, "")
    .split(/[.!?\n]|\s·\s/)
    .map((sentence) =>
      sentence.replace(/[\p{Extended_Pictographic}\uFE0F]/gu, "").replace(/[\s,~…]+$/u, ""),
    )
    .filter((sentence) => sentence.length > 0);
}

/** 합니다체(…니다)·해라체(…다)·반말(…어/아/해/야/지/자…)로 끝나는 ko 문장 */
const NOT_HAEYO_ENDING = /(?:니다|[^요]다|[어아해봐줘돼워야지자래냐니렴라걸])$/u;

interface RenderedCopy {
  readonly copyKey: string;
  readonly isFixed: boolean;
  readonly title: string;
  readonly body: string;
}

function renderCatalog(locale: SupportedLocale): RenderedCopy[] {
  return STORED_NOTIFICATION_COPY_TEMPLATES.flatMap((template) => {
    const factsList = REPRESENTATIVE_FACTS[template.key];
    return (factsList ?? [{}]).flatMap((facts) =>
      template.variantNames.map((variantName) => {
        const copy = template.renderStored(variantName, facts, locale);
        if (copy == null) {
          throw new Error(`${template.key}.${variantName}를 대표 사실로 렌더링하지 못했다`);
        }
        return {
          copyKey: `${template.key}.${variantName}`,
          isFixed: factsList == null,
          ...copy,
        };
      }),
    );
  });
}

function graphemeCount(value: string): number {
  return Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(value))
    .length;
}

describe("푸시 카탈로그 locale 계약", () => {
  it("기존 알림의 문구 선택 키·순서·개수를 유지한다", () => {
    // Given
    const catalog = NOTIFICATION_COPY_CATALOG.ko;

    // When
    const selectionContract = Object.fromEntries(
      Object.entries(CATALOG_GROUPS).map(([contractGroup, group]) => [
        contractGroup,
        childrenOf(catalog[group]).map(([key, node]) => {
          const variantNames = childrenOf(node).map(([name]) => name);
          return [key, variantNames[0] === "default" ? 0 : variantNames.length];
        }),
      ]),
    );

    // Then
    expect(selectionContract).toMatchSnapshot();
  });

  it("ko/en의 그룹 key와 variant 이름이 동일하다", () => {
    // When
    const shape = (locale: SupportedLocale) =>
      templateNodes(locale).map(([key, variants]) => [key, variants.map(([name]) => name)]);

    // Then
    expect(shape("en")).toEqual(shape("ko"));
    expect(renderCatalog("en")).toHaveLength(renderCatalog("ko").length);
  });

  it("variant 이름은 default 하나 또는 v1부터 빈틈없는 번호다", () => {
    for (const [key, variants] of templateNodes("ko")) {
      // When
      const names = variants.map(([name]) => name);

      // Then
      expect(
        names.length === 1 && names[0] === "default"
          ? names
          : names.map((_name, index) => `v${index + 1}`),
        key,
      ).toEqual(names);
    }
  });

  it("카탈로그의 모든 문구에 렌더링 템플릿이 있다", () => {
    // When
    const templateKeys = STORED_NOTIFICATION_COPY_TEMPLATES.map((template) => template.key);

    // Then
    expect(templateKeys.toSorted()).toEqual(
      templateNodes("ko")
        .map(([key]) => key)
        .toSorted(),
    );
    for (const template of STORED_NOTIFICATION_COPY_TEMPLATES) {
      const node = templateNodes("ko").find(([key]) => key === template.key);
      expect(template.variantNames, template.key).toEqual(node?.[1].map(([name]) => name));
    }
  });

  it("알림 하나(variant)에 쓰는 자리표시자는 ko/en이 같다", () => {
    // Given
    const english = new Map(templateNodes("en"));

    for (const [key, variants] of templateNodes("ko")) {
      for (const [name, node] of variants) {
        // When
        const enNode = english.get(key)?.find(([enName]) => enName === name)?.[1];

        // Then
        expect(new Set(placeholdersOf(enNode)), `${key}.${name}`).toEqual(
          new Set(placeholdersOf(node)),
        );
      }
    }
  });

  it.each(LOCALES)("%s의 모든 템플릿이 최대 대표 입력으로 유효한 copy를 렌더링한다", (locale) => {
    for (const notification of renderCatalog(locale)) {
      expect(`${notification.title}${notification.body}`, notification.copyKey).not.toMatch(/[{}]/);
    }
  });
});

describe("푸시 카피 품질 계약", () => {
  const forbiddenKoreanPhrases = [
    "아직도 안 했어",
    "너만 남았어",
    "이대로 잘 거야",
    "어디 갔어",
    "잊혀질 뻔",
    "기다리다 지쳤",
    "미루는 거야",
    "각오해",
    "미쳤다",
  ];
  const forbiddenEnglishPhrases = [
    "Brace yourself",
    "Still haven't",
    "only one left",
    "going to bed like this",
    "where'd you go",
    "almost got forgotten",
  ];
  const forbiddenPhraseCases: readonly [locale: SupportedLocale, phrases: readonly string[]][] = [
    ["ko", forbiddenKoreanPhrases],
    ["en", forbiddenEnglishPhrases],
  ];

  it.each(forbiddenPhraseCases)("%s 카피에는 죄책감·조롱 문구가 없다", (locale, phrases) => {
    for (const notification of renderCatalog(locale)) {
      const text = `${notification.title} ${notification.body}`.toLowerCase();
      for (const phrase of phrases) {
        expect(text).not.toContain(phrase.toLowerCase());
      }
    }
  });

  it.each(LOCALES)("%s 알림 하나에는 emoji를 최대 하나만 쓴다", (locale) => {
    for (const notification of renderCatalog(locale)) {
      // When
      const emojiCount = `${notification.title}${notification.body}`.match(
        /\p{Extended_Pictographic}/gu,
      )?.length;

      // Then
      expect(emojiCount ?? 0, notification.copyKey).toBeLessThanOrEqual(1);
    }
  });

  it.each([
    ["확인합니다", true],
    ["다시 시작했다", true],
    ["하나만 해봐", true],
    ["같이 하자 🐾", true],
    ["확인해주세요", false],
    ["‘{todoTitle}’ · “시작해볼게”", false],
    ["오늘 할 일 3개 ☀️", false],
  ] as const)("해요체 검사는 %s의 끝을 판정한다 → 위반 %s", (text, expected) => {
    // When
    const isViolation = koreanSentencesOf(text).some((sentence) => NOT_HAEYO_ENDING.test(sentence));

    // Then
    expect(isViolation).toBe(expected);
  });

  it("ko 카피는 해요체로 끝나고 합니다체·반말로 끝나지 않는다", () => {
    // When
    const violations = renderCatalog("ko").flatMap((notification) =>
      [...koreanSentencesOf(notification.title), ...koreanSentencesOf(notification.body)]
        .filter((sentence) => NOT_HAEYO_ENDING.test(sentence))
        .map((sentence) => `${notification.copyKey}: ${sentence}`),
    );

    // Then
    expect([...new Set(violations)]).toEqual(KO_TONE_EXCEPTIONS);
  });

  it.each(LOCALES)("%s 고정 카피는 잠금 화면 길이 예산을 지킨다", (locale) => {
    // When
    const overBudget = renderCatalog(locale)
      .filter(({ isFixed }) => isFixed)
      .filter(({ title, body }) => graphemeCount(title) > 30 || graphemeCount(body) > 40)
      .map(({ copyKey }) => copyKey);

    // Then
    expect(overBudget).toEqual(LENGTH_BUDGET_EXCEPTIONS[locale]);
  });
});
