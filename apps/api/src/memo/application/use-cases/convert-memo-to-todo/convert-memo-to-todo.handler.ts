import { ErrorCode } from "@aido/errors";
import { Inject, Logger } from "@nestjs/common";
import { CommandBus, CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";
import { CreateTodoCommand } from "@/todo";
import {
	MEMO_REPOSITORY,
	type MemoRepositoryPort,
} from "../../ports/memo.repository.port";
import {
	ConvertMemoToTodoCommand,
	type ConvertMemoToTodoResult,
} from "./convert-memo-to-todo.command";

/**
 * 메모 → 단일 할 일 변환 핸들러.
 *
 * 소유권 확인 → CreateTodoCommand 디스패치(자체 TX) → 커밋 후 메모 삭제.
 * 메모 내용은 도메인 정책(앞 200자)으로 할 일 제목이 된다.
 */
@CommandHandler(ConvertMemoToTodoCommand)
export class ConvertMemoToTodoHandler
	implements ICommandHandler<ConvertMemoToTodoCommand, ConvertMemoToTodoResult>
{
	readonly #logger = new Logger(ConvertMemoToTodoHandler.name);

	constructor(
		@Inject(MEMO_REPOSITORY)
		private readonly repository: MemoRepositoryPort,
		private readonly commandBus: CommandBus,
	) {}

	async execute(
		command: ConvertMemoToTodoCommand,
	): Promise<ConvertMemoToTodoResult> {
		const { userId, memoId, data } = command;

		// 1. 소유권 확인 (읽기 전용, TX 외부)
		const memo = await this.repository.findByIdAndUserId(memoId, userId);
		if (!memo) {
			throw new ApplicationException(ErrorCode.MEMO_2001, { memoId });
		}

		// 2. 할 일 생성 (CreateTodoHandler 내부 TX)
		const todo = await this.commandBus.execute(
			new CreateTodoCommand({
				userId,
				title: memo.toTodoTitle(),
				categoryId: data.categoryId,
				startDate: data.startDate,
				endDate: data.endDate,
				scheduledTime: data.scheduledTime,
				isAllDay: data.isAllDay ?? true,
				visibility: data.visibility ?? "PUBLIC",
				items: data.items,
			}),
		);

		// 3. 메모 삭제 (할 일 생성 커밋 후)
		await this.repository.delete(memoId);

		this.#logger.log(
			`Memo ${memoId} converted to todo ${todo.id} for user: ${userId}`,
		);

		return { message: "메모가 할 일로 변환되었습니다.", todo };
	}
}
