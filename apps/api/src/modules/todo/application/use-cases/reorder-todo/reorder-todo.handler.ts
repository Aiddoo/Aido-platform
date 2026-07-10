import { ErrorCode } from "@aido/errors";
import type { Todo as TodoResponse } from "@aido/validators";
import { Inject, Logger } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { UNIT_OF_WORK, type UnitOfWorkPort } from "@/common/database";
import { ApplicationException } from "@/common/domain";
import {
	planReorderRelativeTo,
	planReorderToEdge,
	type ReorderPlan,
} from "../../../domain/services/reorder-position";
import {
	TODO_REPOSITORY,
	type TodoRepositoryPort,
} from "../../ports/todo.repository.port";
import {
	TODO_READ_REPOSITORY,
	type TodoReadRepositoryPort,
} from "../../ports/todo-read.repository.port";
import { ReorderTodoCommand } from "./reorder-todo.command";

/**
 * Todo 순서 변경 핸들러 (드래그 앤 드롭)
 *
 * 전체 트랜잭션 안에서: 소유권 확인 → 도메인 정책(planReorderRelativeTo /
 * planReorderToEdge)으로 시프트 계획 계산 → 시프트·sortOrder 영속화 →
 * 커밋 후 읽기 포트로 응답 재조회.
 * targetTodoId가 자기 자신이면 쓰기 없이 현재 상태를 반환합니다.
 */
@CommandHandler(ReorderTodoCommand)
export class ReorderTodoHandler implements ICommandHandler<ReorderTodoCommand> {
	readonly #logger = new Logger(ReorderTodoHandler.name);

	constructor(
		@Inject(TODO_REPOSITORY)
		private readonly todoRepository: TodoRepositoryPort,
		@Inject(TODO_READ_REPOSITORY)
		private readonly todoReadRepository: TodoReadRepositoryPort,
		@Inject(UNIT_OF_WORK)
		private readonly uow: UnitOfWorkPort,
	) {}

	async execute(command: ReorderTodoCommand): Promise<TodoResponse> {
		const { id, userId, targetTodoId, position } = command;

		// 1. 트랜잭션 안에서 소유권 확인 → 새 sortOrder 계산·시프트 → 영속화
		await this.uow.run(async () => {
			const todo = await this.todoRepository.findByIdAndUserId(id, userId);
			if (!todo) {
				throw new ApplicationException(ErrorCode.TODO_0801, { todoId: id });
			}

			// 자기 자신을 기준으로 지정하면 이동 없음
			if (targetTodoId === id) {
				return;
			}

			let plan: ReorderPlan;
			if (targetTodoId) {
				const targetTodo = await this.todoRepository.findByIdAndUserId(
					targetTodoId,
					userId,
				);
				if (!targetTodo) {
					throw new ApplicationException(ErrorCode.TODO_0810, {
						targetTodoId,
					});
				}
				plan = planReorderRelativeTo(
					todo.getSortOrder(),
					targetTodo.getSortOrder(),
					position,
				);
			} else {
				const maxSortOrder = await this.todoRepository.getMaxSortOrder(userId);
				plan = planReorderToEdge(todo.getSortOrder(), position, maxSortOrder);
			}

			await this.todoRepository.shiftSortOrders(
				userId,
				plan.shift.from,
				plan.shift.to,
				plan.shift.delta,
			);
			await this.todoRepository.updateSortOrder(id, plan.newSortOrder);

			this.#logger.log(
				`Todo reordered: ${id} to sortOrder ${plan.newSortOrder} for user: ${userId}`,
			);
		});

		// 2. 응답 재조회
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
