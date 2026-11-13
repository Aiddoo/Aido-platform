import { ValueObject } from "#api/shared/domain/model/value-object";

import { invalidCompletedTodos, invalidTotalTodos } from "./insights.errors.js";

interface TodoCompletionCountValue {
  readonly total: number;
  readonly completed: number;
}

/** 한 기간(하루·한 주)에 있던 할 일 수와 그중 끝낸 수 */
export class TodoCompletionCount extends ValueObject<TodoCompletionCountValue> {
  static create(total: number, completed: number): TodoCompletionCount {
    if (!Number.isSafeInteger(total) || total < 0) {
      throw invalidTotalTodos(total);
    }
    if (!Number.isSafeInteger(completed) || completed < 0 || completed > total) {
      throw invalidCompletedTodos(completed, total);
    }
    return new TodoCompletionCount({ total, completed });
  }

  static reconstitute(total: number, completed: number): TodoCompletionCount {
    return new TodoCompletionCount({ total, completed });
  }

  get total(): number {
    return this.value.total;
  }

  get completed(): number {
    return this.value.completed;
  }

  /** 0~100으로 반올림한 완료율. 할 일이 없으면 0이다 */
  get rate(): number {
    const { total, completed } = this.value;
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  }

  /** 할 일이 하나 이상이고 모두 끝냈다 */
  isAllCompleted(): boolean {
    return this.value.total > 0 && this.value.completed === this.value.total;
  }
}
