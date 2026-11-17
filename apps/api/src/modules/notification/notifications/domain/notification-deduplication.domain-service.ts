import type { NotificationType } from "../../shared/domain/notification-type.constants.js";

/**
 * 알림 서비스 레이어 중복 방지 정책 (순수 도메인).
 *
 * - DB partial unique index로 보호되는 타입(DAILY_COMPLETE 등): 전략 없음 → 직접 생성
 * - 쿨다운으로 이미 보호되는 타입(NUDGE/CHEER): 전략 없음
 * - FOLLOW_*: 24시간 윈도우 + friendId 컨텍스트로 서비스 레이어 dedup
 */

/** dedup 전략: 윈도우(ms) + 비교에 사용할 컨텍스트 키 */
export interface DeduplicationStrategy {
  windowMs: number;
  keys: Array<"friendId" | "todoId">;
}

/** dedup 판정에 필요한 알림 컨텍스트 */
export interface DeduplicationContext {
  userId: string;
  type: NotificationType;
  friendId?: string | null;
  todoId?: number | null;
}

/** 컨텍스트 키별로 추출된 값 (existsRecentNotification 조회 파라미터) */
export interface DeduplicationContextFields {
  friendId?: string;
  todoId?: number;
}

const DEDUPLICATION_WINDOW = {
  FOLLOW: 24 * 60 * 60_000, // 24시간
} as const;

const DEDUPLICATION_STRATEGIES: Partial<Record<NotificationType, DeduplicationStrategy>> = {
  FOLLOW_NEW: { windowMs: DEDUPLICATION_WINDOW.FOLLOW, keys: ["friendId"] },
  FOLLOW_ACCEPTED: { windowMs: DEDUPLICATION_WINDOW.FOLLOW, keys: ["friendId"] },
};

/** 타입별 dedup 전략 조회 (없으면 서비스 레이어 dedup 미적용) */
export function resolveDeduplicationStrategy(
  type: NotificationType,
): DeduplicationStrategy | undefined {
  return DEDUPLICATION_STRATEGIES[type];
}

/** 중복 방지 잠금 키 생성 */
export function buildDeduplicationKey(
  data: DeduplicationContext,
  strategy: DeduplicationStrategy,
): string {
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
export function buildDeduplicationContextFields(
  data: DeduplicationContext,
  strategy: DeduplicationStrategy,
): DeduplicationContextFields {
  const fields: DeduplicationContextFields = {};
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
    }
  }
  return fields;
}
