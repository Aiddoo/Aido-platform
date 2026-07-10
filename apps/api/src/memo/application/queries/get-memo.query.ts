import type { Memo as MemoResponse } from "@aido/validators";
import { Query } from "@nestjs/cqrs";

/** 메모 단건 조회 결과. */
export interface GetMemoResult {
	memo: MemoResponse;
}

/** 메모 단건 조회 쿼리. */
export class GetMemoQuery extends Query<GetMemoResult> {
	constructor(
		public readonly userId: string,
		public readonly memoId: number,
	) {
		super();
	}
}
