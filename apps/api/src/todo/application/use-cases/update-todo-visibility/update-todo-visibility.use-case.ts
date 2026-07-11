import { ErrorCode } from "@aido/errors";
import type { Todo as TodoResponse } from "@aido/validators";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { UNIT_OF_WORK, type UnitOfWorkPort } from "@/shared/application/ports";
import { ApplicationException } from "@/shared/domain";
import type { TodoVisibility } from "../../../domain/entities/todo.entity";
import {
	TODO_REPOSITORY,
	type TodoRepositoryPort,
} from "../../ports/todo.repository.port";
import {
	TODO_READ_REPOSITORY,
	type TodoReadRepositoryPort,
} from "../../ports/todo-read.repository.port";

/** Todo 공개 범위 변경 입력. */
export interface UpdateTodoVisibilityInput {
	id: number;
	userId: string;
	visibility: TodoVisibility;
}

/**
 * Todo 공개 범위 변경 use-case
 *
 * 소유권 확인 → 애그리게잇 전이 → 애그리게잇 상태로 영속화 → 읽기 포트로 응답 재조회.
 * 부수효과 없음(레거시 동작 보존).
 */
@Injectable()
export class UpdateTodoVisibilityUseCase {
	readonly #logger = new Logger(UpdateTodoVisibilityUseCase.name);

	constructor(
		@Inject(TODO_REPOSITORY)
		private readonly todoRepository: TodoRepositoryPort,
		@Inject(TODO_READ_REPOSITORY)
		private readonly todoReadRepository: TodoReadRepositoryPort,
		@Inject(UNIT_OF_WORK)
		private readonly uow: UnitOfWorkPort,
	) {}

	async execute(input: UpdateTodoVisibilityInput): Promise<TodoResponse> {
		const { id, userId, visibility } = input;

		// TX 안에서 로드 → 애그리게잇 전이 → 애그리게잇 상태로 영속화
		await this.uow.run(async () => {
			const todo = await this.todoRepository.findByIdAndUserId(id, userId);
			if (!todo) {
				throw new ApplicationException(ErrorCode.TODO_0801, { todoId: id });
			}

			todo.changeVisibility(visibility);
			await this.todoRepository.updateVisibility(
				id,
				todo.toPersistence().visibility,
			);
		});

		this.#logger.log(
			`Todo visibility updated: ${id} -> ${visibility} for user: ${userId}`,
		);

		// 응답 재조회
		const response = await this.todoReadRepository.findByIdAndUserId(
			id,
			userId,
		);
		if (!response) {
			throw new ApplicationException(ErrorCode.TODO_0801, { todoId: id });
		}
		return response;
	}
}
