import { AggregateRoot } from "@/shared/domain/aggregate-root";

import type { UserPreferenceRecord } from "../records/user-preference.record";
import { Streak, type StreakCompletionPlan, type StreakState } from "../value-objects/streak.vo";

/** 사용자 설정 애그리게잇. 현재는 설정 중 상태 전이가 있는 스트릭을 소유한다. */
export class UserPreference extends AggregateRoot<UserPreferenceRecord> {
	private constructor(preference: UserPreferenceRecord) {
		super({
			...preference,
			lastCompletedDate: preference.lastCompletedDate
				? new Date(preference.lastCompletedDate)
				: null,
		});
	}

	/** 영속 상태 복원은 생성 규칙을 다시 검증하지 않는다. */
	static reconstitute(preference: UserPreferenceRecord): UserPreference {
		return new UserPreference(preference);
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
