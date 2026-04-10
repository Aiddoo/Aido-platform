import type { DayOfWeek } from "@aido/validators";
import type { TransactionClient } from "@/common/database";

export interface CreateMemoData {
	userId: string;
	content: string;
}

export interface UpdateMemoData {
	content: string;
}

export interface FindMemosParams {
	userId: string;
	cursor?: number;
	size: number;
}

export interface ConvertMemoToTodoData {
	categoryId: number;
	startDate: Date;
	endDate?: Date | null;
	scheduledTime?: Date | null;
	isAllDay?: boolean;
	visibility?: "PUBLIC" | "PRIVATE";
	items?: { title: string }[];
}

export interface ConvertMemoToSingleTodoData {
	title: string;
	categoryId: number;
	startDate: Date;
	endDate?: Date | null;
	scheduledTime?: Date | null;
	isAllDay?: boolean;
	visibility?: "PUBLIC" | "PRIVATE";
	isRecurring?: boolean;
	recurrence?: {
		daysOfWeek: DayOfWeek[];
		endDate: Date;
	};
	items?: { title: string }[];
}

export interface ConvertMemoToTodosData {
	todos: ConvertMemoToSingleTodoData[];
}

export type { TransactionClient };
