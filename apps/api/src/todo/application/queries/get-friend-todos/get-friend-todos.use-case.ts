import { ErrorCode } from "@aido/errors";
import type { Todo as TodoResponse } from "@aido/validators";
import { Inject, Injectable } from "@nestjs/common";
import type { CursorPaginatedResponse } from "@/shared/application/pagination";
import { PaginationService } from "@/shared/application/pagination";
import { ApplicationException } from "@/shared/domain";
import { isAfter } from "@/shared/domain/date/utils/compare";
import { FRIEND_PORT, type FriendPort } from "../../ports/friend.port";
import {
	TODO_READ_REPOSITORY,
	type TodoReadRepositoryPort,
} from "../../ports/todo-read.repository.port";
import type { FindFriendTodosParams, GetFriendTodosParams } from "../../types";

/** 친구 Todo 목록 조회 입력. */
export type GetFriendTodosInput = GetFriendTodosParams;

/**
 * 친구의 PUBLIC Todo 목록 조회 use-case
 *
 * 맞팔 관계를 확인한 뒤 친구의 PUBLIC 투두만 커서 페이지네이션으로 조회합니다.
 */
@Injectable()
export class GetFriendTodosUseCase {
	constructor(
		@Inject(TODO_READ_REPOSITORY)
		private readonly todoReadRepository: TodoReadRepositoryPort,
		private readonly paginationService: PaginationService,
		@Inject(FRIEND_PORT)
		private readonly friendPort: FriendPort,
	) {}

	async execute(
		input: GetFriendTodosInput,
	): Promise<CursorPaginatedResponse<TodoResponse, number>> {
		const { userId, friendUserId } = input;

		if (
			input.startDate &&
			input.endDate &&
			isAfter(input.startDate, input.endDate)
		) {
			throw new ApplicationException(ErrorCode.SYS_0002, {
				message: "startDate must be less than or equal to endDate",
				startDate: input.startDate,
				endDate: input.endDate,
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
				cursor: input.cursor,
				size: input.size,
			});

		const repoParams: FindFriendTodosParams = {
			friendUserId,
			cursor,
			size,
			startDate: input.startDate,
			endDate: input.endDate,
		};

		const items =
			await this.todoReadRepository.findPublicTodosByUserId(repoParams);

		return this.paginationService.createCursorPaginatedResponse<
			TodoResponse,
			number
		>({ items, size });
	}
}
