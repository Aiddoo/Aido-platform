import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { AggregateRoot } from "#api/shared/domain/model/aggregate-root";

import { TodoCompletionCount } from "../../shared/domain/todo-completion-count.vo.js";

export interface DailyCompletionPrimitives {
  readonly userId: string;
  readonly date: Temporal.PlainDate;
  readonly totalTodos: number;
  readonly completedTodos: number;
  readonly categoryColors: readonly string[];
}

interface DailyCompletionProps {
  readonly userId: UserId;
  readonly date: Temporal.PlainDate;
  readonly todoCount: TodoCompletionCount;
  readonly categoryColors: readonly string[];
}

interface CreateDailyCompletionParams {
  readonly userId: UserId;
  readonly date: Temporal.PlainDate;
  readonly totalTodos: number;
  readonly completedTodos: number;
  readonly categoryColors: readonly string[];
}

// 저장하지 않는다. 조회마다 planning 할 일 묶음을 세어 할 일이 있는 날만 만든다
export class DailyCompletion extends AggregateRoot<null, DailyCompletionProps> {
  static create(params: CreateDailyCompletionParams): DailyCompletion {
    return new DailyCompletion(null, {
      userId: params.userId,
      date: params.date,
      todoCount: TodoCompletionCount.create(params.totalTodos, params.completedTodos),
      categoryColors: [...params.categoryColors],
    });
  }

  get completionRate(): number {
    return this.props.todoCount.rate;
  }

  /** 할 일이 하나 이상이고 모두 끝낸 날(달력의 물고기) */
  isComplete(): boolean {
    return this.props.todoCount.isAllCompleted();
  }

  toPrimitives(): DailyCompletionPrimitives {
    return {
      userId: this.props.userId.value,
      date: this.props.date,
      totalTodos: this.props.todoCount.total,
      completedTodos: this.props.todoCount.completed,
      categoryColors: [...this.props.categoryColors],
    };
  }
}
