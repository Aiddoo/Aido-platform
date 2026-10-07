import type { DayOfWeek, Todo as TodoResponse } from "@aido/api";

import type { AfterCommitTask } from "#api/shared/application/ports/index";

export const STAGED_TODO_CREATOR = Symbol("STAGED_TODO_CREATOR");

export interface CreateTodoData {
  readonly userId: string;
  readonly title: string;
  readonly categoryId: number;
  readonly startDate: Date;
  readonly endDate?: Date | null;
  readonly scheduledTime?: Date | null;
  readonly isAllDay?: boolean;
  readonly visibility?: "PUBLIC" | "PRIVATE";
  readonly items?: { title: string }[];
}

export interface CreateRecurringTodoData {
  readonly userId: string;
  readonly title: string;
  readonly categoryId: number;
  readonly startDate: string;
  readonly endDate: string;
  readonly daysOfWeek: DayOfWeek[];
  readonly scheduledTime?: string | null;
  readonly isAllDay?: boolean;
  readonly visibility?: "PUBLIC" | "PRIVATE";
  readonly items?: { title: string }[];
}

export interface StagedTodoCreation {
  readonly todos: readonly TodoResponse[];
  readonly afterCommit: AfterCommitTask;
}

export interface StagedTodoCreatorPort {
  stageTodo(data: CreateTodoData): Promise<StagedTodoCreation>;
  stageRecurringTodos(data: CreateRecurringTodoData, timezone: string): Promise<StagedTodoCreation>;
}
