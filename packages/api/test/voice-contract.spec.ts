import { describe, expect, it } from "vitest";

import {
  applyActionPlanRequestSchema,
  plannedActionSchema,
  voiceNoteDigestRequestSchema,
} from "../src/contracts/voice/index.js";
import { ErrorCode } from "../src/errors/errors.js";
import { toPublicErrorDetails } from "../src/errors/public-details.js";
import { ACTION_PLAN_LIMITS } from "../src/vocabulary/ai.constants.js";

const todoAction = (key: string) => ({
  type: "CREATE_TODO" as const,
  key,
  title: "회의록 보내기",
  categoryId: 1,
  startDate: "2026-11-06",
  endDate: null,
  scheduledTime: null,
  repeat: null,
  visibility: null,
  items: [],
});

describe("voice 계약", () => {
  it("적용 요청은 카테고리가 없는 할 일을 거절한다", () => {
    // Given
    const request = {
      source: "QUICK_VOICE",
      actions: [{ ...todoAction("todo-0"), categoryId: null }],
    };
    // When
    const parsed = applyActionPlanRequestSchema.safeParse(request);
    // Then
    expect(parsed.success).toBe(false);
  });

  it("적용 요청은 반복 할 일에 종료 날짜를 함께 보내면 거절한다", () => {
    // Given
    const repeat = { frequency: "DAILY", end: { type: "NEVER" } };
    const request = {
      source: "VOICE_NOTE",
      actions: [{ ...todoAction("todo-0"), repeat, endDate: "2026-11-30" }],
    };
    // When
    const parsed = applyActionPlanRequestSchema.safeParse(request);
    // Then
    expect(parsed.success).toBe(false);
  });

  it("적용 요청은 상한을 넘는 할 일과 겹치는 key를 거절한다", () => {
    // Given
    const tooMany = Array.from({ length: ACTION_PLAN_LIMITS.MAX_TODOS + 1 }, (_, index) =>
      todoAction(`todo-${index}`),
    );
    const sameKeys = [todoAction("todo-0"), todoAction("todo-0")];
    // When
    const results = [tooMany, sameKeys].map(
      (actions) =>
        applyActionPlanRequestSchema.safeParse({ source: "QUICK_TEXT", actions }).success,
    );
    // Then
    expect(results).toEqual([false, false]);
  });

  it.each([
    { source: "MEMO", sourceMemoId: 7, valid: true },
    { source: "MEMO", sourceMemoId: undefined, valid: false },
    { source: "QUICK_VOICE", sourceMemoId: undefined, valid: true },
    { source: "QUICK_VOICE", sourceMemoId: 7, valid: false },
    { source: "VOICE_NOTE", sourceMemoId: 7, valid: false },
  ])(
    "source $source에 sourceMemoId $sourceMemoId는 유효=$valid다",
    ({ source, sourceMemoId, valid }) => {
      // Given
      const request = { source, sourceMemoId, actions: [todoAction("todo-0")] };
      // When
      const parsed = applyActionPlanRequestSchema.safeParse(request);
      // Then
      expect(parsed.success).toBe(valid);
    },
  );

  it("계획 응답의 할 일은 카테고리와 겹침 표시가 없어도 된다", () => {
    // Given
    const action = { ...todoAction("todo-0"), categoryId: null, duplicateOfTodoId: null };
    // When
    const parsed = plannedActionSchema.safeParse(action);
    // Then
    expect(parsed.success).toBe(true);
  });

  it("녹음 정리 요청은 글자 상한을 schema로 막지 않아 서버 정책이 AI_1312로 답한다", () => {
    // Given
    const text = "가".repeat(100_000);
    // When
    const parsed = voiceNoteDigestRequestSchema.safeParse({
      text,
      durationSeconds: 60,
      segments: [],
    });
    // Then
    expect(parsed.success).toBe(true);
  });

  it("AI_1312·AI_1315·AI_1318 공개 상세는 정해진 칸만 싣는다", () => {
    // Given
    const featureQuota = {
      feature: "VOICE_NOTE",
      allowed: true,
      limit: 3,
      used: 1,
      remaining: 2,
      period: "month",
      resetsAt: "2026-11-30T15:00:00.000Z",
      isFairUse: false,
      perUse: { maxSeconds: 180, maxCharacters: 4000 },
    };
    // When
    const tooLong = toPublicErrorDetails(ErrorCode.AI_1312, {
      charged: false,
      featureQuota,
      characterCount: 5000,
      maxCharacters: 4000,
      secret: "x",
    });
    const rejected = toPublicErrorDetails(ErrorCode.AI_1315, {
      reason: "CATEGORY_NOT_OWNED",
      categoryIds: [9],
      userId: "u",
    });
    const reused = toPublicErrorDetails(ErrorCode.AI_1318, { charged: false, userId: "u" });
    // Then
    expect(tooLong).toEqual({
      charged: false,
      featureQuota,
      characterCount: 5000,
      maxCharacters: 4000,
    });
    expect(rejected).toEqual({ reason: "CATEGORY_NOT_OWNED", categoryIds: [9] });
    expect(reused).toEqual({ charged: false });
  });
});
