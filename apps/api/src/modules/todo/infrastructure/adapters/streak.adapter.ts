import { Injectable } from "@nestjs/common";
import { StreakService } from "../../../user-settings/services/streak.service";
import type { StreakPort } from "../../application/ports/streak.port";

/**
 * 스트릭 포트 어댑터 — StreakService에 위임
 */
@Injectable()
export class StreakAdapter implements StreakPort {
	constructor(private readonly streakService: StreakService) {}

	onTodoToggled(userId: string, completed: boolean, timezone: string): void {
		this.streakService.onTodoToggled(userId, completed, timezone);
	}
}
