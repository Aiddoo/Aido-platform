import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

export interface SingleTodoCountQuery {
  readonly userId: UserId;
  readonly from: Temporal.PlainDate;
  readonly to: Temporal.PlainDate;
}

/** 다른 Context(AI 제안)가 할 일 테이블을 직접 읽지 않고 기간에 시작한 단건 할 일 수를 받는 조회 포트 */
export abstract class SingleTodoCountReaderPort {
  /** 반복으로 만든 회차를 뺀, 시작일이 from 이상 to 이하인 할 일 수 */
  abstract countSingleTodos(query: SingleTodoCountQuery): Promise<number>;
}
