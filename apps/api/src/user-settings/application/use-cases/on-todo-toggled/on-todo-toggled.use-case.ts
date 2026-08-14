import { Inject, Injectable, Logger } from "@nestjs/common";

import { addDays, subtractDays } from "@/shared/domain/date/utils/arithmetic";
import { startOfDay } from "@/shared/domain/date/utils/range";
import { todayInTimezone } from "@/shared/domain/date/utils/timezone";

import { UserPreference } from "../../../domain/entities/user-preference.aggregate";
import {
	STREAK_MILESTONE_NOTIFIER,
	type StreakMilestoneNotifierPort,
} from "../../ports/streak-milestone.notifier.port";
import {
	TODO_COMPLETION_STATS_READER,
	type TodoCompletionStatsReaderPort,
} from "../../ports/todo-completion-stats.reader.port";
import {
	USER_PREFERENCE_REPOSITORY,
	type UserPreferenceRepositoryPort,
} from "../../ports/user-preference.repository.port";

/**
 * 투두 완료 토글 시 스트릭 갱신 유스케이스.
 *
 * 전체 완료 → 스트릭 증가(3일 도달 시 마일스톤 알림), 완료 취소 → 재계산.
 * todo 어댑터가 fire-and-forget으로 호출하며, 실패는 삼켜 로깅한다.
 */
@Injectable()
export class OnTodoToggledUseCase {
	readonly #logger = new Logger(OnTodoToggledUseCase.name);

	constructor(
		@Inject(USER_PREFERENCE_REPOSITORY)
		private readonly preferenceRepository: UserPreferenceRepositoryPort,
		@Inject(TODO_COMPLETION_STATS_READER)
		private readonly statsReader: TodoCompletionStatsReaderPort,
		@Inject(STREAK_MILESTONE_NOTIFIER)
		private readonly milestoneNotifier: StreakMilestoneNotifierPort,
	) {}

	async execute(userId: string, completed: boolean, tz: string = "UTC"): Promise<void> {
		try {
			const today = todayInTimezone(tz);
			const stats = await this.#statsForDay(userId, today);

			if (stats.total === 0) {
				return;
			}

			const allCompleted = stats.total === stats.completed;

			if (completed && allCompleted) {
				await this.#onAllCompleted(userId, today);
			} else if (!completed) {
				await this.#onUncompleted(userId, today);
			}
		} catch (error) {
			this.#logger.error(
				`Failed to update streak: userId=${userId}, error=${error}`,
				error instanceof Error ? error.stack : undefined,
			);
		}
	}

	async #statsForDay(userId: string, date: Date) {
		const dayStart = startOfDay(date);
		const dayEnd = addDays(1, dayStart);
		return this.statsReader.countForDay(userId, dayStart, dayEnd);
	}

	async #onAllCompleted(userId: string, today: Date): Promise<void> {
		const pref = await this.preferenceRepository.findByUserId(userId);
		if (!pref) {
			return;
		}

		const preference = UserPreference.reconstitute(pref);
		const plan = preference.planTodoCompletion(today);
		if (!plan) {
			return;
		}

		await this.preferenceRepository.updateStreak(userId, plan.nextState);

		if (plan.reachedStreak3) {
			this.milestoneNotifier.notifyStreak3Reached(userId);
		}

		this.#logger.log(
			`Streak updated: userId=${userId}, streak=${plan.nextState.currentStreak}, longest=${plan.nextState.longestStreak}`,
		);
	}

	async #onUncompleted(userId: string, today: Date): Promise<void> {
		const pref = await this.preferenceRepository.findByUserId(userId);
		if (!pref) {
			return;
		}

		const preference = UserPreference.reconstitute(pref);
		if (!preference.hasTodoCompletionOn(today)) {
			return;
		}

		const yesterday = subtractDays(1, today);
		const yesterdayStats = await this.#statsForDay(userId, yesterday);
		const hadYesterdayCompletion =
			yesterdayStats.total > 0 && yesterdayStats.total === yesterdayStats.completed;

		const nextState = preference.planTodoUncompletion(today, hadYesterdayCompletion);
		if (!nextState) {
			return;
		}

		await this.preferenceRepository.updateStreak(userId, nextState);
		this.#logger.log(`Streak recalculated on uncomplete: userId=${userId}`);
	}
}
