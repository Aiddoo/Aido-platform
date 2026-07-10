import { ErrorCode } from "@aido/errors";
import { Inject, Logger } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";
import {
	MEMO_REPOSITORY,
	type MemoRepositoryPort,
} from "../../ports/memo.repository.port";
import {
	DeleteMemoCommand,
	type DeleteMemoResult,
} from "./delete-memo.command";

/** 메모 삭제 핸들러 (소유권 확인 후 삭제). */
@CommandHandler(DeleteMemoCommand)
export class DeleteMemoHandler
	implements ICommandHandler<DeleteMemoCommand, DeleteMemoResult>
{
	readonly #logger = new Logger(DeleteMemoHandler.name);

	constructor(
		@Inject(MEMO_REPOSITORY)
		private readonly repository: MemoRepositoryPort,
	) {}

	async execute(command: DeleteMemoCommand): Promise<DeleteMemoResult> {
		const memo = await this.repository.findByIdAndUserId(
			command.memoId,
			command.userId,
		);
		if (!memo) {
			throw new ApplicationException(ErrorCode.MEMO_2001, {
				memoId: command.memoId,
			});
		}

		await this.repository.delete(command.memoId);

		this.#logger.log(
			`Memo deleted: ${command.memoId} for user: ${command.userId}`,
		);

		return { message: "메모가 삭제되었습니다." };
	}
}
