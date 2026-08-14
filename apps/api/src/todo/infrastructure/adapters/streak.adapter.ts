import { Inject, Injectable } from "@nestjs/common";

import { USER_STREAK_ACCESS, type UserStreakAccessPort } from "@/user-settings";

import type { StreakPort } from "../../application/ports/streak.port";

/**
 * todo의 스트릭 포트를 user-settings의 공개 capability에 연결한다.
 */
@Injectable()
export class StreakAdapter implements StreakPort {
	constructor(
		@Inject(USER_STREAK_ACCESS)
		private readonly userStreakAccess: UserStreakAccessPort,
	) {}

	async recordTodoToggle(userId: string, completed: boolean, timezone: string): Promise<void> {
		await this.userStreakAccess.recordTodoToggle(userId, completed, timezone);
	}

	async getStreakContext(userId: string): Promise<{
		currentStreak: number;
		lastCompletedDate: Date | null;
	}> {
		const record = await this.userStreakAccess.getPreferenceRecord(userId);
		return {
			currentStreak: record?.currentStreak ?? 0,
			lastCompletedDate: record?.lastCompletedDate ?? null,
		};
	}
}
