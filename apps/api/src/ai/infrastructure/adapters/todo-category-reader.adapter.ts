import { Injectable } from "@nestjs/common";
import { TodoCategoryRepository } from "../../../todo-category/todo-category.repository";
import type {
	UserCategory,
	UserCategoryReaderPort,
} from "../../application/ports/user-category-reader.port";

/**
 * UserCategoryReaderPort의 어댑터.
 *
 * todo-category 모듈의 저장소에 위임하여 프롬프트용 최소 카테고리 정보만 노출한다
 * (미이관 의존 → 위임 어댑터 패턴). todo-category 클린아키 이관 시 내부만 교체.
 */
@Injectable()
export class TodoCategoryReaderAdapter implements UserCategoryReaderPort {
	constructor(
		private readonly todoCategoryRepository: TodoCategoryRepository,
	) {}

	async findByUserId(userId: string): Promise<UserCategory[]> {
		const categories =
			await this.todoCategoryRepository.findManyByUserId(userId);
		return categories.map((c) => ({ id: c.id, name: c.name }));
	}
}
