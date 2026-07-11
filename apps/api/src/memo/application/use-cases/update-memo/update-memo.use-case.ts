import { ErrorCode } from "@aido/errors";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";
import { MemoContent } from "../../../domain/value-objects/memo-content.vo";
import {
	MEMO_REPOSITORY,
	type MemoRepositoryPort,
} from "../../ports/memo.repository.port";
import type { MemoMutationResult } from "../create-memo/create-memo.use-case";

/** 메모 내용 수정 입력. */
export interface UpdateMemoInput {
	userId: string;
	memoId: number;
	content: string;
}

/** 메모 내용 수정 use-case (소유권 확인 후 수정). */
@Injectable()
export class UpdateMemoUseCase {
	readonly #logger = new Logger(UpdateMemoUseCase.name);

	constructor(
		@Inject(MEMO_REPOSITORY)
		private readonly repository: MemoRepositoryPort,
	) {}

	async execute(input: UpdateMemoInput): Promise<MemoMutationResult> {
		const memo = await this.repository.findByIdAndUserId(
			input.memoId,
			input.userId,
		);
		if (!memo) {
			throw new ApplicationException(ErrorCode.MEMO_2001, {
				memoId: input.memoId,
			});
		}

		const content = MemoContent.of(input.content);
		const updated = await this.repository.updateContent(
			input.memoId,
			content.value,
		);

		this.#logger.log(`Memo updated: ${input.memoId} for user: ${input.userId}`);

		return { message: "메모가 수정되었습니다.", memo: updated.toView() };
	}
}
