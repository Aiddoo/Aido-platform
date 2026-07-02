import { ErrorCode } from "@aido/errors";
import type { Todo as TodoResponse } from "@aido/validators";
import { Inject } from "@nestjs/common";
import { type IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import { isAfter } from "@/common/date/utils/compare";
import { ApplicationException } from "@/common/domain";
import type { CursorPaginatedResponse } from "@/common/pagination";
import { PaginationService } from "@/common/pagination";
import { TodoMapper } from "../../../todo.mapper";
import type { FindTodosParams } from "../../../types/todo.types";
import {
	TODO_REPOSITORY,
	type TodoRepositoryPort,
} from "../../ports/todo.repository.port";
import { GetTodosQuery } from "../get-todos.query";

/**
 * Todo 목록 조회 핸들러 (커서 기반 페이지네이션)
 */
@QueryHandler(GetTodosQuery)
export class GetTodosHandler
	implements
		IQueryHandler<GetTodosQuery, CursorPaginatedResponse<TodoResponse, number>>
{
	constructor(
		@Inject(TODO_REPOSITORY)
		private readonly todoRepository: TodoRepositoryPort,
		private readonly paginationService: PaginationService,
	) {}

	async execute(
		query: GetTodosQuery,
	): Promise<CursorPaginatedResponse<TodoResponse, number>> {
		const { params } = query;

		if (
			params.startDate &&
			params.endDate &&
			isAfter(params.startDate, params.endDate)
		) {
			throw new ApplicationException(ErrorCode.SYS_0002, {
				message: "startDate must be less than or equal to endDate",
				startDate: params.startDate,
				endDate: params.endDate,
			});
		}

		const { cursor, size } =
			this.paginationService.normalizeCursorPagination<number>({
				cursor: params.cursor,
				size: params.size,
			});

		const repoParams: FindTodosParams = {
			userId: params.userId,
			cursor,
			size,
			completed: params.completed,
			categoryId: params.categoryId,
			startDate: params.startDate,
			endDate: params.endDate,
		};

		const todos = await this.todoRepository.findManyByUserId(repoParams);

		return this.paginationService.createCursorPaginatedResponse<
			TodoResponse,
			number
		>({
			items: todos.map((todo) => TodoMapper.toResponse(todo.getSnapshot())),
			size,
		});
	}
}
