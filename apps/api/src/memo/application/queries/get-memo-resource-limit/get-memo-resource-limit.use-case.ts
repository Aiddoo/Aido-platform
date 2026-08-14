import { MEMO_LIMITS } from "@aido/validators";
import { Inject, Injectable } from "@nestjs/common";

import { MEMO_REPOSITORY, type MemoRepositoryPort } from "../../ports/memo.repository.port";

/** 메모 리소스 제한 정보 조회 입력. */
export interface GetMemoResourceLimitInput {
	userId: string;
}

/** 메모 리소스 제한 조회 결과. */
export interface MemoResourceLimit {
	currentCount: number;
	maxPerUser: number;
}

/** 메모 리소스 제한 정보 조회 use-case. */
@Injectable()
export class GetMemoResourceLimitUseCase {
	constructor(
		@Inject(MEMO_REPOSITORY)
		private readonly repository: MemoRepositoryPort,
	) {}

	async execute(input: GetMemoResourceLimitInput): Promise<MemoResourceLimit> {
		const currentCount = await this.repository.countByUserId(input.userId);
		return { currentCount, maxPerUser: MEMO_LIMITS.MAX_PER_USER };
	}
}
