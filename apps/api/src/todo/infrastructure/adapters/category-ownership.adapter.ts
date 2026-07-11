import { Injectable } from "@nestjs/common";
import { TodoCategoryFacade } from "@/todo-category";
import type { CategoryOwnershipPort } from "../../application/ports/category-ownership.port";

/**
 * 카테고리 소유권 포트 어댑터 — TodoCategoryFacade에 위임
 */
@Injectable()
export class CategoryOwnershipAdapter implements CategoryOwnershipPort {
	constructor(private readonly todoCategoryFacade: TodoCategoryFacade) {}

	async validateOwnership(categoryId: number, userId: string): Promise<void> {
		await this.todoCategoryFacade.validateOwnership(categoryId, userId);
	}
}
