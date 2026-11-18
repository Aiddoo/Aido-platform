import { readFileSync } from "node:fs";

import { parsedMemoDataSchema, parsedTodoDataSchema } from "@aido/api/contracts/ai/v1";
import {
  AI_REPORT_TYPES,
  AI_SUGGESTION_STATUSES,
  DAYS_OF_WEEK,
  SUPPORTED_LOCALES,
  TODO_VISIBILITIES,
} from "@aido/api/vocabulary";
import { z } from "zod";

import type { NormalizedActionPlan } from "#api/modules/ai-assistance/action-plan-drafts/domain/action-plan-drafts.constants";
import { memoDraftSchema } from "#api/modules/ai-assistance/ai-generations/infrastructure/adapters/parse-memo-draft.wire";
import { todoDraftSchema } from "#api/modules/ai-assistance/ai-generations/infrastructure/adapters/parse-todo-draft.wire";
import { quickPlanDraftSchema } from "#api/modules/ai-assistance/ai-generations/infrastructure/adapters/quick-plan-draft.wire";
import { reportDraftSchema } from "#api/modules/ai-assistance/ai-generations/infrastructure/adapters/report-draft.wire";
import { PLAN_REPEAT_PATTERNS } from "#api/modules/ai-assistance/ai-generations/infrastructure/adapters/schedule-expression.wire";
import { suggestionDraftSchema } from "#api/modules/ai-assistance/ai-generations/infrastructure/adapters/suggestion-draft.wire";
import { voiceNoteDigestDraftSchema } from "#api/modules/ai-assistance/ai-generations/infrastructure/adapters/voice-note-digest-draft.wire";
import type { ScheduleClock } from "#api/modules/ai-assistance/shared/domain/schedule-time.domain-service";
import {
  resolvePlanSchedule,
  resolveTodoSchedule,
} from "#api/modules/ai-assistance/shared/domain/todo-schedule.domain-service";
import type { SuggestionContextReadModel } from "#api/modules/ai-assistance/suggestions/application/read-models/suggestion-context.read-model";
import { SUGGESTION_MODES } from "#api/modules/ai-assistance/suggestions/domain/suggestion-candidates.domain-service";
import {
  createRepeatRefFixture,
  createScheduleDraftFixture,
} from "#test/fixtures/ai-assistance/ai-response.fixture";

/** golden 묶음. mixed는 한국어·영어를 섞어 말한 입력이고 locale은 앱 언어다. */
export const GOLDEN_VARIANTS = ["ko", "en", "mixed"] as const;
export type GoldenVariant = (typeof GOLDEN_VARIANTS)[number];

export const GOLDEN_TASKS = [
  "parse-todo",
  "parse-memo",
  "quick-plan",
  "voice-note-digest",
  "suggestion",
  "report",
] as const;
export type GoldenTask = (typeof GOLDEN_TASKS)[number];

const goldenBase = {
  id: z.string(),
  locale: z.enum(SUPPORTED_LOCALES),
  timezone: z.string(),
  now: z.iso.datetime(),
};

/** parse-todo golden 한 줄. draft는 모델이 내야 할 표현, expected는 서버 계산 결과다. */
export const parseTodoGoldenCaseSchema = z.object({
  ...goldenBase,
  input: z.string(),
  draft: todoDraftSchema,
  expected: parsedTodoDataSchema,
});
export type ParseTodoGoldenCase = z.infer<typeof parseTodoGoldenCaseSchema>;

/** parse-memo golden 한 줄. expected의 categoryId는 요청 기본값 GOLDEN_MEMO_CATEGORY_ID다. */
export const parseMemoGoldenCaseSchema = z.object({
  ...goldenBase,
  input: z.string(),
  draft: memoDraftSchema,
  expected: parsedMemoDataSchema,
});
export type ParseMemoGoldenCase = z.infer<typeof parseMemoGoldenCaseSchema>;
export const GOLDEN_MEMO_CATEGORY_ID = 1;

const planningContextSchema = z.object({
  categories: z.array(z.object({ id: z.number().int(), name: z.string() })),
  upcomingTodos: z.array(
    z.object({
      id: z.number().int(),
      title: z.string(),
      startDate: z.iso.date(),
      isRepeating: z.boolean(),
    }),
  ),
});

/**
 * 계획 할 일의 기대값. 날짜는 일정 표현을 서버 resolver로 계산한 값이라 같은 뜻의 다른 표현
 * (내일 = 목요일)도 같게 비교된다. 반복은 종류·요일·날짜와 종료 날짜(없으면 계속 반복)로 비교한다.
 */
