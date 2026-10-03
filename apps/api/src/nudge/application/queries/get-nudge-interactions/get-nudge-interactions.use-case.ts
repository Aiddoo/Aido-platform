import { ErrorCode } from "@aido/errors";
import { Inject, Injectable } from "@nestjs/common";

import { FollowReader } from "#api/follow/index";
import {
	PaginationService,
	type CursorPaginatedResponse,
} from "#api/shared/application/pagination/index";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { NudgeInteractionPolicy } from "../../../domain/policies/nudge-interaction.policy.js";
import type { NudgeInteractionResult } from "../../nudge-interaction.types.js";
import {
	NUDGE_INTERACTION_CONFIG,
	type NudgeInteractionConfigPort,
} from "../../ports/nudge-interaction-config.port.js";
import {
	NUDGE_REPOSITORY,
	type NudgeRepositoryPort,
	type NudgeInteractionRecord,
} from "../../ports/nudge.repository.port.js";

export interface GetNudgeInteractionsInput {
	readonly userId: string;
	readonly direction: "received" | "sent";
	readonly cursor?: number;
	readonly size: number;
}

@Injectable()
export class GetNudgeInteractionsUseCase {
	constructor(
		@Inject(NUDGE_REPOSITORY)
		private readonly nudgeRepository: NudgeRepositoryPort,
		@Inject(NUDGE_INTERACTION_CONFIG)
		private readonly interactionConfig: NudgeInteractionConfigPort,
		private readonly followReader: FollowReader,
		private readonly paginationService: PaginationService,
	) {}

	async execute(
		input: GetNudgeInteractionsInput,
	): Promise<CursorPaginatedResponse<NudgeInteractionResult, number>> {
		if (!this.interactionConfig.enabled) {
			throw new ApplicationException(ErrorCode.NUDGE_1105);
		}

		const [nudges, friendIds] = await Promise.all([
			this.nudgeRepository.findInteractions(input),
			this.followReader.getCurrentMutualFriendIds(input.userId),
		]);
		const friends = new Set(friendIds);
		const page = this.paginationService.createCursorPaginatedResponse<
			NudgeInteractionRecord,
			number
		>({
			items: nudges,
			size: input.size,
		});

		return {
			...page,
			items: page.items.map((nudge) => ({
				...nudge,
				isAvailable: NudgeInteractionPolicy.isAvailable(nudge, {
					isMutualFriend: friends.has(
						input.direction === "received" ? nudge.senderId : nudge.receiverId,
					),
					todoOwnerId: nudge.todo.ownerId,
					todoVisibility: nudge.todo.visibility,
				}),
			})),
		};
	}
}
