import type { TodoId } from "#api/modules/planning/todos/planning-todos-queries.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

// 할 일이 대상인 알림을 앱이 그 할 일 주인의 그 날짜 피드로 열 수 있게 하는 재료
export interface NotificationTodoTarget {
  readonly ownerId: UserId;
  // 할 일 시작일 (YYYY-MM-DD)
  readonly date: string;
}

export abstract class NotificationTodoTargetReaderPort {
  abstract listTodoTargets(
    todoIds: readonly TodoId[],
  ): Promise<ReadonlyMap<number, NotificationTodoTarget>>;
}
