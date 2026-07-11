import { subtractDays } from "@/shared/domain/date/utils/arithmetic";
import { isSameDay } from "@/shared/domain/date/utils/compare";

/** 스트릭 지속 상태(영속 대상) */
export interface StreakState {
	currentStreak: number;
	longestStreak: number;
	lastCompletedDate: Date | null;
}

/** 전체 완료 반영 계획 */
export interface StreakCompletionPlan {
	nextState: StreakState;
	/** 3일 연속 마일스톤 도달 여부 */
	reachedStreak3: boolean;
}

/**
 * 스트릭 애그리게잇.
 *
 * 사용자의 연속 완료(streak) 상태와 그 전이 규칙을 소유한다.
 * 오늘 전체 완료 시 증가, 완료 취소 시 재계산한다.
 */
export class Streak {
	private constructor(
		private readonly _currentStreak: number,
		private readonly _longestStreak: number,
		private readonly _lastCompletedDate: Date | null,
	) {}

	static of(state: StreakState): Streak {
		return new Streak(
			state.currentStreak,
			state.longestStreak,
			state.lastCompletedDate,
		);
	}

	get currentStreak(): number {
		return this._currentStreak;
	}

	get longestStreak(): number {
		return this._longestStreak;
	}

	get lastCompletedDate(): Date | null {
		return this._lastCompletedDate;
	}

	/** 오늘 완료가 이미 반영되어 있는지 */
	isCompletedOn(today: Date): boolean {
		return (
			this._lastCompletedDate !== null &&
			isSameDay(this._lastCompletedDate, today)
		);
	}

	/**
	 * 오늘 전체 완료 → 스트릭 증가 계획을 반환한다.
	 * 이미 오늘 반영되었으면 null(무변경).
	 */
	planCompletion(today: Date): StreakCompletionPlan | null {
		if (this._lastCompletedDate && isSameDay(this._lastCompletedDate, today)) {
			return null;
		}

		const yesterday = subtractDays(1, today);
		const isConsecutive =
			this._lastCompletedDate && isSameDay(this._lastCompletedDate, yesterday);

		const newStreak = isConsecutive ? this._currentStreak + 1 : 1;
		const newLongest = Math.max(this._longestStreak, newStreak);

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
	planUncompletion(
		today: Date,
		hadYesterdayCompletion: boolean,
	): StreakState | null {
		if (
			!this._lastCompletedDate ||
			!isSameDay(this._lastCompletedDate, today)
		) {
			return null;
		}

		const yesterday = subtractDays(1, today);

		if (hadYesterdayCompletion) {
			// 어제까지의 스트릭은 유지하되, 오늘은 제거
			return {
				currentStreak: Math.max(this._currentStreak - 1, 0),
				longestStreak: this._longestStreak,
				lastCompletedDate: yesterday,
			};
		}

		// 어제도 완료 아니었으면 스트릭 리셋
		return {
			currentStreak: 0,
			longestStreak: this._longestStreak,
			lastCompletedDate: null,
		};
	}
}
