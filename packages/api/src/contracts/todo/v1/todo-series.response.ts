import { z } from "zod";

import {
  dateSchema,
  datetimeSchema,
  nullableDateSchema,
  timeOfDaySchema,
} from "../../../common/datetime.js";
import { todoRepeatSchema, todoVisibilitySchema } from "./todo.common.js";

export const todoSeriesResponseSchema = z
  .object({
    id: z.string().describe("반복 할 일 ID (할 일 응답의 recurrenceGroupId와 같은 값)"),
    title: z.string().describe("새 회차에 쓸 제목"),
    categoryId: z.number().int().describe("새 회차에 쓸 카테고리 ID"),
    visibility: todoVisibilitySchema.describe("새 회차에 쓸 공개 범위"),
    scheduledTime: timeOfDaySchema
      .nullable()
      .describe("규칙 시간대의 시각 (HH:mm, 종일 반복은 null)"),
    timezone: z
      .string()
      .describe("규칙의 시간대 (IANA). 벽시계 시각을 회차의 순간으로 바꿀 때 쓴다"),
    repeat: todoRepeatSchema,
    startDate: dateSchema.describe("반복 시작일 (YYYY-MM-DD)"),
    nextOccurrenceDate: nullableDateSchema.describe(
      "다음에 만들 회차 날짜 (YYYY-MM-DD, 더 만들 회차가 없으면 null)",
    ),
    isActive: z.boolean().describe("더 만들 회차가 남았는지"),
    checklist: z.array(z.object({ title: z.string() })).describe("새 회차에 복사할 하위 할 일"),
    createdAt: datetimeSchema.describe("규칙을 만든 시각 (ISO 8601 UTC)"),
    updatedAt: datetimeSchema.describe("규칙을 고친 시각 (ISO 8601 UTC)"),
  })
  .meta({
    example: {
      id: "0193a5f0-7c1e-7000-8000-000000000001",
      title: "물 마시기",
      categoryId: 1,
      visibility: "PUBLIC",
      scheduledTime: "09:00",
      timezone: "Asia/Seoul",
      repeat: {
        frequency: "WEEKLY",
        interval: 1,
        weekdays: ["MON", "WED"],
        end: { type: "NEVER" },
      },
      startDate: "2026-11-02",
      nextOccurrenceDate: "2027-02-01",
      isActive: true,
      checklist: [],
      createdAt: "2026-11-02T00:00:00.000Z",
      updatedAt: "2026-11-02T00:00:00.000Z",
    },
  });

export type TodoSeriesResponse = z.infer<typeof todoSeriesResponseSchema>;
