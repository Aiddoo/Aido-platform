import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { AggregateRoot } from "#api/shared/domain/model/aggregate-root";

import { TodoCompletionCount } from "../../shared/domain/todo-completion-count.vo.js";
import { IsoWeek } from "./iso-week.vo.js";
import { WeeklyAchievementId } from "./weekly-achievement-id.vo.js";

export interface WeeklyAchievementPrimitives {
  readonly id: number;
  readonly userId: string;
  readonly year: number;
  readonly week: number;
  readonly totalTodos: number;
  readonly completedTodos: number;
  readonly achievedAt: Temporal.Instant;
}

interface WeeklyAchievementProps {
  readonly userId: UserId;
  readonly isoWeek: IsoWeek;
  readonly todoCount: TodoCompletionCount;
  readonly achievedAt: Temporal.Instant;
}

interface CreateWeeklyAchievementParams {
  readonly id: WeeklyAchievementId;
  readonly userId: UserId;
  readonly year: number;
  readonly week: number;
  readonly totalTodos: number;
  readonly completedTodos: number;
  readonly achievedAt: Temporal.Instant;
}

/** 지난 한 주(월~일)의 할 일 완료 기록. 주간 리마인더 배치가 사용자·주마다 하나씩 남긴다 */
export class WeeklyAchievement extends AggregateRoot<WeeklyAchievementId, WeeklyAchievementProps> {
  static create(params: CreateWeeklyAchievementParams): WeeklyAchievement {
    // 할 일 수를 주보다 먼저 검사한다(기존 오류 우선순위)
    const todoCount = TodoCompletionCount.create(params.totalTodos, params.completedTodos);
    return new WeeklyAchievement(params.id, {
      userId: params.userId,
      isoWeek: IsoWeek.create(params.year, params.week),
      todoCount,
      achievedAt: params.achievedAt,
    });
  }

  static reconstitute(primitives: WeeklyAchievementPrimitives): WeeklyAchievement {
    return new WeeklyAchievement(WeeklyAchievementId.reconstitute(primitives.id), {
      userId: UserId.reconstitute(primitives.userId),
      isoWeek: IsoWeek.reconstitute(primitives.year, primitives.week),
      todoCount: TodoCompletionCount.reconstitute(primitives.totalTodos, primitives.completedTodos),
      achievedAt: primitives.achievedAt,
    });
  }

  get userId(): UserId {
    return this.props.userId;
  }

  get isoWeek(): IsoWeek {
    return this.props.isoWeek;
  }

  get totalTodos(): number {
    return this.props.todoCount.total;
  }

  get completedTodos(): number {
    return this.props.todoCount.completed;
  }

  get achievedAt(): Temporal.Instant {
    return this.props.achievedAt;
  }

  get completionRate(): number {
    return this.props.todoCount.rate;
  }

  /** 할 일이 하나 이상이고 모두 끝낸 주 */
  isPerfect(): boolean {
    return this.props.todoCount.isAllCompleted();
  }

  toPrimitives(): WeeklyAchievementPrimitives {
    return {
      id: this.id.value,
      userId: this.props.userId.value,
      year: this.props.isoWeek.year,
      week: this.props.isoWeek.week,
      totalTodos: this.props.todoCount.total,
      completedTodos: this.props.todoCount.completed,
      achievedAt: this.props.achievedAt,
    };
  }
}
