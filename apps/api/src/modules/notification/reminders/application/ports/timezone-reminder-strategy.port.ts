import type { TimezoneContext } from "../../domain/timezone-context.read-model.js";

// sweep이 시간대·분마다 부르는 발송 전략. 결과는 후속 분기(소셜 다이제스트 등)에 쓴다
export abstract class TimezoneReminderStrategyPort {
  abstract execute(context: TimezoneContext): Promise<{ sent: number }>;
}
