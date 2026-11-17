import { z } from "zod";

import { dateSchema } from "../../../common/datetime.js";
import { todoRepeatSchema } from "./todo.common.js";

export const todoSeriesNotFoundErrorDetailsSchema = z
  .object({ seriesId: z.string().meta({ description: "찾지 못한 반복 할 일 ID" }) })
  .meta({ description: "TODO_0841 상세" });

export const todoSeriesLimitErrorDetailsSchema = z
  .object({
    limit: z.int().positive().meta({ description: "진행 중인 반복 할 일 시스템 상한" }),
    activeCount: z.int().nonnegative().meta({ description: "현재 진행 중인 반복 할 일 수" }),
  })
  .meta({ description: "TODO_0842 상세" });

export const todoSeriesNoDatesErrorDetailsSchema = z
  .object({
    startDate: dateSchema.meta({ description: "요청한 시작일 (YYYY-MM-DD)" }),
    repeat: todoRepeatSchema.optional().meta({ description: "요청한 반복 규칙" }),
  })
  .meta({ description: "TODO_0843 상세" });

export const todoSeriesScopeErrorDetailsSchema = z
  .object({
    todoId: z.int().positive().meta({ description: "범위를 지정한 할 일 ID" }),
    scope: z.string().meta({ description: "요청한 수정·삭제 범위" }),
  })
  .meta({ description: "TODO_0844 상세" });

export const todoSeriesRuleErrorDetailsSchema = z
  .object({ field: z.string().meta({ description: "반복 설정에서 맞지 않는 칸" }) })
  .meta({ description: "TODO_0845 상세" });

export const todoSeriesEndedErrorDetailsSchema = z
  .object({ seriesId: z.string().meta({ description: "이미 끝난 반복 할 일 ID" }) })
  .meta({ description: "TODO_0846 상세" });
