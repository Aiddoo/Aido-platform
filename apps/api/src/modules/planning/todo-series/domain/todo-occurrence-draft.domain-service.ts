import type { TodoVisibility } from "@aido/api/vocabulary";

import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { resolveScheduledInstant } from "../../shared/domain/todo-calendar.domain-service.js";
import type { TodoTitle } from "../../shared/domain/todo-title.vo.js";

/** 회차 한 행의 초안. id는 저장소 nextIds, sortOrder는 저장 직전 사용자 최대값 뒤로 붙인다. */
export interface TodoOccurrenceDraft {
  readonly userId: string;
  readonly categoryId: number;
  readonly title: string;
  readonly visibility: TodoVisibility;
  readonly startDate: Temporal.PlainDate;
  readonly endDate: null;
  readonly scheduledLocalTime: string | null;
  readonly scheduledTime: Temporal.Instant | null;
  readonly isAllDay: boolean;
  readonly occurrenceDate: Temporal.PlainDate;
  readonly createdAt: Temporal.Instant;
}

export interface OccurrenceSource {
  readonly userId: UserId;
  readonly categoryId: number;
  readonly title: TodoTitle;
  readonly visibility: TodoVisibility;
  readonly scheduledLocalTime: string | null;
  readonly timezone: string;
  readonly createdAt: Temporal.Instant;
}

export function draftOccurrence(
  source: OccurrenceSource,
  date: Temporal.PlainDate,
): TodoOccurrenceDraft {
  const { userId, categoryId, title, scheduledLocalTime, timezone, visibility } = source;
  return {
    userId: userId.value,
    categoryId,
    title: title.value,
    visibility,
    startDate: date,
    endDate: null,
    scheduledLocalTime,
    // DST로 오프셋이 달라지므로 회차 날짜마다 규칙 시간대로 다시 해석한다.
    scheduledTime: resolveScheduledInstant(date.toString(), scheduledLocalTime, timezone),
    isAllDay: scheduledLocalTime == null,
    occurrenceDate: date,
    // 리텐션·성장 지표가 createdAt을 사용자 행동으로 쓰므로 규칙을 만든 시각을 물려받는다.
    createdAt: source.createdAt,
  };
}
