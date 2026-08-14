import { ErrorCode } from "@aido/errors";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";
import {
	MEMO_REPOSITORY,
	type MemoRepositoryPort,
} from "../../ports/memo.repository.port";
import type { MemoMutationResult } from "../create-memo/create-memo.use-case";

/** 메모 고정/해제 입력. */
export interface ToggleMemoPinInput {
	userId: string;
	memoId: number;
	isPinned: boolean;
}

/** 메모 고정/해제 use-case (소유권 확인 후 토글). */
@Injectable()
export class ToggleMemoPinUseCase {
	readonly #logger = new Logger(ToggleMemoPinUseCase.name);

	constructor(
		@Inject(MEMO_REPOSITORY)
		private readonly repository: MemoRepositoryPort,
	) {}

	async execute(input: ToggleMemoPinInput): Promise<MemoMutationResult> {
		const memo = await this.repository.findByIdAndUserId(
			input.memoId,
			input.userId,
		);
		if (!memo) {
			throw new ApplicationException(ErrorCode.MEMO_2001, {
				memoId: input.memoId,
			});
		}

		memo.setPinned(input.isPinned);
		const updated = await this.repository.updatePinned(
			input.memoId,
			memo.isPinned,
		);

		this.#logger.log(
			`Memo ${input.isPinned ? "pinned" : "unpinned"}: ${input.memoId} for user: ${input.userId}`,
		);

		return {
			message: input.isPinned
				? "메모가 고정되었습니다."
				: "메모 고정이 해제되었습니다.",
			memo: updated.toView(),
		};
	}
}
