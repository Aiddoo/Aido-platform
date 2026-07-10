import type { Memo as MemoResponse } from "@aido/validators";
import { Inject } from "@nestjs/common";
import { type IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import type { CursorPaginatedResponse } from "@/shared/application/pagination";
import { PaginationService } from "@/shared/application/pagination";
import {
	MEMO_REPOSITORY,
	type MemoRepositoryPort,
} from "../../ports/memo.repository.port";
import { GetMemosQuery } from "../get-memos.query";

/** 메모 목록 조회 핸들러 (커서 기반, 고정 우선 정렬). */
@QueryHandler(GetMemosQuery)
export class GetMemosHandler implements IQueryHandler<GetMemosQuery> {
	constructor(
		@Inject(MEMO_REPOSITORY)
		private readonly repository: MemoRepositoryPort,
		private readonly paginationService: PaginationService,
	) {}

	async execute(
		query: GetMemosQuery,
	): Promise<CursorPaginatedResponse<MemoResponse, number>> {
		const { cursor, size } =
			this.paginationService.normalizeCursorPagination<number>({
				cursor: query.cursor,
				size: query.size,
			});

		const memos = await this.repository.findManyByUserId({
			userId: query.userId,
			cursor,
			size,
		});

		return this.paginationService.createCursorPaginatedResponse<
			MemoResponse,
			number
		>({ items: memos.map((memo) => memo.toView()), size });
	}
}
