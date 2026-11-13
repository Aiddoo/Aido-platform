import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { AggregateRoot } from "#api/shared/domain/model/aggregate-root";

import { TodoCompletionCount } from "../../shared/domain/todo-completion-count.vo.js";
import { DailyCompletionId } from "./daily-completion-id.vo.js";

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

/** 한 사용자의 하루 할 일 완료 현황. 할 일이 있는 날만 만든다. */
export class DailyCompletion extends AggregateRoot<DailyCompletionId, DailyCompletionProps> {
  static create(params: CreateDailyCompletionParams): DailyCompletion {
    return DailyCompletion.#build({
      userId: params.userId,
      date: params.date,
      todoCount: TodoCompletionCount.create(params.totalTodos, params.completedTodos),
      categoryColors: params.categoryColors,
    });
  }

  static reconstitute(primitives: DailyCompletionPrimitives): DailyCompletion {
    return DailyCompletion.#build({
      userId: UserId.reconstitute(primitives.userId),
      date: primitives.date,
      todoCount: TodoCompletionCount.reconstitute(primitives.totalTodos, primitives.completedTodos),
      categoryColors: primitives.categoryColors,
    });
  }

  static #build(props: DailyCompletionProps): DailyCompletion {
    return new DailyCompletion(DailyCompletionId.create(props), {
      ...props,
      categoryColors: [...props.categoryColors],
    });
  }

  get date(): Temporal.PlainDate {
    return this.props.date;
  }

  get totalTodos(): number {
    return this.props.todoCount.total;
  }

  get completedTodos(): number {
    return this.props.todoCount.completed;
  }

  get categoryColors(): readonly string[] {
    return this.props.categoryColors;
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
