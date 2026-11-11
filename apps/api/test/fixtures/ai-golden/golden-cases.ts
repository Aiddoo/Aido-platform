import { readFileSync } from "node:fs";

import { parsedMemoDataSchema, parsedTodoDataSchema } from "@aido/api";
import { DAYS_OF_WEEK, TODO_VISIBILITIES } from "@aido/api/vocabulary";
import { z } from "zod";

import { memoDraftSchema } from "#api/modules/ai-assistance/parsing/application/messages/parse-memo-draft.wire";
import { todoDraftSchema } from "#api/modules/ai-assistance/parsing/application/messages/parse-todo-draft.wire";
import { PLAN_REPEAT_PATTERNS } from "#api/modules/ai-assistance/parsing/application/messages/schedule-expression.wire";
import { quickPlanDraftSchema } from "#api/modules/ai-assistance/planning/application/messages/quick-plan-draft.wire";
import { voiceNoteDigestDraftSchema } from "#api/modules/ai-assistance/planning/application/messages/voice-note-digest-draft.wire";
import type { NormalizedActionPlan } from "#api/modules/ai-assistance/planning/domain/action-plan-draft.constants";
import {
  resolvePlanSchedule,
  resolveTodoSchedule,
  type ScheduleClock,
} from "#api/modules/ai-assistance/shared/domain/todo-schedule.domain-service";
import { repeatRefFixture, scheduleDraftFixture } from "#test/fixtures/ai-response.fixture";

/** golden 묶음. mixed는 한국어·영어를 섞어 말한 입력이고 locale은 앱 언어다. */
export const GOLDEN_VARIANTS = ["ko", "en", "mixed"] as const;
export type GoldenVariant = (typeof GOLDEN_VARIANTS)[number];

export const GOLDEN_TASKS = [
  "parse-todo",
  "parse-memo",
  "quick-plan",
  "voice-note-digest",
] as const;
export type GoldenTask = (typeof GOLDEN_TASKS)[number];

const goldenBase = {
  id: z.string(),
  locale: z.enum(["ko", "en"]),
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

export function toPlanExpectation(plan: NormalizedActionPlan, clock: ScheduleClock) {
  return {
    todos: plan.todos.map((todo): PlannedTodoExpectation => {
      const { repeat } = todo.schedule;
      const planned = resolvePlanSchedule(todo.schedule, clock);
      const repeats = planned.repeat != null;
      const resolved = repeats
        ? resolveTodoSchedule(
            { ...todo.schedule, repeat: repeatRefFixture({ pattern: "NONE" }) },
            clock,
          )
        : planned;
      const until =
        repeat.until == null || repeat.until.kind === "NONE"
          ? null
          : resolveTodoSchedule(scheduleDraftFixture({ date: repeat.until }), clock).startDate;
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
