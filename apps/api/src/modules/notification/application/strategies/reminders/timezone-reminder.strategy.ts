import type { TimezoneContext } from "../../../domain/services/reminders/timezone-context.js";

/** 타임존별 reminder 실행 결과는 오케스트레이터의 후속 분기에 쓰인다. */
export interface TimezoneReminderStrategy {
  execute(context: TimezoneContext): Promise<{ sent: number }>;
}
