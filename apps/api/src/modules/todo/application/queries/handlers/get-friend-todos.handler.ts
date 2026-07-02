import { ErrorCode } from "@aido/errors";
import type { Todo as TodoResponse } from "@aido/validators";
import { Inject } from "@nestjs/common";
import { type IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import { isAfter } from "@/common/date/utils/compare";
import { ApplicationException } from "@/common/domain";
import type { CursorPaginatedResponse } from "@/common/pagination";
import { PaginationService } from "@/common/pagination";
import type { FindFriendTodosParams } from "../../../types/todo.types";
import { FRIEND_PORT, type FriendPort } from "../../ports/friend.port";
import {
	TODO_READ_REPOSITORY,
	type TodoReadRepositoryPort,
} from "../../ports/todo-read.repository.port";
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
		@Inject(TODO_READ_REPOSITORY)
		private readonly todoReadRepository: TodoReadRepositoryPort,
		private readonly paginationService: PaginationService,
		@Inject(FRIEND_PORT)
		private readonly friendPort: FriendPort,
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

		const isMutualFriend = await this.friendPort.isMutualFriend(
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

		const items =
			await this.todoReadRepository.findPublicTodosByUserId(repoParams);

		return this.paginationService.createCursorPaginatedResponse<
			TodoResponse,
			number
		>({ items, size });
	}
}
