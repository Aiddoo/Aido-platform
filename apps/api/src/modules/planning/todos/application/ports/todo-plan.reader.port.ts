import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { TodoId } from "../../../shared/domain/todo-id.vo.js";
import type { TodoReadModel } from "../read-models/todo.read-model.js";

/** 계획의 겹침 판정·고유명사 교정에 쓰는 다가오는 할 일. 반복 할 일은 다음 회차 하나다. */
export interface UpcomingTodoView {
  readonly id: number;
  readonly title: string;
  readonly startDate: string;
  readonly isRepeating: boolean;
}

/** 다른 Context가 계획을 세우고 적용 결과를 다시 돌려줄 때 읽는 할 일 */
export abstract class TodoPlanReaderPort {
  abstract findUpcoming(
    userId: UserId,
    input: { readonly fromDate: Temporal.PlainDate; readonly limit: number },
  ): Promise<UpcomingTodoView[]>;
  abstract findManyByIds(userId: UserId, ids: readonly TodoId[]): Promise<TodoReadModel[]>;
}
