import { z } from "zod";

import { dateSchema, nullableDateSchema, timeOfDaySchema } from "../../../common/datetime.js";
import { ACTION_PLAN_LIMITS } from "../../../vocabulary/ai.constants.js";
import { MEMO_LIMITS } from "../../../vocabulary/memo.constants.js";
import { TODO_ITEM_LIMITS } from "../../../vocabulary/todo.constants.js";
import { PLANNED_ACTION_KEY_MAX_LENGTH } from "../../../vocabulary/voice.constants.js";
import { tokenUsageSchema } from "../../ai/v1/ai-usage.response.js";
import { todoRepeatSchema, todoVisibilitySchema } from "../../todo/v1/todo.common.js";

const plannedActionKeySchema = z
  .string()
  .min(1)
  .max(PLANNED_ACTION_KEY_MAX_LENGTH)
  .describe("계획 안에서 행동을 가리키는 값 (앱의 선택·편집 상태에 쓴다)");

/** 손으로 만든 할 일과 같은 칸. 알림은 시간이 있으면 알림 모듈이 자동으로 등록하므로 칸을 두지 않는다. */
export const plannedTodoFields = {
  type: z.literal("CREATE_TODO"),
  key: plannedActionKeySchema,
  title: z
    .string()
    .trim()
    .min(1)
    .max(ACTION_PLAN_LIMITS.ACTION_TITLE_MAX_LENGTH)
    .describe("할 일 제목 (말한 언어 그대로)"),
  startDate: dateSchema.describe("시작 날짜 (사용자 시간대 YYYY-MM-DD)"),
  endDate: nullableDateSchema.describe("기간의 끝 날짜. 하루짜리이거나 반복이면 null"),
  scheduledTime: timeOfDaySchema.nullable().describe("시각 (HH:mm). null이면 종일"),
  repeat: todoRepeatSchema.nullable().describe("반복 규칙. 반복이 아니면 null"),
  visibility: todoVisibilitySchema.nullable().describe("공개 범위. 말하지 않았으면 null(기본값)"),
  items: z
    .array(
      z.object({ title: z.string().trim().min(1).max(ACTION_PLAN_LIMITS.ACTION_TITLE_MAX_LENGTH) }),
    )
    .max(TODO_ITEM_LIMITS.MAX_PER_TODO)
    .describe(`하위 할 일 (최대 ${TODO_ITEM_LIMITS.MAX_PER_TODO}개)`),
} as const;

export const plannedMemoActionSchema = z.object({
  type: z.literal("CREATE_MEMO"),
  key: plannedActionKeySchema,
  title: z
    .string()
    .trim()
    .max(ACTION_PLAN_LIMITS.ACTION_TITLE_MAX_LENGTH)
    .describe("메모 제목 (비어 있을 수 있다)"),
  content: z
    .string()
    .trim()
    .min(1)
    .max(MEMO_LIMITS.MAX_CONTENT_LENGTH)
    .describe(`메모 내용 (최대 ${MEMO_LIMITS.MAX_CONTENT_LENGTH}자)`),
});

export type PlannedMemoAction = z.infer<typeof plannedMemoActionSchema>;

export const plannedTodoActionSchema = z.object({
  ...plannedTodoFields,
  categoryId: z
    .number()
    .int()
    .positive()
    .nullable()
    .describe("사용자 카테고리 id. AI가 고르지 못했으면 null(앱이 현재 카테고리를 쓴다)"),
  duplicateOfTodoId: z
    .number()
    .int()
    .positive()
    .nullable()
    .describe("이미 있는 같은 할 일의 id. 있으면 앱은 기본으로 선택하지 않는다"),
});

export type PlannedTodoAction = z.infer<typeof plannedTodoActionSchema>;

export const plannedActionSchema = z.discriminatedUnion("type", [
  plannedTodoActionSchema,
  plannedMemoActionSchema,
]);

export type PlannedAction = z.infer<typeof plannedActionSchema>;

export const actionPlanSchema = z
  .object({
    actions: z
      .array(plannedActionSchema)
      .describe(
        `말한 순서의 행동 (할 일 최대 ${ACTION_PLAN_LIMITS.MAX_TODOS}개 + 메모 ${ACTION_PLAN_LIMITS.MAX_MEMOS}개). 찾은 게 없으면 빈 배열`,
      ),
    omittedTodoCount: z
      .number()
      .int()
      .nonnegative()
      .describe(`상한 ${ACTION_PLAN_LIMITS.MAX_TODOS}개를 넘어 계획에 넣지 않은 할 일 수`),
  })
  .describe("실행 계획. 서버는 저장하지 않고 사용자가 확인한 행동만 적용 API로 받는다");

export type ActionPlan = z.infer<typeof actionPlanSchema>;

export const actionPlanMetaSchema = z
  .object({
    model: z.string().describe("응답한 AI 모델 (예: anthropic:claude-haiku-5-5)"),
    processingTimeMs: z.number().int().nonnegative().describe("처리 시간 (밀리초)"),
    tokenUsage: tokenUsageSchema,
    promptVersion: z.string().describe("응답을 만든 프롬프트 버전 (예: quick-plan@1)"),
  })
  .describe("AI 처리 메타데이터");

export type ActionPlanMeta = z.infer<typeof actionPlanMetaSchema>;
