import { ErrorCode } from "@aido/errors";
import { Inject } from "@nestjs/common";
import { type IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";
import {
	MEMO_REPOSITORY,
	type MemoRepositoryPort,
} from "../../ports/memo.repository.port";
import { GetMemoQuery, type GetMemoResult } from "../get-memo.query";

/** 메모 단건 조회 핸들러 (소유권 확인). */
@QueryHandler(GetMemoQuery)
export class GetMemoHandler
	implements IQueryHandler<GetMemoQuery, GetMemoResult>
{
	constructor(
		@Inject(MEMO_REPOSITORY)
		private readonly repository: MemoRepositoryPort,
	) {}

	async execute(query: GetMemoQuery): Promise<GetMemoResult> {
		const memo = await this.repository.findByIdAndUserId(
			query.memoId,
			query.userId,
		);
		if (!memo) {
			throw new ApplicationException(ErrorCode.MEMO_2001, {
				memoId: query.memoId,
			});
		}

		return { memo: memo.toView() };
	}
}
