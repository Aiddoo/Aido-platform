import type { TodoReadModel } from "../read-models/todo.read-model.js";

// 옛 Symbol 토큰. 소비 Context가 클래스 토큰으로 옮길 때까지 같은 인스턴스 별칭으로 남긴다
export const TODO_PLAN_READER = Symbol("TODO_PLAN_READER");

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
    userId: string,
    input: { readonly fromDate: Date; readonly limit: number },
  ): Promise<UpcomingTodoView[]>;
  abstract findManyByIds(userId: string, ids: readonly number[]): Promise<TodoReadModel[]>;
}
