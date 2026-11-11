import { ValueObject } from "#api/shared/domain/model/value-object";

/** 스트릭 지속 상태(영속 대상) */
export interface StreakState {
  currentStreak: number;
  longestStreak: number;
  lastCompletedDate: Temporal.PlainDate | null;
}

/** 전체 완료 반영 계획 */
export interface StreakCompletionPlan {
  nextState: StreakState;
  /** 3일 연속 마일스톤 도달 여부 */
  reachedStreak3: boolean;
}

/**
 * 사용자 설정이 소유하는 스트릭 값 객체.
 *
 * 사용자의 연속 완료(streak) 상태와 그 전이 규칙을 소유한다.
 * 오늘 전체 완료 시 증가, 완료 취소 시 재계산한다.
 */
export class Streak extends ValueObject<StreakState> {
  static reconstitute(state: StreakState): Streak {
    return new Streak({
      currentStreak: state.currentStreak,
      longestStreak: state.longestStreak,
      lastCompletedDate: state.lastCompletedDate,
    });
  }

  get currentStreak(): number {
    return this.value.currentStreak;
  }

  get longestStreak(): number {
    return this.value.longestStreak;
  }

  get lastCompletedDate(): Temporal.PlainDate | null {
    return this.value.lastCompletedDate;
  }

  /** 오늘 완료가 이미 반영되어 있는지 */
  isCompletedOn(today: Temporal.PlainDate): boolean {
    return this.value.lastCompletedDate?.equals(today) ?? false;
  }

  /**
   * 오늘 전체 완료 → 스트릭 증가 계획을 반환한다.
   * 이미 오늘 반영되었으면 null(무변경).
   */
  planCompletion(today: Temporal.PlainDate): StreakCompletionPlan | null {
    if (this.isCompletedOn(today)) {
      return null;
    }

    const yesterday = today.subtract({ days: 1 });
    const isConsecutive = this.value.lastCompletedDate?.equals(yesterday) ?? false;

    const newStreak = isConsecutive ? this.value.currentStreak + 1 : 1;
    const newLongest = Math.max(this.value.longestStreak, newStreak);

    return {
      nextState: {
        currentStreak: newStreak,
        longestStreak: newLongest,
        lastCompletedDate: today,
      },
      reachedStreak3: newStreak === 3,
    };
  }

  /**
   * 완료 취소 → 오늘 전체 완료가 아니게 되면 스트릭 재계산 계획을 반환한다.
   * 오늘 완료 반영이 없었으면 null(무변경).
   */
  planUncompletion(today: Temporal.PlainDate, hadYesterdayCompletion: boolean): StreakState | null {
    if (!this.isCompletedOn(today)) {
      return null;
    }

    if (hadYesterdayCompletion) {
      // 어제까지의 스트릭은 유지하되, 오늘은 제거
      return {
        currentStreak: Math.max(this.value.currentStreak - 1, 0),
        longestStreak: this.value.longestStreak,
        lastCompletedDate: today.subtract({ days: 1 }),
      };
    }

    // 어제도 완료 아니었으면 스트릭 리셋
    return {
      currentStreak: 0,
      longestStreak: this.value.longestStreak,
      lastCompletedDate: null,
    };
  }
}
