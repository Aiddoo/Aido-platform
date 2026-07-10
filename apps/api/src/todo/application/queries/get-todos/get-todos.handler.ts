import { ErrorCode } from "@aido/errors";
import type { Todo as TodoResponse } from "@aido/validators";
import { Inject } from "@nestjs/common";
import { type IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import type { CursorPaginatedResponse } from "@/shared/application/pagination";
import { PaginationService } from "@/shared/application/pagination";
import { ApplicationException } from "@/shared/domain";
import { isAfter } from "@/shared/domain/date/utils/compare";
import {
	TODO_READ_REPOSITORY,
	type TodoReadRepositoryPort,
} from "../../ports/todo-read.repository.port";
import type { FindTodosParams } from "../../types";
import { GetTodosQuery } from "./get-todos.query";

/**
 * Todo 목록 조회 핸들러 (커서 기반 페이지네이션, read model 직접 반환)
 */
@QueryHandler(GetTodosQuery)
export class GetTodosHandler implements IQueryHandler<GetTodosQuery> {
	constructor(
		@Inject(TODO_READ_REPOSITORY)
		private readonly todoReadRepository: TodoReadRepositoryPort,
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

		const items = await this.todoReadRepository.findManyByUserId(repoParams);

		return this.paginationService.createCursorPaginatedResponse<
			TodoResponse,
			number
		>({ items, size });
	}
}
