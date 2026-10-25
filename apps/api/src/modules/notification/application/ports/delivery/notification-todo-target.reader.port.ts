export const NOTIFICATION_TODO_TARGET_READER = Symbol("NOTIFICATION_TODO_TARGET_READER");

/** 할 일이 대상인 알림이 앱에서 그 할 일을 주인의 그 날짜 피드로 열 수 있게 하는 재료. */
export interface NotificationTodoTarget {
  readonly ownerId: string;
  /** 할 일 시작일 (YYYY-MM-DD) */
  readonly date: string;
}

export interface NotificationTodoTargetReaderPort {
  findTodoTargets(todoIds: readonly number[]): Promise<ReadonlyMap<number, NotificationTodoTarget>>;
}
