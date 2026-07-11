import { ErrorCode } from "@aido/errors";
import type { Todo as TodoResponse } from "@aido/validators";
import { Inject, Injectable } from "@nestjs/common";
import type { CursorPaginatedResponse } from "@/shared/application/pagination";
import { PaginationService } from "@/shared/application/pagination";
import { ApplicationException } from "@/shared/domain";
import { isAfter } from "@/shared/domain/date/utils/compare";
import { toDateString } from "@/shared/domain/date/utils/format";
import { FRIEND_PORT, type FriendPort } from "../../ports/friend.port";
import { TODO_CACHE, type TodoCachePort } from "../../ports/todo-cache.port";
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
 * 첫 페이지(cursor 미지정)만 캐싱하며, 권한 확인은 캐시 히트와 무관하게 매 요청 수행합니다
 * (캐시 값은 소유자의 PUBLIC 첫 페이지로 뷰어 무관 공유).
 */
@Injectable()
export class GetFriendTodosUseCase {
	constructor(
		@Inject(TODO_READ_REPOSITORY)
		private readonly todoReadRepository: TodoReadRepositoryPort,
		private readonly paginationService: PaginationService,
		@Inject(FRIEND_PORT)
		private readonly friendPort: FriendPort,
		@Inject(TODO_CACHE)
		private readonly todoCache: TodoCachePort,
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

		// 첫 페이지(cursor 미지정)만 캐싱 — normalizeCursorPagination은 cursor를 그대로 통과시킴.
		// 스탬피드 락/지터 미적용 — 키가 사용자 단위라 글로벌 핫키 없음(과설계 방지).
		const isFirstPage = cursor === undefined;
		const startDateKey = input.startDate ? toDateString(input.startDate) : "-";
		const endDateKey = input.endDate ? toDateString(input.endDate) : "-";

		if (isFirstPage) {
			const cached = await this.todoCache.getFriendTodosFirstPage(
				friendUserId,
				startDateKey,
				endDateKey,
				size,
			);
			if (cached) {
				return cached;
			}
		}

		const repoParams: FindFriendTodosParams = {
			friendUserId,
			cursor,
			size,
			startDate: input.startDate,
			endDate: input.endDate,
		};

		const items =
			await this.todoReadRepository.findPublicTodosByUserId(repoParams);

		const response = this.paginationService.createCursorPaginatedResponse<
			TodoResponse,
			number
		>({ items, size });

		if (isFirstPage) {
			await this.todoCache.setFriendTodosFirstPage(
				friendUserId,
				startDateKey,
				endDateKey,
				size,
				response,
			);
		}

		return response;
	}
}
