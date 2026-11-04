import { z } from "zod";

import { dateSchema } from "../../../common/datetime.js";

export const todoSeriesNotFoundErrorDetailsSchema = z
  .object({ seriesId: z.string().describe("찾지 못한 반복 할 일 ID") })
  .describe("TODO_0841 상세");

export const todoSeriesLimitErrorDetailsSchema = z
  .object({
    limit: z.number().int().positive().describe("진행 중인 반복 할 일 시스템 상한"),
    activeCount: z.number().int().nonnegative().describe("현재 진행 중인 반복 할 일 수"),
  })
  .describe("TODO_0842 상세");

export const todoSeriesNoDatesErrorDetailsSchema = z
  .object({ startDate: dateSchema.describe("요청한 시작일 (YYYY-MM-DD)") })
  .describe("TODO_0843 상세");

export const todoSeriesScopeErrorDetailsSchema = z
  .object({
    todoId: z.number().int().positive().describe("범위를 지정한 할 일 ID"),
    scope: z.string().describe("요청한 수정·삭제 범위"),
  })
  .describe("TODO_0844 상세");

export const todoSeriesRuleErrorDetailsSchema = z
  .object({ field: z.string().describe("반복 설정에서 맞지 않는 칸") })
  .describe("TODO_0845 상세");

export const todoSeriesEndedErrorDetailsSchema = z
  .object({ seriesId: z.string().describe("이미 끝난 반복 할 일 ID") })
  .describe("TODO_0846 상세");
