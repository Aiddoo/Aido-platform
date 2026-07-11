import { ErrorCode } from "@aido/errors";
import type { Memo as MemoResponse } from "@aido/validators";
import { MEMO_LIMITS } from "@aido/validators";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { UNIT_OF_WORK, type UnitOfWorkPort } from "@/shared/application/ports";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";
import { MemoContent } from "../../../domain/value-objects/memo-content.vo";
import {
	MEMO_REPOSITORY,
	type MemoRepositoryPort,
} from "../../ports/memo.repository.port";

/** 메모 변경 계열 유스케이스의 공통 결과(메시지 + 메모 뷰). */
export interface MemoMutationResult {
	message: string;
	memo: MemoResponse;
}

/** 메모 생성 입력. 사용자당 한도 확인 후 정렬 최상단에 생성한다. */
export interface CreateMemoInput {
	userId: string;
	content: string;
}

/**
 * 메모 생성 use-case.
 *
 * 한도 확인 + sortOrder 결정 + 생성을 한 트랜잭션으로 원자화하여 동시 요청의
 * 레이스를 방지한다. 내용 길이 불변식은 도메인(MemoContent)이 소유한다.
 */
@Injectable()
export class CreateMemoUseCase {
	readonly #logger = new Logger(CreateMemoUseCase.name);

	constructor(
		@Inject(UNIT_OF_WORK)
		private readonly uow: UnitOfWorkPort,
		@Inject(MEMO_REPOSITORY)
		private readonly repository: MemoRepositoryPort,
	) {}

	async execute(input: CreateMemoInput): Promise<MemoMutationResult> {
		const memo = await this.uow.run(async () => {
			const count = await this.repository.countByUserId(input.userId);
			if (count >= MEMO_LIMITS.MAX_PER_USER) {
				throw new ApplicationException(ErrorCode.MEMO_2003, {
					current: count,
					limit: MEMO_LIMITS.MAX_PER_USER,
				});
			}

			const content = MemoContent.of(input.content);
			const maxSortOrder = await this.repository.getMaxSortOrder(input.userId);

			return this.repository.create(
				input.userId,
				content.value,
				maxSortOrder + 1,
			);
		});

		this.#logger.log(`Memo created: ${memo.id} for user: ${input.userId}`);

		return { message: "메모가 생성되었습니다.", memo: memo.toView() };
	}
}
