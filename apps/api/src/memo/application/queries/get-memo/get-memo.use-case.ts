import { ErrorCode } from "@aido/errors";
import type { Memo as MemoResponse } from "@aido/validators";
import { Inject, Injectable } from "@nestjs/common";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";
import {
	MEMO_REPOSITORY,
	type MemoRepositoryPort,
} from "../../ports/memo.repository.port";

/** 메모 단건 조회 입력. */
export interface GetMemoInput {
	userId: string;
	memoId: number;
}

/** 메모 단건 조회 결과. */
export interface GetMemoResult {
	memo: MemoResponse;
}

/** 메모 단건 조회 use-case (소유권 확인). */
@Injectable()
export class GetMemoUseCase {
	constructor(
		@Inject(MEMO_REPOSITORY)
		private readonly repository: MemoRepositoryPort,
	) {}

	async execute(input: GetMemoInput): Promise<GetMemoResult> {
		const memo = await this.repository.findByIdAndUserId(
			input.memoId,
			input.userId,
		);
		if (!memo) {
			throw new ApplicationException(ErrorCode.MEMO_2001, {
				memoId: input.memoId,
			});
		}

		return { memo: memo.toView() };
	}
}