const plannedTodoExpectationSchema = z.object({
  title: z.string(),
  categoryId: z.number().int().nullable(),
  startDate: z.iso.date(),
  endDate: z.iso.date().nullable(),
  scheduledTime: z.string().nullable(),
  repeat: z
    .object({
      pattern: z.enum(PLAN_REPEAT_PATTERNS),
      daysOfWeek: z.array(z.enum(DAYS_OF_WEEK)),
      monthDay: z.number().int().nullable(),
      until: z.iso.date().nullable(),
      forDuration: z
        .object({ unit: z.enum(["DAY", "WEEK", "MONTH"]), amount: z.number().int() })
        .nullable(),
    })
    .nullable(),
  visibility: z.enum(TODO_VISIBILITIES).extract(["PRIVATE"]).nullable(),
  items: z.array(z.string()),
  duplicateOfTodoId: z.number().int().nullable(),
});
export type PlannedTodoExpectation = z.infer<typeof plannedTodoExpectationSchema>;

const planExpectationSchema = z.object({
  todos: z.array(plannedTodoExpectationSchema),
  memo: z.object({ title: z.string(), content: z.string() }).nullable(),
});

export const quickPlanGoldenCaseSchema = z.object({
  ...goldenBase,
  input: z.string(),
  context: planningContextSchema,
  draft: quickPlanDraftSchema,
  expected: planExpectationSchema,
});
export type QuickPlanGoldenCase = z.infer<typeof quickPlanGoldenCaseSchema>;

export const voiceNoteDigestGoldenCaseSchema = z.object({
  ...goldenBase,
  sentences: z.array(z.object({ text: z.string(), isBookmarked: z.boolean() })),
  context: planningContextSchema,
  draft: voiceNoteDigestDraftSchema,
  expected: planExpectationSchema.extend({
    keyPointSentenceIndexes: z.array(z.number().int()),
  }),
});
export type VoiceNoteDigestGoldenCase = z.infer<typeof voiceNoteDigestGoldenCaseSchema>;

/**
 * 제안 golden 한 줄. todos는 최근 2주 기록, repeatingTitles는 진행 중인 반복 할 일, draft는 이상적인 모델 출력이다.
 * 기대 id는 서버가 todos로 만든 후보 id(a1…)이고 atMostOneOf는 같은 활동이라 하나만 골라야 하는 묶음이다.
 * groupedTitles는 서버가 한 후보로 묶어야 하는 제목들, excludedTitles는 후보가 되면 안 되는 제목이다.
 */
export const suggestionGoldenCaseSchema = z.object({
  ...goldenBase,
  todos: z.array(
    z.object({
      title: z.string(),
      startDate: z.iso.date(),
      completed: z.boolean(),
      scheduledTime: z.string().nullable(),
      categoryName: z.string(),
    }),
  ),
  history: z.array(
    z.object({ title: z.string(), status: z.enum(AI_SUGGESTION_STATUSES).exclude(["PENDING"]) }),
  ),
  repeatingTitles: z.array(z.string()),
  draft: suggestionDraftSchema,
  expected: z.object({
    mode: z.enum(SUGGESTION_MODES),
    maxPicks: z.number().int(),
    expectNone: z.boolean(),
    allowedCandidateIds: z.array(z.string()),
    forbiddenCandidateIds: z.array(z.string()),
    atMostOneOf: z.array(z.array(z.string())),
    groupedTitles: z.array(z.array(z.string())),
    excludedTitles: z.array(z.string()),
  }),
});
export type SuggestionGoldenCase = z.infer<typeof suggestionGoldenCaseSchema>;

/** 카테고리 id는 이름 순서로 붙인다. 제안 카테고리는 같은 이름의 기록에서 고른다. */
export function toSuggestionContext(golden: SuggestionGoldenCase): SuggestionContextReadModel {
  const categoryNames = [...new Set(golden.todos.map(({ categoryName }) => categoryName))];
  return {
    todos: golden.todos.map((todo) => ({
      ...todo,
      categoryId: categoryNames.indexOf(todo.categoryName) + 1,
    })),
    suggestionHistory: golden.history,
    repeatingTitles: golden.repeatingTitles,
  };
}

const rateItem = { total: z.number().int(), completed: z.number().int(), rate: z.number() };

