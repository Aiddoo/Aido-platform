import type { Memo as MemoResponse } from "@aido/validators";
import { Inject, Injectable } from "@nestjs/common";
import type { CursorPaginatedResponse } from "@/shared/application/pagination";
import { PaginationService } from "@/shared/application/pagination";
import {
	MEMO_REPOSITORY,
	type MemoRepositoryPort,
} from "../../ports/memo.repository.port";

/** 메모 목록 조회 입력 (커서 기반 페이지네이션). */
export interface GetMemosInput {
	userId: string;
	cursor?: number;
	size?: number;
}

/** 메모 목록 조회 use-case (커서 기반, 고정 우선 정렬). */
@Injectable()
export class GetMemosUseCase {
	constructor(
		@Inject(MEMO_REPOSITORY)
		private readonly repository: MemoRepositoryPort,
		private readonly paginationService: PaginationService,
	) {}

	async execute(
		input: GetMemosInput,
	): Promise<CursorPaginatedResponse<MemoResponse, number>> {
		const { cursor, size } =
			this.paginationService.normalizeCursorPagination<number>({
				cursor: input.cursor,
				size: input.size,
			});

		const memos = await this.repository.findManyByUserId({
			userId: input.userId,
			cursor,
			size,
		});

		return this.paginationService.createCursorPaginatedResponse<
			MemoResponse,
			number
		>({ items: memos.map((memo) => memo.toView()), size });
	}
}
