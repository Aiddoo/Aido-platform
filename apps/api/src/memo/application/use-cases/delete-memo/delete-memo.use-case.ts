import { ErrorCode } from "@aido/errors";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";
import {
	MEMO_REPOSITORY,
	type MemoRepositoryPort,
} from "../../ports/memo.repository.port";

/** 메모 삭제 입력 (소유권 확인 후 영구 삭제). */
export interface DeleteMemoInput {
	userId: string;
	memoId: number;
}

/** 메모 삭제 결과. */
export interface DeleteMemoResult {
	message: string;
}

/** 메모 삭제 use-case (소유권 확인 후 삭제). */
@Injectable()
export class DeleteMemoUseCase {
	readonly #logger = new Logger(DeleteMemoUseCase.name);

	constructor(
		@Inject(MEMO_REPOSITORY)
		private readonly repository: MemoRepositoryPort,
	) {}

	async execute(input: DeleteMemoInput): Promise<DeleteMemoResult> {
		const memo = await this.repository.findByIdAndUserId(
			input.memoId,
			input.userId,
		);
		if (!memo) {
			throw new ApplicationException(ErrorCode.MEMO_2001, {
				memoId: input.memoId,
			});
		}

		await this.repository.delete(input.memoId);

		this.#logger.log(`Memo deleted: ${input.memoId} for user: ${input.userId}`);

		return { message: "메모가 삭제되었습니다." };
	}
}
