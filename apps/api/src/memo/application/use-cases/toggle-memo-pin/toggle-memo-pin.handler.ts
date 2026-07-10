import { ErrorCode } from "@aido/errors";
import { Inject, Logger } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";
import {
	MEMO_REPOSITORY,
	type MemoRepositoryPort,
} from "../../ports/memo.repository.port";
import type { MemoMutationResult } from "../create-memo/create-memo.command";
import { ToggleMemoPinCommand } from "./toggle-memo-pin.command";

/** 메모 고정/해제 핸들러 (소유권 확인 후 토글). */
@CommandHandler(ToggleMemoPinCommand)
export class ToggleMemoPinHandler
	implements ICommandHandler<ToggleMemoPinCommand, MemoMutationResult>
{
	readonly #logger = new Logger(ToggleMemoPinHandler.name);

	constructor(
		@Inject(MEMO_REPOSITORY)
		private readonly repository: MemoRepositoryPort,
	) {}

	async execute(command: ToggleMemoPinCommand): Promise<MemoMutationResult> {
		const memo = await this.repository.findByIdAndUserId(
			command.memoId,
			command.userId,
		);
		if (!memo) {
			throw new ApplicationException(ErrorCode.MEMO_2001, {
				memoId: command.memoId,
			});
		}

		const updated = await this.repository.updatePinned(
			command.memoId,
			command.isPinned,
		);

		this.#logger.log(
			`Memo ${command.isPinned ? "pinned" : "unpinned"}: ${command.memoId} for user: ${command.userId}`,
		);

		return {
			message: command.isPinned
				? "메모가 고정되었습니다."
				: "메모 고정이 해제되었습니다.",
			memo: updated.toView(),
		};
	}
}
