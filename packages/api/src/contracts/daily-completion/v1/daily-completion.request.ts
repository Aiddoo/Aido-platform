import { z } from "zod";

import { dateSchema } from "../../../common/datetime.js";

const dailyCompletionDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "날짜 형식은 YYYY-MM-DD입니다")
  .refine((value) => dateSchema.safeParse(value).success, "유효한 날짜를 입력해주세요");

export const getDailyCompletionsRangeSchema = z
  .object({
    startDate: dailyCompletionDateSchema.meta({
      description: "시작 날짜 (YYYY-MM-DD, 예: 2026-01-01)",
    }),
    endDate: dailyCompletionDateSchema.meta({
      description: "종료 날짜 (YYYY-MM-DD, 예: 2026-01-31)",
    }),
  })
  .refine((data) => data.startDate <= data.endDate, "시작 날짜는 종료 날짜보다 이전이어야 합니다");
