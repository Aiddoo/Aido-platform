import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { WeatherReminderTodoReadModel } from "../read-models/scheduler.read-model.js";

export interface WeatherBriefingTodoQuery {
  readonly userIds: readonly UserId[];
  /** 발송 시간대의 오늘 */
  readonly date: Temporal.PlainDate;
  /** 할 일 벽시계를 만든 저장 시간대(여러 날 할 일의 그날 시각을 이 시간대로 읽는다) */
  readonly timezone: string;
  readonly from: Temporal.Instant;
  readonly until: Temporal.Instant;
}

/** 아침 날씨 알림이 오늘 할 일을 읽는 포트. 할 일 규칙은 planning이 소유한다 */
export abstract class WeatherBriefingTodoReaderPort {
  /**
   * 시각을 정한(종일 아님) 미완료 할 일 중 그날 시각이 [from, until) 안의 것. 전날부터 이어지는 여러 날 할 일은
   * 그날의 벽시계 시각으로 본다. 시각 순, 같으면 id 순이다
   */
  abstract listTodayTodos(query: WeatherBriefingTodoQuery): Promise<WeatherReminderTodoReadModel[]>;
}
