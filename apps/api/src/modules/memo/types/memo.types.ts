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

export type { TransactionClient };
