import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { Entity } from "#api/shared/domain/model/entity";

import { DailyCompletionId } from "./daily-completion-id.vo.js";
import { invalidCompletedTodos, invalidTotalTodos } from "./daily-completions.errors.js";

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
  readonly totalTodos: number;
  readonly completedTodos: number;
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
export class DailyCompletion extends Entity<DailyCompletionId, DailyCompletionProps> {
  static create(params: CreateDailyCompletionParams): DailyCompletion {
    const { totalTodos, completedTodos } = params;
    if (!Number.isSafeInteger(totalTodos) || totalTodos < 0) {
      throw invalidTotalTodos(totalTodos);
    }
    if (
      !Number.isSafeInteger(completedTodos) ||
      completedTodos < 0 ||
      completedTodos > totalTodos
    ) {
      throw invalidCompletedTodos(completedTodos, totalTodos);
    }
    return DailyCompletion.#build(params);
  }

  static reconstitute(primitives: DailyCompletionPrimitives): DailyCompletion {
    return DailyCompletion.#build({
      ...primitives,
      userId: UserId.reconstitute(primitives.userId),
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
    return this.props.totalTodos;
  }

  get completedTodos(): number {
    return this.props.completedTodos;
  }

  get categoryColors(): readonly string[] {
    return this.props.categoryColors;
  }

  /** 할 일이 하나 이상이고 모두 끝낸 날(달력의 물고기) */
  get isComplete(): boolean {
    return this.props.totalTodos > 0 && this.props.totalTodos === this.props.completedTodos;
  }

  get completionRate(): number {
    const { totalTodos, completedTodos } = this.props;
    return totalTodos > 0 ? Math.round((completedTodos / totalTodos) * 100) : 0;
  }

  toPrimitives(): DailyCompletionPrimitives {
    return {
      userId: this.props.userId.value,
      date: this.props.date,
      totalTodos: this.props.totalTodos,
      completedTodos: this.props.completedTodos,
      categoryColors: [...this.props.categoryColors],
    };
  }
}
