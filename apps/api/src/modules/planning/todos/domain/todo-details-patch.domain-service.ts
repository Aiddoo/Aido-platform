import type { TodoVisibility } from "@aido/api/vocabulary";
import { isUndefined, omitBy, pick } from "es-toolkit";

import { TodoTitle } from "../../shared/domain/todo-title.vo.js";
import type { TodoCategoryId } from "../../todo-categories/domain/todo-category-id.vo.js";
import type { TodoSchedule, TodoSchedulePatch } from "./todo-schedule.vo.js";

export interface TodoDetailsPatch {
  readonly title?: string;
  readonly categoryId?: TodoCategoryId;
  readonly startDate?: Temporal.PlainDate;
  readonly endDate?: Temporal.PlainDate | null;
  readonly scheduledLocalTime?: string | null;
  readonly isAllDay?: boolean;
  readonly visibility?: TodoVisibility;
  readonly completed?: boolean;
}

export interface TodoDetails {
  readonly title: TodoTitle;
  readonly categoryId: TodoCategoryId;
  readonly schedule: TodoSchedule;
  readonly visibility: TodoVisibility;
}

// 제목·일정을 모두 검증한 새 값이다. 보내지 않은 칸은 지금 값 그대로다
export function patchTodoDetails(
  current: TodoDetails,
  patch: TodoDetailsPatch,
  timezone: string,
): TodoDetails {
  const schedulePatch = toSchedulePatch(patch);
  return {
    title: patch.title == null ? current.title : TodoTitle.create(patch.title),
    categoryId: patch.categoryId ?? current.categoryId,
    schedule:
      Object.keys(schedulePatch).length > 0
        ? current.schedule.patch(schedulePatch, timezone)
        : current.schedule,
    visibility: patch.visibility ?? current.visibility,
  };
}

export function isSameTodoDetails(left: TodoDetails, right: TodoDetails): boolean {
  return (
    left.title.equals(right.title) &&
    left.categoryId.equals(right.categoryId) &&
    left.schedule.equals(right.schedule) &&
    left.visibility === right.visibility
  );
}

// null은 지우기라 남기고 보내지 않은 칸(undefined)만 뺀다
function toSchedulePatch(patch: TodoDetailsPatch): TodoSchedulePatch {
  return omitBy(
    pick(patch, ["startDate", "endDate", "scheduledLocalTime", "isAllDay"]),
    isUndefined,
  );
}

export function isSameInstant(
  left: Temporal.Instant | null,
  right: Temporal.Instant | null,
): boolean {
  return left == null || right == null ? left === right : left.equals(right);
}
