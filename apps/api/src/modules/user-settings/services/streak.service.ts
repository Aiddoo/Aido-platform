import { Injectable, Logger } from "@nestjs/common";

import { addDays, subtractDays } from "@/common/date/utils/arithmetic";
import { isSameDay } from "@/common/date/utils/compare";
import { startOfDay } from "@/common/date/utils/range";
import { todayInTimezone } from "@/common/date/utils/timezone";
import { DatabaseService } from "@/database";
import { NotificationQueueService } from "@/modules/notification/queue/notification-queue.service";

import { UserPreferenceRepository } from "../repositories/user-preference.repository";

export interface EffectiveStreakResult {
	streak: number;
	isAtRisk: boolean;
}

@Injectable()
export class StreakService {
	readonly #logger = new Logger(StreakService.name);

	constructor(
		private readonly userPreferenceRepository: UserPreferenceRepository,
		private readonly database: DatabaseService,
		private readonly notificationQueueService: NotificationQueueService,
	) {}

	/**
	 * 저녁 리마인더 sweep용 — 입력값만으로 effective streak 계산
	 *
	 * StreakService.#onAllCompleted()와 동일한 로직을 DB 접근 없이 수행.
	 * 호출자가 이미 조회한 데이터를 전달하면, 추가 쿼리 없이 정확한 streak 반환.
	 */
	static computeEffectiveStreak(params: {
		currentStreak: number;
		lastCompletedDate: Date | null;
		todosCompleted: number;
		todosTotal: number;
		today: Date;
	}): EffectiveStreakResult {
		const {
			currentStreak,
			lastCompletedDate,
			todosCompleted,
			todosTotal,
			today,
		} = params;
		const yesterday = subtractDays(1, today);

		// 전체 완료 시: streak 갱신 여부 판별
		if (todosCompleted === todosTotal && todosTotal > 0) {
			// StreakService에서 이미 DB 반영된 경우
			if (lastCompletedDate && isSameDay(lastCompletedDate, today)) {
				return { streak: currentStreak, isAtRisk: false };
			}
			// 아직 미반영: 어제 완료 → 연속, 아니면 새 시작
			if (lastCompletedDate && isSameDay(lastCompletedDate, yesterday)) {
				return { streak: currentStreak + 1, isAtRisk: false };
			}
			return { streak: 1, isAtRisk: false };
		}

		// 미완료 시: 스트릭 위기 판별
		const isAtRisk =
			todosCompleted < todosTotal &&
			currentStreak >= 2 &&
			!!lastCompletedDate &&
			isSameDay(lastCompletedDate, yesterday);

		return { streak: currentStreak, isAtRisk };
	}

	/**
	 * 투두 완료 상태 변경 시 스트릭 갱신
	 *
	 * 전체 완료 → 스트릭 증가, 완료 취소 → 스트릭 재계산
	 */
	async onTodoToggled(
		userId: string,
		completed: boolean,
		tz: string = "UTC",
	): Promise<void> {
		try {
			const today = todayInTimezone(tz);
			const stats = await this.#getTodoStats(userId, today);

			if (stats.total === 0) return;

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

	/**
	 * 특정 날짜의 투두 완료 현황 조회 (순환 의존성 방지를 위해 직접 쿼리)
	 */
	async #getTodoStats(
		userId: string,
		date: Date,
	): Promise<{ total: number; completed: number }> {
		const dayStart = startOfDay(date);
		const dayEnd = addDays(1, dayStart);

		const where = {
			userId,
			startDate: { gte: dayStart, lt: dayEnd },
		};

		const [total, completed] = await Promise.all([
			this.database.todo.count({ where }),
			this.database.todo.count({ where: { ...where, completed: true } }),
		]);

		return { total, completed };
	}

	/**
	 * 오늘 투두 전체 완료 → 스트릭 증가
	 */
	async #onAllCompleted(userId: string, today: Date): Promise<void> {
		const pref = await this.userPreferenceRepository.findByUserId(userId);
		if (!pref) return;

		const { currentStreak, longestStreak, lastCompletedDate } = pref;

		if (lastCompletedDate && isSameDay(lastCompletedDate, today)) {
			return;
		}

		const yesterday = subtractDays(1, today);
		const isConsecutive =
			lastCompletedDate && isSameDay(lastCompletedDate, yesterday);

		const newStreak = isConsecutive ? currentStreak + 1 : 1;
		const newLongest = Math.max(longestStreak, newStreak);

		await this.userPreferenceRepository.updateStreak(userId, {
			currentStreak: newStreak,
			longestStreak: newLongest,
			lastCompletedDate: today,
		});

		if (newStreak === 3) {
			this.notificationQueueService.enqueueMilestoneReached({
				userId,
				milestone: "STREAK_3",
			});
		}

		this.#logger.log(
			`Streak updated: userId=${userId}, streak=${newStreak}, longest=${newLongest}`,
		);
	}

	/**
	 * 투두 완료 취소 → 오늘 전체 완료가 아니게 되면 스트릭 재계산
	 */
	async #onUncompleted(userId: string, today: Date): Promise<void> {
		const pref = await this.userPreferenceRepository.findByUserId(userId);
		if (!pref) return;

		const { lastCompletedDate } = pref;

		if (!lastCompletedDate || !isSameDay(lastCompletedDate, today)) {
			return;
		}

		const yesterday = subtractDays(1, today);
		const yesterdayStats = await this.#getTodoStats(userId, yesterday);

		const hadYesterdayCompletion =
			yesterdayStats.total > 0 &&
			yesterdayStats.total === yesterdayStats.completed;

		if (hadYesterdayCompletion) {
			// 어제까지의 스트릭은 유지하되, 오늘은 제거
			const newStreak = Math.max(pref.currentStreak - 1, 0);
			await this.userPreferenceRepository.updateStreak(userId, {
				currentStreak: newStreak,
				longestStreak: pref.longestStreak,
				lastCompletedDate: yesterday,
			});
		} else {
			// 어제도 완료 아니었으면 스트릭 리셋
			await this.userPreferenceRepository.updateStreak(userId, {
				currentStreak: 0,
				longestStreak: pref.longestStreak,
				lastCompletedDate: null,
			});
		}

		this.#logger.log(`Streak recalculated on uncomplete: userId=${userId}`);
	}
}
