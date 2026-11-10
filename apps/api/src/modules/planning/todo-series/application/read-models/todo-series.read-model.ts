import type { TodoVisibility } from "@aido/api/vocabulary";

import { toIsoString } from "#api/shared/domain/time/instant";

import type { RepeatSpec } from "../../domain/repeat-rule.vo.js";
import type { ChecklistTemplateItem, TodoSeries } from "../../domain/todo-series.aggregate.js";

export interface TodoSeriesReadModel {
  readonly id: string;
  readonly title: string;
  readonly categoryId: number;
  readonly visibility: TodoVisibility;
  readonly scheduledLocalTime: string | null;
  readonly timezone: string;
  readonly repeat: RepeatSpec;
  readonly startDate: string;
  readonly nextOccurrenceDate: string | null;
  readonly isActive: boolean;
  readonly checklist: readonly ChecklistTemplateItem[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export function toTodoSeriesReadModel(series: TodoSeries): TodoSeriesReadModel {
  return {
    id: series.id.value,
    title: series.title.value,
    categoryId: series.categoryId,
    visibility: series.visibility,
    scheduledLocalTime: series.scheduledLocalTime,
    timezone: series.timezone,
    repeat: series.rule.toSpec(),
    startDate: series.startDate,
    nextOccurrenceDate: series.nextOccurrenceDate,
    isActive: series.isActive,
    checklist: series.checklistTemplate,
    createdAt: toIsoString(series.createdAt),
    updatedAt: toIsoString(series.updatedAt),
  };
}
