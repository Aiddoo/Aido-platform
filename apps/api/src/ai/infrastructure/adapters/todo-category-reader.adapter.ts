import { Injectable } from "@nestjs/common";

import { TodoCategoryReader } from "@/todo-category";

import type {
	UserCategory,
	UserCategoryReaderPort,
} from "../../application/ports/user-category-reader.port";

/**
 * UserCategoryReaderPort의 어댑터.
 *
 * todo-category 파사드에 위임하여 프롬프트용 최소 카테고리 정보만 노출한다.
 */
@Injectable()
export class TodoCategoryReaderAdapter implements UserCategoryReaderPort {
	constructor(private readonly todoCategoryReader: TodoCategoryReader) {}

	async findByUserId(userId: string): Promise<UserCategory[]> {
		const categories = await this.todoCategoryReader.listForUser(userId);
		return categories.map((c) => ({ id: c.id, name: c.name }));
	}
}
