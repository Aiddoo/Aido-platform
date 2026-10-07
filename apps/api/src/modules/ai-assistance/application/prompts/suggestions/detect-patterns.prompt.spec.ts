import type { SuggestionContext } from "../../types/suggestions/suggestion-context.js";
import {
  buildSuggestionPrompt,
  detectedPatternsSchema,
  detectedPatternsSchemaEn,
  getDetectedPatternsSchema,
  suggestionPromptCatalog,
} from "./detect-patterns.prompt.js";

const baseContext: SuggestionContext = {
  streak: "3일",
  currentDate: "2026-07-07 (화)",
  dayCompletionRates: "MON: 80%",
  timeCompletionRates: "09:00: 85%",
  categoryRates: "운동: 70%",
  missingRoutines: ["운동 (WED)"],
  weather: null,
  weeklyReportInsight: null,
  suggestionHistory: [],
  todos: [
    {
      startDate: "2026-07-01",
      title: "운동",
      scheduledTime: "07:00",
      completed: true,
      categoryId: 1,
      categoryName: "운동",
    },
  ],
};

describe("buildSuggestionPrompt — locale 분기", () => {
  it("기본(ko)은 한국어 데이터와 시작 단계 지시를 생성한다", () => {
    // Given / When
    const { system, prompt } = buildSuggestionPrompt(baseContext, 3);

    // Then
    expect(system).toContain("실행 가능한 루틴을 제안하는 코치야");
    expect(system).toContain("1~2개");
    expect(system).toContain("반복 패턴·꾸준함·장기 습관으로 단정하지");
    expect(prompt).toContain("맞춤 루틴을 제안해줘");
    expect(prompt).toContain("<context_json>");
    expect(prompt).toContain('"title": "운동"');
  });

  it("locale 생략과 'ko' 명시는 동일한 프롬프트를 생성한다", () => {
    // Given / When
    const implicit = buildSuggestionPrompt(baseContext, 3);
    const explicit = buildSuggestionPrompt(baseContext, 3, "ko");

    // Then
    expect(explicit.system).toBe(implicit.system);
    expect(explicit.prompt).toBe(implicit.prompt);
  });

  it("en이면 영어 지시 프롬프트에 동일 데이터를 삽입한다", () => {
    // Given / When
    const { system, prompt } = buildSuggestionPrompt(baseContext, 3, "en");

    // Then
    expect(system).toContain("suggests actionable routines");
    expect(system).toContain("1-2");
    expect(system).toContain("Evidence is insufficient to claim repetition");
    expect(prompt).toContain("Write title and reason in English.");
    expect(prompt).toContain('"title": "운동"');
    expect(system).not.toContain("루틴을 제안하는 코치야");
  });

  it("충분한 기록에서는 억지로 5개를 채우지 않고 강한 제안만 최대 5개 요청한다", () => {
    const context = {
      ...baseContext,
      todos: Array(3).fill(baseContext.todos[0]),
    };
    const { system } = buildSuggestionPrompt(context, 3);

    expect(system).toContain("0~5개");
    expect(system).toContain("근거가 약하면 만들지 마");
    expect(system).not.toContain("반드시 정확히 5개");
  });
});

describe("getDetectedPatternsSchema", () => {
  it("ko는 기존 스키마를, en은 영어 describe 스키마를 반환한다", () => {
    // Given / When / Then
    expect(getDetectedPatternsSchema("ko")).toBe(detectedPatternsSchema);
    expect(getDetectedPatternsSchema("en")).toBe(detectedPatternsSchemaEn);
  });
});

describe("시작 단계와 반복 인정 횟수 구분", () => {
  it.each(["ko", "en"] as const)("%s 실제 호출 반복기준2에서도 기록2개는 시작 단계다", (locale) => {
    const context = { ...baseContext, todos: [baseContext.todos[0]!, baseContext.todos[0]!] };
    const { system, prompt } = buildSuggestionPrompt(context, 2, locale);
    const json = prompt.match(/<context_json>\n([\s\S]*?)\n<\/context_json>/)?.[1];
    expect(json).toBeDefined();
    expect(JSON.parse(json!)).toMatchObject({ mode: "STARTER", todoCount: 2 });
    expect(JSON.parse(json!).recordedActivities).toEqual([
      {
        title: "운동",
        occurrences: 2,
        completedOccurrences: 2,
        days: [{ day: "WED", total: 2, completed: 2 }],
        recordedTimes: ["07:00"],
      },
    ]);
    expect(system).toContain(
      locale === "ko" ? "confidence는 0.60 이하" : "confidence must be <= 0.60",
    );
  });
});

