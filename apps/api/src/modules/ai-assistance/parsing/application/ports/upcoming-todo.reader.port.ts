import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { ExistingTodo } from "../../../shared/domain/action-plan-dedupe.domain-service.js";

export abstract class UpcomingTodoReaderPort {
  /** 사용자 시간대 오늘부터의 다가오는 할 일. 반복 할 일은 다음 회차 하나다. */
  abstract findByUserId(userId: UserId, timezone: string): Promise<readonly ExistingTodo[]>;
}
