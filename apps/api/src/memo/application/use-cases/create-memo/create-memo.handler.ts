import { ErrorCode } from "@aido/errors";
import { MEMO_LIMITS } from "@aido/validators";
import { Inject, Logger } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { UNIT_OF_WORK, type UnitOfWorkPort } from "@/shared/application/ports";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";
import { MemoContent } from "../../../domain/value-objects/memo-content.vo";
import {
	MEMO_REPOSITORY,
	type MemoRepositoryPort,
} from "../../ports/memo.repository.port";
import {
	CreateMemoCommand,
	type MemoMutationResult,
} from "./create-memo.command";

/**
 * 메모 생성 핸들러.
 *
 * 한도 확인 + sortOrder 결정 + 생성을 한 트랜잭션으로 원자화하여 동시 요청의
 * 레이스를 방지한다. 내용 길이 불변식은 도메인(MemoContent)이 소유한다.
 */
@CommandHandler(CreateMemoCommand)
export class CreateMemoHandler
	implements ICommandHandler<CreateMemoCommand, MemoMutationResult>
{
	readonly #logger = new Logger(CreateMemoHandler.name);

	constructor(
		@Inject(UNIT_OF_WORK)
		private readonly uow: UnitOfWorkPort,
		@Inject(MEMO_REPOSITORY)
		private readonly repository: MemoRepositoryPort,
	) {}

	async execute(command: CreateMemoCommand): Promise<MemoMutationResult> {
		const memo = await this.uow.run(async () => {
			const count = await this.repository.countByUserId(command.userId);
			if (count >= MEMO_LIMITS.MAX_PER_USER) {
				throw new ApplicationException(ErrorCode.MEMO_2003, {
					current: count,
					limit: MEMO_LIMITS.MAX_PER_USER,
				});
			}

			const content = MemoContent.of(command.content);
			const maxSortOrder = await this.repository.getMaxSortOrder(
				command.userId,
			);

			return this.repository.create(
				command.userId,
				content.value,
				maxSortOrder + 1,
			);
		});

		this.#logger.log(`Memo created: ${memo.id} for user: ${command.userId}`);

		return { message: "메모가 생성되었습니다.", memo: memo.toView() };
	}
}
