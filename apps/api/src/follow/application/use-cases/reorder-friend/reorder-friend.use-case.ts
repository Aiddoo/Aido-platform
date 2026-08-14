import { ErrorCode } from "@aido/errors";
import { Inject, Injectable, Logger } from "@nestjs/common";

import { UNIT_OF_WORK, type UnitOfWorkPort } from "@/shared/application/ports";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";

import type { ReorderPlan, ReorderPosition } from "../../../domain/services/friend-reorder";
import {
	FOLLOW_REPOSITORY,
	type FollowRepositoryPort,
	type FollowWithUser,
} from "../../ports/follow.repository.port";

export interface ReorderFriendInput {
	followId: string;
	userId: string;
	targetFollowId?: string;
	position: ReorderPosition;
}

/**
 * 친구 순서 변경 use-case.
 *
 * 재정렬 계획(새 sortOrder + 사이 구간 시프트)은 순수 도메인 서비스가 계산하고,
 * 이 use-case는 트랜잭션 안에서 시프트 → 대상 갱신을 적용한다.
 */
@Injectable()
export class ReorderFriendUseCase {
	readonly #logger = new Logger(ReorderFriendUseCase.name);

	constructor(
		@Inject(FOLLOW_REPOSITORY)
		private readonly followRepository: FollowRepositoryPort,
		@Inject(UNIT_OF_WORK)
		private readonly uow: UnitOfWorkPort,
	) {}

	async execute(input: ReorderFriendInput): Promise<FollowWithUser> {
		const { followId, userId, targetFollowId, position } = input;

		return this.uow.run(async () => {
			const follow = await this.followRepository.findAcceptedByIdAndFollowerId(followId, userId);
			if (!follow) {
				throw new ApplicationException(ErrorCode.FOLLOW_0910, {
					targetFollowId: followId,
				});
			}

			// 자기 자신 기준으로 이동하면 위치 변화 없음 — 현재 상태 그대로 반환
			if (targetFollowId === followId) {
				const withUser = await this.followRepository.findByIdWithUser(followId);
				if (!withUser) {
					throw new ApplicationException(ErrorCode.FOLLOW_0910, {
						targetFollowId: followId,
					});
				}
				return withUser;
			}

			let plan: ReorderPlan;
			if (targetFollowId) {
				const target = await this.followRepository.findAcceptedByIdAndFollowerId(
					targetFollowId,
					userId,
				);
				if (!target) {
					throw new ApplicationException(ErrorCode.FOLLOW_0910, {
						targetFollowId,
					});
				}
				plan = follow.planReorderRelativeTo(target.sortOrder, position);
			} else {
				const maxSortOrder = await this.followRepository.getMaxSortOrderForFriends(userId);
				plan = follow.planReorderToEdge(position, maxSortOrder);
			}

			await this.followRepository.shiftFriendSortOrders(
				userId,
				plan.shift.from,
				plan.shift.to,
				plan.shift.delta,
			);
			const updated = await this.followRepository.updateFollowSortOrder(
				followId,
				plan.newSortOrder,
			);

			this.#logger.log(
				`친구 순서 변경 완료: followId=${followId}, sortOrder=${plan.newSortOrder}, userId=${userId}`,
			);

			return updated;
		});
	}
}
