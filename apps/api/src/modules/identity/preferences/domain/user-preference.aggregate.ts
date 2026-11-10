import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { AggregateRoot } from "#api/shared/domain/model/aggregate-root";

import { Streak, type StreakCompletionPlan, type StreakState } from "./streak.vo.js";

export interface UserPreferenceStreakPrimitives extends StreakState {
  readonly userId: string;
}

interface UserPreferenceProps {
  readonly streak: Streak;
}

/** 사용자 설정 Aggregate. 설정 중 상태 전이가 있는 연속 완료(streak)를 소유한다 */
export class UserPreference extends AggregateRoot<UserId, UserPreferenceProps> {
  static reconstitute(primitives: UserPreferenceStreakPrimitives): UserPreference {
    const { userId, ...streak } = primitives;
    return new UserPreference(UserId.reconstitute(userId), {
      streak: Streak.reconstitute(streak),
    });
  }

  get streakState(): StreakState {
    return {
      currentStreak: this.props.streak.currentStreak,
      longestStreak: this.props.streak.longestStreak,
      lastCompletedDate: this.props.streak.lastCompletedDate,
    };
  }

  planTodoCompletion(completedAt: Date): StreakCompletionPlan | null {
    return this.props.streak.planCompletion(completedAt);
  }

  planTodoUncompletion(uncompletedAt: Date, hadPreviousDayCompletion: boolean): StreakState | null {
    return this.props.streak.planUncompletion(uncompletedAt, hadPreviousDayCompletion);
  }

  hasTodoCompletionOn(date: Date): boolean {
    return this.props.streak.isCompletedOn(date);
  }
}
