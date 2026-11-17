import { z } from "zod";

import { datetimeSchema } from "../../../common/datetime.js";

export const todoReminderSnoozeResponseSchema = z
  .object({
    remindAt: datetimeSchema.meta({
      description:
        "다시 알림이 울릴 시각 (ISO 8601 UTC). 같은 알림으로 다시 보내면 이번 요청 기준이다",
    }),
  })
  .meta({ example: { remindAt: "2026-11-18T09:40:00.000Z" } });
