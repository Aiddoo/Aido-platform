import { ErrorCode } from "@aido/api/errors";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { Entity } from "#api/shared/domain/model/entity";

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
  readonly totalTodos: number;
  readonly completedTodos: number;
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
export class WeeklyAchievement extends Entity<WeeklyAchievementId, WeeklyAchievementProps> {
  static create(params: CreateWeeklyAchievementParams): WeeklyAchievement {
    const { totalTodos, completedTodos } = params;
    if (totalTodos < 0) {
      throw new DomainException(ErrorCode.SYS_0002, { field: "totalTodos", value: totalTodos });
    }
    if (completedTodos < 0 || completedTodos > totalTodos) {
      throw new DomainException(ErrorCode.SYS_0002, {
        field: "completedTodos",
        completedTodos,
        totalTodos,
      });
    }
    return new WeeklyAchievement(params.id, {
      userId: params.userId,
      isoWeek: IsoWeek.create(params.year, params.week),
      totalTodos,
      completedTodos,
      achievedAt: params.achievedAt,
    });
  }

  static reconstitute(primitives: WeeklyAchievementPrimitives): WeeklyAchievement {
    return new WeeklyAchievement(WeeklyAchievementId.reconstitute(primitives.id), {
      userId: UserId.reconstitute(primitives.userId),
      isoWeek: IsoWeek.reconstitute(primitives.year, primitives.week),
      totalTodos: primitives.totalTodos,
      completedTodos: primitives.completedTodos,
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
    return this.props.totalTodos;
  }

  get completedTodos(): number {
    return this.props.completedTodos;
  }

  get achievedAt(): Temporal.Instant {
    return this.props.achievedAt;
  }

  get completionRate(): number {
    const { totalTodos, completedTodos } = this.props;
    return totalTodos > 0 ? Math.round((completedTodos / totalTodos) * 100) : 0;
  }

  /** 할 일이 하나 이상이고 모두 끝낸 주 */
  get isPerfect(): boolean {
    return this.props.totalTodos > 0 && this.props.completedTodos === this.props.totalTodos;
  }

  toPrimitives(): WeeklyAchievementPrimitives {
    return {
      id: this.id.value,
      userId: this.props.userId.value,
      year: this.props.isoWeek.year,
      week: this.props.isoWeek.week,
      totalTodos: this.props.totalTodos,
      completedTodos: this.props.completedTodos,
      achievedAt: this.props.achievedAt,
    };
  }
}