/** 리포트 golden 한 줄. input은 서버 집계(ReportPromptInput), draft는 이상적인 모델 출력이다. */
export const reportGoldenCaseSchema = z.object({
  id: z.string(),
  locale: z.enum(SUPPORTED_LOCALES),
  input: z.object({
    type: z.enum(AI_REPORT_TYPES),
    periodLabel: z.string(),
    period: z.object({ start: z.iso.date(), end: z.iso.date() }),
    previousTips: z.array(z.string()).nullable(),
    reportData: z.object({
      totalTodos: z.number().int(),
      completedTodos: z.number().int(),
      completionRate: z.number(),
      prevCompletionRate: z.number().nullable(),
      streakDays: z.number().int(),
      categoryBreakdown: z.array(z.object({ name: z.string(), color: z.string(), ...rateItem })),
      dayPatterns: z.array(z.object({ day: z.enum(DAYS_OF_WEEK), ...rateItem })),
      timePatterns: z.array(z.object({ hour: z.number().int(), count: z.number().int() })),
      hasActivity: z.boolean(),
    }),
  }),
  draft: reportDraftSchema,
  expected: z.object({ forbiddenPhrases: z.array(z.string()) }),
});
export type ReportGoldenCase = z.infer<typeof reportGoldenCaseSchema>;

/** jsonl 한 줄씩 schema로 검증한다. 형식이 틀린 줄이 있으면 실패한다. */
export function readGoldenLines<S extends z.ZodType>(schema: S, path: string | URL): z.output<S>[] {
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => schema.parse(JSON.parse(line)));
}

const goldenPath = (task: GoldenTask, variant: GoldenVariant) =>
  new URL(`./${task}.${variant}.jsonl`, import.meta.url);

export function loadParseTodoGoldenCases(variant: GoldenVariant): ParseTodoGoldenCase[] {
  return readGoldenLines(parseTodoGoldenCaseSchema, goldenPath("parse-todo", variant));
}

export function loadParseMemoGoldenCases(variant: GoldenVariant): ParseMemoGoldenCase[] {
  return readGoldenLines(parseMemoGoldenCaseSchema, goldenPath("parse-memo", variant));
}

export function loadQuickPlanGoldenCases(variant: GoldenVariant): QuickPlanGoldenCase[] {
  return readGoldenLines(quickPlanGoldenCaseSchema, goldenPath("quick-plan", variant));
}

export function loadVoiceNoteDigestGoldenCases(
  variant: GoldenVariant,
): VoiceNoteDigestGoldenCase[] {
  return readGoldenLines(voiceNoteDigestGoldenCaseSchema, goldenPath("voice-note-digest", variant));
}

export function loadSuggestionGoldenCases(variant: GoldenVariant): SuggestionGoldenCase[] {
  return readGoldenLines(suggestionGoldenCaseSchema, goldenPath("suggestion", variant));
}

export function loadReportGoldenCases(variant: GoldenVariant): ReportGoldenCase[] {
  return readGoldenLines(reportGoldenCaseSchema, goldenPath("report", variant));
}

export function toPlanExpectation(plan: NormalizedActionPlan, clock: ScheduleClock) {
  return {
    todos: plan.todos.map((todo): PlannedTodoExpectation => {
      const { repeat } = todo.schedule;
      const planned = resolvePlanSchedule(todo.schedule, clock);
      const repeats = planned.repeat != null;
      const resolved = repeats
        ? resolveTodoSchedule(
            { ...todo.schedule, repeat: createRepeatRefFixture({ pattern: "NONE" }) },
            clock,
          )
        : planned;
      const until =
        repeat.until == null || repeat.until.kind === "NONE"
          ? null
          : resolveTodoSchedule(createScheduleDraftFixture({ date: repeat.until }), clock)
              .startDate;
      return {
        title: todo.title,
        categoryId: todo.categoryId,
        startDate: resolved.startDate,
        endDate: resolved.endDate,
        scheduledTime: resolved.scheduledTime,
        repeat: repeats
          ? {
              pattern: repeat.pattern,
              daysOfWeek: [...(repeat.daysOfWeek ?? [])].sort(
                (left, right) => DAYS_OF_WEEK.indexOf(left) - DAYS_OF_WEEK.indexOf(right),
              ),
              monthDay: repeat.monthDay,
              until,
              forDuration: repeat.forDuration,
            }
          : null,
        visibility: todo.visibility,
        items: [...todo.items],
        duplicateOfTodoId: todo.duplicateOfTodoId,
      };
    }),
    memo: plan.memo,
  };
}
