import { ErrorCode } from "@aido/errors";
import { Inject, Logger } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";
import { MemoContent } from "../../../domain/value-objects/memo-content.vo";
import {
	MEMO_REPOSITORY,
	type MemoRepositoryPort,
} from "../../ports/memo.repository.port";
import type { MemoMutationResult } from "../create-memo/create-memo.command";
import { UpdateMemoCommand } from "./update-memo.command";

/** 메모 내용 수정 핸들러 (소유권 확인 후 수정). */
@CommandHandler(UpdateMemoCommand)
export class UpdateMemoHandler
	implements ICommandHandler<UpdateMemoCommand, MemoMutationResult>
{
	readonly #logger = new Logger(UpdateMemoHandler.name);

	constructor(
		@Inject(MEMO_REPOSITORY)
		private readonly repository: MemoRepositoryPort,
	) {}

	async execute(command: UpdateMemoCommand): Promise<MemoMutationResult> {
		const memo = await this.repository.findByIdAndUserId(
			command.memoId,
			command.userId,
		);
		if (!memo) {
			throw new ApplicationException(ErrorCode.MEMO_2001, {
				memoId: command.memoId,
			});
		}

		const content = MemoContent.of(command.content);
		const updated = await this.repository.updateContent(
			command.memoId,
			content.value,
		);

		this.#logger.log(
			`Memo updated: ${command.memoId} for user: ${command.userId}`,
		);

		return { message: "메모가 수정되었습니다.", memo: updated.toView() };
	}
}
