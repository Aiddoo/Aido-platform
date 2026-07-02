import { ErrorCode } from "@aido/errors";
import type { Todo as TodoResponse } from "@aido/validators";
import { Inject } from "@nestjs/common";
import { type IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import { isAfter } from "@/common/date/utils/compare";
import { ApplicationException } from "@/common/domain";
import type { CursorPaginatedResponse } from "@/common/pagination";
import { PaginationService } from "@/common/pagination";
import { FollowService } from "../../../../follow/follow.service";
import { TodoMapper } from "../../../todo.mapper";
import type { FindFriendTodosParams } from "../../../types/todo.types";
import {
	TODO_REPOSITORY,
	type TodoRepositoryPort,
} from "../../ports/todo.repository.port";
import { GetFriendTodosQuery } from "../get-friend-todos.query";

/**
 * 친구의 PUBLIC Todo 목록 조회 핸들러
 *
 * 맞팔 관계를 확인한 뒤 친구의 PUBLIC 투두만 커서 페이지네이션으로 조회합니다.
 */
@QueryHandler(GetFriendTodosQuery)
export class GetFriendTodosHandler
	implements
		IQueryHandler<
			GetFriendTodosQuery,
			CursorPaginatedResponse<TodoResponse, number>
		>
{
	constructor(
		@Inject(TODO_REPOSITORY)
		private readonly todoRepository: TodoRepositoryPort,
		private readonly paginationService: PaginationService,
		private readonly followService: FollowService,
	) {}

	async execute(
		query: GetFriendTodosQuery,
	): Promise<CursorPaginatedResponse<TodoResponse, number>> {
		const { userId, friendUserId } = query.params;

		if (
			query.params.startDate &&
			query.params.endDate &&
			isAfter(query.params.startDate, query.params.endDate)
		) {
			throw new ApplicationException(ErrorCode.SYS_0002, {
				message: "startDate must be less than or equal to endDate",
				startDate: query.params.startDate,
				endDate: query.params.endDate,
			});
		}

		const isMutualFriend = await this.followService.isMutualFriend(
			userId,
			friendUserId,
		);
		if (!isMutualFriend) {
			throw new ApplicationException(ErrorCode.FOLLOW_0906, {
				targetUserId: friendUserId,
			});
		}

		const { cursor, size } =
			this.paginationService.normalizeCursorPagination<number>({
				cursor: query.params.cursor,
				size: query.params.size,
			});

		const repoParams: FindFriendTodosParams = {
			friendUserId,
			cursor,
			size,
			startDate: query.params.startDate,
			endDate: query.params.endDate,
		};

		const todos = await this.todoRepository.findPublicTodosByUserId(repoParams);

		return this.paginationService.createCursorPaginatedResponse<
			TodoResponse,
			number
		>({
			items: todos.map((todo) => TodoMapper.toResponse(todo.getSnapshot())),
			size,
		});
	}
}
