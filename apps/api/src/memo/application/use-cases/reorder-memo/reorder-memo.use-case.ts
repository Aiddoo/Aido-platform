import { ErrorCode } from "@aido/errors";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { UNIT_OF_WORK, type UnitOfWorkPort } from "@/shared/application/ports";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";
import {
	planReorderRelativeTo,
	planReorderToEdge,
	type ReorderPlan,
} from "../../../domain/services/memo-reorder";
import {
	MEMO_REPOSITORY,
	type MemoRepositoryPort,
} from "../../ports/memo.repository.port";
import type { MemoMutationResult } from "../create-memo/create-memo.use-case";

/**
 * 메모 순서 변경 입력.
 * targetMemoId 생략 시 맨 앞/뒤로 이동한다.
 */
export interface ReorderMemoInput {
	userId: string;
	memoId: number;
	position: "before" | "after";
	targetMemoId?: number;
}

/**
 * 메모 순서 변경 use-case.
 *
 * 새 sortOrder와 사이 구간 시프트 계획은 도메인 서비스가 계산하고, 시프트·갱신을
 * 한 트랜잭션으로 적용한다. 자기 자신을 기준으로 지정하면 변경 없이 반환한다.
 */
@Injectable()
export class ReorderMemoUseCase {
	readonly #logger = new Logger(ReorderMemoUseCase.name);

	constructor(
		@Inject(UNIT_OF_WORK)
		private readonly uow: UnitOfWorkPort,
		@Inject(MEMO_REPOSITORY)
		private readonly repository: MemoRepositoryPort,
	) {}

	async execute(input: ReorderMemoInput): Promise<MemoMutationResult> {
		const { userId, memoId, targetMemoId } = input;

		return this.uow.run(async () => {
			const memo = await this.repository.findByIdAndUserId(memoId, userId);
			if (!memo) {
				throw new ApplicationException(ErrorCode.MEMO_2001, { memoId });
			}

			if (targetMemoId === memoId) {
				return { message: "메모 순서가 변경되었습니다.", memo: memo.toView() };
			}

			const plan = await this.#planReorder(memo.sortOrder, input);

			await this.repository.shiftSortOrders(
				userId,
				plan.shift.from,
				plan.shift.to,
				plan.shift.delta,
			);
			const updated = await this.repository.updateSortOrder(
				memoId,
				plan.newSortOrder,
			);

			this.#logger.log(
				`Memo reordered: ${memoId} to sortOrder ${plan.newSortOrder} for user: ${userId}`,
			);

			return { message: "메모 순서가 변경되었습니다.", memo: updated.toView() };
		});
	}

	async #planReorder(
		currentSortOrder: number,
		input: ReorderMemoInput,
	): Promise<ReorderPlan> {
		const { userId, targetMemoId, position } = input;

		if (targetMemoId) {
			const target = await this.repository.findByIdAndUserId(
				targetMemoId,
				userId,
			);
			if (!target) {
				throw new ApplicationException(ErrorCode.MEMO_2002, { targetMemoId });
			}
			return planReorderRelativeTo(
				currentSortOrder,
				target.sortOrder,
				position,
			);
		}

		// 맨 뒤 이동만 maxSortOrder가 필요하다 (맨 앞은 0 고정).
		const maxSortOrder =
			position === "after" ? await this.repository.getMaxSortOrder(userId) : 0;
		return planReorderToEdge(currentSortOrder, position, maxSortOrder);
	}
}
