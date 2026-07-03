import { ErrorCode } from "@aido/errors";
import type { ReorderPosition, Todo as TodoResponse } from "@aido/validators";
import { Inject, Logger } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { TransactionClient } from "@/common/database";
import {
	TRANSACTION_MANAGER,
	type TransactionManagerPort,
} from "@/common/database";
import { ApplicationException } from "@/common/domain";
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
 * 전체 트랜잭션 안에서: 소유권 확인 → 기준 할 일 상대 이동(#reorderRelativeTo)
 * 또는 맨 앞/뒤 이동(#reorderToEdge)으로 새 sortOrder 계산·범위 시프트 →
 * sortOrder 영속화 → 커밋 후 읽기 포트로 응답 재조회.
 * targetTodoId가 자기 자신이면 쓰기 없이 현재 상태를 반환합니다.
 */
@CommandHandler(ReorderTodoCommand)
export class ReorderTodoHandler
	implements ICommandHandler<ReorderTodoCommand, TodoResponse>
{
	readonly #logger = new Logger(ReorderTodoHandler.name);

	constructor(
		@Inject(TODO_REPOSITORY)
		private readonly todoRepository: TodoRepositoryPort,
		@Inject(TODO_READ_REPOSITORY)
		private readonly todoReadRepository: TodoReadRepositoryPort,
		@Inject(TRANSACTION_MANAGER)
		private readonly txManager: TransactionManagerPort,
	) {}

	async execute(command: ReorderTodoCommand): Promise<TodoResponse> {
		const { id, userId, targetTodoId, position } = command;

		// 1. 트랜잭션 안에서 소유권 확인 → 새 sortOrder 계산·시프트 → 영속화
		await this.txManager.run(async (tx) => {
			const todo = await this.todoRepository.findByIdAndUserId(id, userId, tx);
			if (!todo) {
				throw new ApplicationException(ErrorCode.TODO_0801, { todoId: id });
			}

			// 자기 자신을 기준으로 지정하면 이동 없음
			if (targetTodoId === id) {
				return;
			}

			const newSortOrder = targetTodoId
				? await this.#reorderRelativeTo(
						todo.getSortOrder(),
						targetTodoId,
						position,
						userId,
						tx,
					)
				: await this.#reorderToEdge(todo.getSortOrder(), position, userId, tx);

			await this.todoRepository.updateSortOrder(id, newSortOrder, tx);

			this.#logger.log(
				`Todo reordered: ${id} to sortOrder ${newSortOrder} for user: ${userId}`,
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

	/** 기준 할 일의 앞/뒤로 이동 — 사이 구간을 한 칸씩 시프트 */
	async #reorderRelativeTo(
		currentSortOrder: number,
		targetTodoId: number,
		position: ReorderPosition,
		userId: string,
		tx: TransactionClient,
	): Promise<number> {
		const targetTodo = await this.todoRepository.findByIdAndUserId(
			targetTodoId,
			userId,
			tx,
		);
		if (!targetTodo) {
			throw new ApplicationException(ErrorCode.TODO_0810, { targetTodoId });
		}

		let newSortOrder =
			position === "before"
				? targetTodo.getSortOrder()
				: targetTodo.getSortOrder() + 1;

		if (currentSortOrder < newSortOrder) {
			// 아래로 이동: 사이 구간을 위로 당김
			await this.todoRepository.shiftSortOrders(
				userId,
				currentSortOrder + 1,
				newSortOrder - 1,
				-1,
				tx,
			);
			newSortOrder -= 1;
		} else {
			// 위로 이동: 사이 구간을 아래로 밀어냄
			await this.todoRepository.shiftSortOrders(
				userId,
				newSortOrder,
				currentSortOrder - 1,
				1,
				tx,
			);
		}

		return newSortOrder;
	}

	/** 맨 앞(before) 또는 맨 뒤(after)로 이동 */
	async #reorderToEdge(
		currentSortOrder: number,
		position: ReorderPosition,
		userId: string,
		tx: TransactionClient,
	): Promise<number> {
		if (position === "before") {
			await this.todoRepository.shiftSortOrders(
				userId,
				0,
				currentSortOrder - 1,
				1,
				tx,
			);
			return 0;
		}

		const maxSortOrder = await this.todoRepository.getMaxSortOrder(userId, tx);
		await this.todoRepository.shiftSortOrders(
			userId,
			currentSortOrder + 1,
			null,
			-1,
			tx,
		);
		return maxSortOrder;
	}
}
