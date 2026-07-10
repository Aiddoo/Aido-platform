import { TIME_UNIT } from "../constants/date.constant";
import { addMilliseconds } from "./arithmetic";
import { now } from "./core";

export interface CooldownResult {
	/** 쿨다운이 현재 활성 상태인지 */
	isActive: boolean;
	/** 남은 시간 (초 단위, 올림) */
	remainingSeconds: number;
	/** 쿨다운 종료 시각 (비활성이면 null) */
	endsAt: Date | null;
}

/**
 * 마지막 액션 시각으로부터 쿨다운 상태를 계산
 *
 * @param lastActionTime - 마지막 액션 시각 (null이면 쿨다운 없음)
 * @param cooldownHours - 쿨다운 시간 (시 단위)
 */
export function calculateCooldown(
	lastActionTime: Date | null | undefined,
	cooldownHours: number,
): CooldownResult {
	if (!lastActionTime) {
		return { isActive: false, remainingSeconds: 0, endsAt: null };
	}

	const cooldownMs = cooldownHours * TIME_UNIT.MS_PER_HOUR;
	const endsAt = addMilliseconds(cooldownMs, lastActionTime);
	const currentTime = now();

	if (currentTime >= endsAt) {
		return { isActive: false, remainingSeconds: 0, endsAt: null };
	}

	const remainingMs = endsAt.getTime() - currentTime.getTime();
	return {
		isActive: true,
		remainingSeconds: Math.ceil(remainingMs / TIME_UNIT.MS_PER_SECOND),
		endsAt,
	};
}
