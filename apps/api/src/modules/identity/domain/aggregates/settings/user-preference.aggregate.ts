import { AggregateRoot } from "#api/shared/domain/aggregate-root";

import {
  Streak,
  type StreakCompletionPlan,
  type StreakState,
} from "../../value-objects/settings/streak.vo.js";

/** 사용자 설정 애그리게잇. 현재는 설정 중 상태 전이가 있는 스트릭을 소유한다. */
export class UserPreference extends AggregateRoot<StreakState> {
  private constructor(preference: StreakState) {
    super({
      currentStreak: preference.currentStreak,
      longestStreak: preference.longestStreak,
      lastCompletedDate:
        preference.lastCompletedDate === null ? null : new Date(preference.lastCompletedDate),
    });
  }

  /** 영속 상태 복원은 생성 규칙을 다시 검증하지 않는다. */
  static reconstitute(preference: StreakState): UserPreference {
    return new UserPreference(preference);
  }

  get streakState(): StreakState {
    return {
      currentStreak: this.props.currentStreak,
      longestStreak: this.props.longestStreak,
      lastCompletedDate:
        this.props.lastCompletedDate === null ? null : new Date(this.props.lastCompletedDate),
    };
  }

  planTodoCompletion(completedAt: Date): StreakCompletionPlan | null {
    return this.#streak().planCompletion(completedAt);
  }

  planTodoUncompletion(uncompletedAt: Date, hadPreviousDayCompletion: boolean): StreakState | null {
    return this.#streak().planUncompletion(uncompletedAt, hadPreviousDayCompletion);
  }

  hasTodoCompletionOn(date: Date): boolean {
    return this.#streak().isCompletedOn(date);
  }

  #streak(): Streak {
    return Streak.of(this.props);
  }
}
