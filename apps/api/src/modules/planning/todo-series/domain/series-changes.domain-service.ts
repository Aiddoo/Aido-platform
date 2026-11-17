import type { TodoVisibility } from "@aido/api/vocabulary";

import type { TodoTitle } from "../../shared/domain/todo-title.vo.js";
import type { ChecklistTemplateItem } from "./checklist-template.vo.js";
import type { RepeatRule } from "./repeat-rule.vo.js";

export interface TodoSeriesChanges {
  readonly title?: string;
  readonly categoryId?: number;
  readonly visibility?: TodoVisibility;
  readonly scheduledLocalTime?: string | null;
  /** 사용자가 시간을 고칠 때만 넘긴다. 그 시각은 이 시간대의 벽시계다. */
  readonly timezone?: string;
  readonly checklistTemplate?: readonly ChecklistTemplateItem[];
  readonly rule?: RepeatRule;
}

export type TodoSeriesDetailChanges = Omit<TodoSeriesChanges, "rule" | "checklistTemplate">;

export interface TodoSeriesDetails {
  readonly title: TodoTitle;
  readonly categoryId: number;
  readonly visibility: TodoVisibility;
  readonly scheduledLocalTime: string | null;
  readonly timezone: string;
}

/** target에 맞추려면 current에서 바꿔야 할 값만 돌려준다. 같은 값은 비워 회차별로 고친 내용을 덮지 않는다. */
export function changesToMatch(
  current: TodoSeriesDetails,
  target: TodoSeriesDetails,
): TodoSeriesDetailChanges {
  const { title, categoryId, visibility, scheduledLocalTime, timezone } = target;
  const isTimeSame =
    scheduledLocalTime === current.scheduledLocalTime &&
    (scheduledLocalTime == null || timezone === current.timezone);
  return {
    title: title.equals(current.title) ? undefined : title.value,
    categoryId: categoryId === current.categoryId ? undefined : categoryId,
    visibility: visibility === current.visibility ? undefined : visibility,
    scheduledLocalTime: isTimeSame ? undefined : scheduledLocalTime,
    timezone: isTimeSame || scheduledLocalTime == null ? undefined : timezone,
  };
}
