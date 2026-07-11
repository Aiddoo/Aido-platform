import { NUDGE_LIMITS, REMIND_NUDGE_LIMITS } from "@aido/validators";

import { calculateCooldown } from "@/shared/domain/date/utils/cooldown";

export interface NudgeCooldown {
	isActive: boolean;
	remainingSeconds: number;
	cooldownEndsAt: Date | null;
}

/**
 * nudge-cooldown — 콕 찌르기 쿨다운 순수 도메인 서비스.
 *
 * 콕 찌르기는 동일 할 일 단위로 NUDGE_LIMITS.COOLDOWN_HOURS(24h),
 * 리마인드 콕 찌르기는 동일 친구 단위로 REMIND_NUDGE_LIMITS.COOLDOWN_HOURS(1h) 동안 재전송을 제한한다.
 */
export function evaluateNudgeCooldown(
	lastNudgeTime: Date | null,
): NudgeCooldown {
	const { isActive, remainingSeconds, endsAt } = calculateCooldown(
		lastNudgeTime,
		NUDGE_LIMITS.COOLDOWN_HOURS,
	);
	return { isActive, remainingSeconds, cooldownEndsAt: endsAt };
}

export function evaluateRemindNudgeCooldown(
	lastNudgeTime: Date | null,
): NudgeCooldown {
	const { isActive, remainingSeconds, endsAt } = calculateCooldown(
		lastNudgeTime,
		REMIND_NUDGE_LIMITS.COOLDOWN_HOURS,
	);
	return { isActive, remainingSeconds, cooldownEndsAt: endsAt };
}
