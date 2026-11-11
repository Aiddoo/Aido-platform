import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

/** 같은 (시작일, 종료일, 카테고리, 완료) 할 일 묶음. 날짜별로 펼치는 일은 읽는 쪽 규칙이 한다. */
export interface TodoCompletionGroup {
  readonly startDate: Temporal.PlainDate;
  readonly endDate: Temporal.PlainDate | null;
  readonly completed: boolean;
  readonly categoryColor: string | null;
  readonly todoCount: number;
}

export interface TodoCompletionGroupQuery {
  readonly userId: UserId;
  readonly start: Temporal.PlainDate;
  readonly end: Temporal.PlainDate;
  /** 친구에게 보이는 공개 할 일만 센다 */
  readonly publicOnly: boolean;
}

/** 다른 Context(insights 일간 완료)가 할 일 테이블을 직접 읽지 않고 구간의 할 일 수를 받는 조회 포트 */
export abstract class TodoCompletionGroupReaderPort {
  /**
   * 구간의 어느 날에든 걸친 할 일을 묶어 센다. 하루에 걸치는 조건은 startDate <= 그날 AND
   * (endDate >= 그날 OR (endDate 없음 AND startDate = 그날))이다. 순서는 정하지 않는다.
   */
  abstract listCompletionGroups(query: TodoCompletionGroupQuery): Promise<TodoCompletionGroup[]>;
}
