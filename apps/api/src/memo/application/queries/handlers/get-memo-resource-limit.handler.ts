import { MEMO_LIMITS } from "@aido/validators";
import { Inject } from "@nestjs/common";
import { type IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import {
	MEMO_REPOSITORY,
	type MemoRepositoryPort,
} from "../../ports/memo.repository.port";
import {
	GetMemoResourceLimitQuery,
	type MemoResourceLimit,
} from "../get-memo-resource-limit.query";

/** 메모 리소스 제한 정보 조회 핸들러. */
@QueryHandler(GetMemoResourceLimitQuery)
export class GetMemoResourceLimitHandler
	implements IQueryHandler<GetMemoResourceLimitQuery, MemoResourceLimit>
{
	constructor(
		@Inject(MEMO_REPOSITORY)
		private readonly repository: MemoRepositoryPort,
	) {}

	async execute(query: GetMemoResourceLimitQuery): Promise<MemoResourceLimit> {
		const currentCount = await this.repository.countByUserId(query.userId);
		return { currentCount, maxPerUser: MEMO_LIMITS.MAX_PER_USER };
	}
}
