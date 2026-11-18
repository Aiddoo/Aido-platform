import { defineRateLimits } from "#api/platform/throttle/rate-limits";

// 다시 알림은 누른 알림마다 한 번이라 여러 알림을 잇달아 눌러도 넘지 않는다. 넘는 것은 자동 요청뿐이다
export const ReminderRateLimits = defineRateLimits({
  snoozeTodoReminder: { limitPerMinute: 10, limitPerDay: 200 },
});
