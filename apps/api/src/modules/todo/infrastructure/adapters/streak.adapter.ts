import { Injectable } from "@nestjs/common";
import { StreakService } from "../../../user-settings/services/streak.service";
import type { StreakPort } from "../../application/ports/streak.port";

/**
 * 스트릭 포트 어댑터 — StreakService에 위임
 */
@Injectable()
export class StreakAdapter implements StreakPort {
	constructor(private readonly streakService: StreakService) {}

	recordTodoToggle(userId: string, completed: boolean, timezone: string): void {
		// user-settings 모듈의 기존 메서드명(onTodoToggled)은 그대로 두고 위임만 담당
		this.streakService.onTodoToggled(userId, completed, timezone);
	}
}
