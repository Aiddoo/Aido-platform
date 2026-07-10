import { Injectable } from "@nestjs/common";
import { TodoCategoryService } from "../../../todo-category/todo-category.service";
import type { CategoryOwnershipPort } from "../../application/ports/category-ownership.port";

/**
 * 카테고리 소유권 포트 어댑터 — TodoCategoryService에 위임
 */
@Injectable()
export class CategoryOwnershipAdapter implements CategoryOwnershipPort {
	constructor(private readonly todoCategoryService: TodoCategoryService) {}

	async validateOwnership(categoryId: number, userId: string): Promise<void> {
		await this.todoCategoryService.validateOwnership(categoryId, userId);
	}
}
