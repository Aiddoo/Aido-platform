import { TODO_LIMITS } from "@aido/validators";
import { Inject, Injectable } from "@nestjs/common";
import {
	TODO_READ_REPOSITORY,
	type TodoReadRepositoryPort,
} from "../../ports/todo-read.repository.port";

/** 카테고리당 활성 Todo 리소스 제한 조회 결과 — use-case가 계약(반환 타입)을 소유합니다 */
export interface TodoResourceLimitResult {
	activeCount?: number;
	maxPerCategory: number;
}

/** 카테고리당 활성 Todo 리소스 제한 정보 조회 입력. */
export interface GetTodoResourceLimitInput {
	userId: string;
	categoryId?: number;
}

/**
 * 카테고리당 활성 Todo 리소스 제한 정보 조회 use-case
 */
@Injectable()
export class GetTodoResourceLimitUseCase {
	constructor(
		@Inject(TODO_READ_REPOSITORY)
		private readonly todoReadRepository: TodoReadRepositoryPort,
	) {}

	async execute(
		input: GetTodoResourceLimitInput,
	): Promise<TodoResourceLimitResult> {
		if (input.categoryId) {
			const activeCount = await this.todoReadRepository.countActiveByCategory(
				input.userId,
				input.categoryId,
			);
			return { activeCount, maxPerCategory: TODO_LIMITS.MAX_PER_CATEGORY };
		}
		return { maxPerCategory: TODO_LIMITS.MAX_PER_CATEGORY };
	}
}
