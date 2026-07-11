import { CHEER_LIMITS } from "@aido/validators";

import { calculateCooldown } from "@/shared/domain/date/utils/cooldown";

export interface CheerCooldown {
	isActive: boolean;
	remainingSeconds: number;
	canCheerAt: Date | null;
}

/**
 * cheer-cooldown — 응원 쿨다운 순수 도메인 서비스.
 *
 * 마지막 응원 시각으로부터 CHEER_LIMITS.COOLDOWN_HOURS 동안 재응원을 제한하는 정책을 계산한다.
 */
export function evaluateCheerCooldown(
	lastCheerTime: Date | null,
): CheerCooldown {
	const { isActive, remainingSeconds, endsAt } = calculateCooldown(
		lastCheerTime,
		CHEER_LIMITS.COOLDOWN_HOURS,
	);
	return { isActive, remainingSeconds, canCheerAt: endsAt };
}
