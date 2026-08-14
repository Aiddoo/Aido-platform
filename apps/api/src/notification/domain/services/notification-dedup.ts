import { TIME_UNIT } from "@/shared/domain/date/constants/date.constant";

import type { NotificationType } from "../types/notification-type";

/**
 * 알림 서비스 레이어 중복 방지 정책 (순수 도메인).
 *
 * - DB partial unique index로 보호되는 타입(DAILY_COMPLETE 등): 전략 없음 → 직접 생성
 * - 쿨다운으로 이미 보호되는 타입(NUDGE/CHEER): 전략 없음
 * - FOLLOW_*: 24시간 윈도우 + friendId 컨텍스트로 서비스 레이어 dedup
 */

/** dedup 전략: 윈도우(ms) + 비교에 사용할 컨텍스트 키 */
export interface DedupStrategy {
	windowMs: number;
	keys: Array<"friendId" | "todoId" | "nudgeId" | "cheerId">;
}

/** dedup 판정에 필요한 알림 컨텍스트 */
export interface DedupContext {
	userId: string;
	type: NotificationType;
	friendId?: string | null;
	todoId?: number | null;
	nudgeId?: number | null;
	cheerId?: number | null;
}

/** 컨텍스트 키별로 추출된 값 (existsRecentNotification 조회 파라미터) */
export interface DedupContextFields {
	friendId?: string;
	todoId?: number;
	nudgeId?: number;
	cheerId?: number;
}

const DEDUP_WINDOW = {
	FOLLOW: 24 * TIME_UNIT.MS_PER_HOUR, // 24시간
} as const;

const DEDUP_STRATEGIES: Partial<Record<NotificationType, DedupStrategy>> = {
	FOLLOW_NEW: { windowMs: DEDUP_WINDOW.FOLLOW, keys: ["friendId"] },
	FOLLOW_ACCEPTED: { windowMs: DEDUP_WINDOW.FOLLOW, keys: ["friendId"] },
};

/** dedup 잠금 TTL (밀리초) — DB 조회 + 생성에 충분한 시간 */
export const DEDUP_LOCK_TTL = 5_000;

/** 타입별 dedup 전략 조회 (없으면 서비스 레이어 dedup 미적용) */
export function resolveDedupStrategy(type: NotificationType): DedupStrategy | undefined {
	return DEDUP_STRATEGIES[type];
}

/** 중복 방지 잠금 키 생성 */
export function buildDedupKey(data: DedupContext, strategy: DedupStrategy): string {
	const parts = ["dedup", data.userId, data.type];
	for (const key of strategy.keys) {
		const value = data[key];
		if (value != null) {
			parts.push(`${key}:${String(value)}`);
		}
	}
	return parts.join(":");
}

/** 전략 키에 해당하는 컨텍스트 값만 추출 */
export function buildDedupContextFields(
	data: DedupContext,
	strategy: DedupStrategy,
): DedupContextFields {
	const fields: DedupContextFields = {};
	for (const key of strategy.keys) {
		switch (key) {
			case "friendId":
				if (data.friendId != null) {
					fields.friendId = data.friendId;
				}
				break;
			case "todoId":
				if (data.todoId != null) {
					fields.todoId = data.todoId;
				}
				break;
			case "nudgeId":
				if (data.nudgeId != null) {
					fields.nudgeId = data.nudgeId;
				}
				break;
			case "cheerId":
				if (data.cheerId != null) {
					fields.cheerId = data.cheerId;
				}
				break;
		}
	}
	return fields;
}
