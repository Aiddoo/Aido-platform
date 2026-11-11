import type { TodoVisibility } from "@aido/api/vocabulary";

import type { RepeatSpec } from "../../../todo-series/domain/repeat-rule.vo.js";

// 시각은 toIsoString 문자열, 날짜는 YYYY-MM-DD다. 친구 첫 페이지 캐시에 그대로 담으므로 JSON 값만 둔다

interface TodoItemReadModel {
  readonly id: number;
  readonly title: string;
  readonly completed: boolean;
  readonly sortOrder: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface TodoCategoryReadModel {
  readonly id: number;
  readonly name: string;
  readonly color: string;
  readonly sortOrder: number;
}

/** 친구에게도 보이는 할 일 */
export interface FriendTodoReadModel {
  readonly id: number;
  readonly userId: string;
  readonly title: string;
  readonly sortOrder: number;
  readonly completed: boolean;
  readonly completedAt: string | null;
  readonly startDate: string;
  readonly endDate: string | null;
  readonly scheduledTime: string | null;
  /** 옛 서버가 시간을 지운 행은 칸이 낡았을 수 있어 순간이 없으면 null이다. */
  readonly scheduledLocalTime: string | null;
  readonly isAllDay: boolean;
  readonly visibility: TodoVisibility;
  readonly seriesId: string | null;
  readonly category: TodoCategoryReadModel;
  readonly items: readonly TodoItemReadModel[];
  readonly commentCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** 주인이 보는 할 일. 반복 회차면 규칙과 원래 회차 날짜를 함께 담는다. */
export interface TodoReadModel extends FriendTodoReadModel {
  readonly repeat: RepeatSpec | null;
  readonly occurrenceDate: string | null;
}
