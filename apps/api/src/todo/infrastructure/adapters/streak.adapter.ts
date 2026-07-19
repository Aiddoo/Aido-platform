import { Injectable } from "@nestjs/common";
import { UserSettingsFacade } from "@/user-settings";
import type { StreakPort } from "../../application/ports/streak.port";

/**
 * 스트릭 포트 어댑터 — UserSettingsFacade에 위임
 */
@Injectable()
export class StreakAdapter implements StreakPort {
	constructor(private readonly userSettingsFacade: UserSettingsFacade) {}

	async recordTodoToggle(
		userId: string,
		completed: boolean,
		timezone: string,
	): Promise<void> {
		await this.userSettingsFacade.onTodoToggled(userId, completed, timezone);
	}

	async getStreakContext(userId: string): Promise<{
		currentStreak: number;
		lastCompletedDate: Date | null;
	}> {
		const record = await this.userSettingsFacade.getPreferenceRecord(userId);
		return {
			currentStreak: record?.currentStreak ?? 0,
			lastCompletedDate: record?.lastCompletedDate ?? null,
		};
	}
}
