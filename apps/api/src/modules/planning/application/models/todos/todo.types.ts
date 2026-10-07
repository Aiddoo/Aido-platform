import type { DayOfWeek } from "@aido/api/vocabulary";

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

export interface UpdateTodoData {
  readonly title?: string;
  readonly categoryId?: number;
  readonly startDate?: Date;
  readonly endDate?: Date | null;
  readonly scheduledTime?: string | null;
  readonly isAllDay?: boolean;
  readonly visibility?: "PUBLIC" | "PRIVATE";
  readonly completed?: boolean;
}

export interface GetTodosParams {
  readonly userId: string;
  readonly cursor?: number;
  readonly size?: number;
  readonly completed?: boolean;
  readonly categoryId?: number;
  readonly startDate?: Date;
  readonly endDate?: Date;
}

export interface GetFriendTodosParams {
  readonly userId: string;
  readonly friendUserId: string;
  readonly cursor?: number;
  readonly size?: number;
  readonly startDate?: Date;
  readonly endDate?: Date;
}

export interface FindTodosParams {
  readonly userId: string;
  readonly cursor?: number;
  readonly size: number;
  readonly completed?: boolean;
  readonly categoryId?: number;
  readonly startDate?: Date;
  readonly endDate?: Date;
}

export interface FindFriendTodosParams {
  readonly friendUserId: string;
  readonly cursor?: number;
  readonly size: number;
  readonly startDate?: Date;
  readonly endDate?: Date;
}
