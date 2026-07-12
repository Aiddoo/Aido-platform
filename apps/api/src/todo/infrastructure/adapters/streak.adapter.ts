import { Injectable } from "@nestjs/common";
import { UserSettingsFacade } from "@/user-settings";
import type { StreakPort } from "../../application/ports/streak.port";

/**
 * 스트릭 포트 어댑터 — UserSettingsFacade에 위임
 */
@Injectable()
export class StreakAdapter implements StreakPort {
	constructor(private readonly userSettingsFacade: UserSettingsFacade) {}

	recordTodoToggle(userId: string, completed: boolean, timezone: string): void {
		// user-settings 파사드로 위임(fire-and-forget)
		void this.userSettingsFacade.onTodoToggled(userId, completed, timezone);
	}

	async getCurrentStreak(userId: string): Promise<number> {
		const record = await this.userSettingsFacade.getPreferenceRecord(userId);
		return record?.currentStreak ?? 0;
	}
}