describe("실제 반복 근거와 사용자 안내", () => {
  const evidence = {
    title: "책 읽기 10분",
    occurrences: 3,
    completedOccurrences: 2,
    days: [{ day: "MON" as const, total: 3, completed: 2 }],
    recordedTimes: ["19:30"],
  };

  it.each(["ko", "en"] as const)(
    "%s는 서버 MON 근거·완료수·거절 이력을 데이터로 보존한다",
    (locale) => {
      const context = {
        ...baseContext,
        todos: ["2026-09-21", "2026-09-28", "2026-10-05"].map((startDate, index) => ({
          ...baseContext.todos[0]!,
          startDate,
          title: evidence.title,
          scheduledTime: "19:30",
          completed: index < 2,
        })),
        recordedActivities: [evidence],
        suggestionHistory: [{ title: evidence.title, status: "DISMISSED" as const }],
      };
      const { system, prompt } = buildSuggestionPrompt(context, 3, locale);
      const json = prompt.match(/<context_json>\n([\s\S]*?)\n<\/context_json>/)?.[1];
      expect(json).toBeDefined();
      const data = JSON.parse(json!);
      expect(data.recordedActivities).toEqual([evidence]);
      expect(data.suggestionHistory).toEqual(context.suggestionHistory);
      expect(system).toContain("MON");
      expect(system).toContain("SUN");
      expect(system).toContain("ACCEPTED");
      expect(system).toContain(locale === "ko" ? "3개 넣고 1개로 합치지" : "three copies, not one");
      expect(system).toContain(
        locale === "ko" ? "15분 독서도 제외" : "excludes a 15-minute reading",
      );
    },
  );

  it("반복 안내는 등록과 완료를 구분하며 실제 월요일과 반복설정 이점을 설명한다", () => {
    const ko = suggestionPromptCatalog.ko.repeatReason(evidence, ["MON"]);
    const en = suggestionPromptCatalog.en.repeatReason(evidence, ["MON"]);
    expect(ko).toContain("기록 3회 중 2회 완료");
    expect(ko).toContain("월요일 등록 3회·완료 2회");
    expect(ko).toContain("매번 다시 입력할 일을 줄일");
    expect(ko).not.toContain("일요일");
    expect(en).toContain("completed 2 of 3");
    expect(en).toContain("Monday: 3 recorded, 2 completed");
    expect(en).toContain("reduce entering it again");
    expect(en).not.toContain("Sunday");
  });
});

describe("원본 분량을 보존하는 시작 제안", () => {
  it.each([
    ["ko", "러닝"],
    ["en", "Running"],
    ["ko", "러닝 30분"],
    ["en", "Running for 30 minutes"],
  ] as const)("%s 원본 '%s'를 새 분량 없이 재시도 근거로 전달한다", (locale, title) => {
    // Given: 기록 하나이며 시각은 지정하지 않았다.
    const context: SuggestionContext = {
      ...baseContext,
      timeCompletionRates: "",
      todos: [{ ...baseContext.todos[0]!, title, scheduledTime: null }],
    };
    // When: 실제 분석 인수2로 프롬프트와 서버 안내 문구를 만든다.
    const { system, prompt } = buildSuggestionPrompt(context, 2, locale);
    const json = prompt.match(/<context_json>\n([\s\S]*?)\n<\/context_json>/)?.[1];
    if (json === undefined) throw new Error("context_json missing");
    const data = JSON.parse(json);
    const reason = suggestionPromptCatalog[locale].starterReason(1, data.recordedActivities[0], [
      "WED",
    ]);
    // Then: 원본 활동/분량·실제요일·시간없음이 유지되며 새로운 수치를 정하라는 지시가 없다.
    expect(data.mode).toBe("STARTER");
    expect(data.todos[0]).toMatchObject({ title, scheduledTime: null });
    expect(data.recordedActivities[0]).toMatchObject({
      title,
      occurrences: 1,
      completedOccurrences: 1,
      days: [{ day: "WED", total: 1, completed: 1 }],
      recordedTimes: [],
    });
    expect(reason).toContain(`'${title}'`);
    expect(reason).toContain(locale === "ko" ? "수요일" : "Wednesday");
    expect(reason).toContain(
      locale === "ko" ? "패턴을 단정하긴 일러요" : "too early to call this a pattern",
    );
    expect(system).toContain(
      locale === "ko"
        ? "미명시 시간·횟수·거리를 추가하지"
        : "Add no unstated time, count, or distance",
    );
    expect(system).not.toContain("5~20분");
    expect(system).not.toContain("5-20 minutes");
  });
});
