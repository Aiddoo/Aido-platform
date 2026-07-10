import type { Memo as MemoResponse } from "@aido/validators";
import { Query } from "@nestjs/cqrs";
import type { CursorPaginatedResponse } from "@/shared/application/pagination";

/** 메모 목록 조회 쿼리 (커서 기반 페이지네이션). */
export class GetMemosQuery extends Query<
	CursorPaginatedResponse<MemoResponse, number>
> {
	constructor(
		public readonly userId: string,
		public readonly cursor?: number,
		public readonly size?: number,
	) {
		super();
	}
}
