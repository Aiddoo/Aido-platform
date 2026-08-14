import { Injectable } from "@nestjs/common";

import { TodoCategoryReader } from "@/todo-category";

import type { CategoryOwnershipPort } from "../../application/ports/category-ownership.port";

/**
 * 카테고리 소유권 포트 어댑터 — TodoCategoryReader에 위임
 */
@Injectable()
export class CategoryOwnershipAdapter implements CategoryOwnershipPort {
	constructor(private readonly todoCategoryReader: TodoCategoryReader) {}

	async validateOwnership(categoryId: number, userId: string): Promise<void> {
		await this.todoCategoryReader.validateOwnership(categoryId, userId);
	}
}
