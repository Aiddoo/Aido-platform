import { z } from "zod";

export const todoReminderParamSchema = z.object({
  todoId: z.coerce
    .number()
    .int()
    .positive("유효하지 않은 Todo ID입니다")
    .meta({ description: "리마인드 알림의 할 일 ID (양의 정수, 예: 1)" }),
});

export const snoozeTodoReminderSchema = z
  .object({
    notificationId: z.int32().positive().meta({
      description:
        "다시 알림 버튼을 누른 리마인드 알림의 ID(푸시 data의 notificationId). 내가 하루 안에 받은 그 할 일의 알림이어야 하고, 같은 알림으로 다시 보내도 예약은 하나다",
    }),
  })
  .meta({ example: { notificationId: 1024 } });
