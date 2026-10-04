import { ErrorCode } from "@aido/errors";
import { Inject, Injectable } from "@nestjs/common";

import { FollowReader } from "#api/follow/index";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import type { NudgeThanksPreviewResult } from "../../nudge-interaction.types.js";
import {
	NUDGE_INTERACTION_CONFIG,
	type NudgeInteractionConfigPort,
} from "../../ports/nudge-interaction-config.port.js";
import { NUDGE_REPOSITORY, type NudgeRepositoryPort } from "../../ports/nudge.repository.port.js";

export interface GetNudgeThanksPreviewInput {
	readonly userId: string;
	readonly todoId: number;
}

@Injectable()
export class GetNudgeThanksPreviewUseCase {
	constructor(
		@Inject(NUDGE_REPOSITORY)
		private readonly nudgeRepository: NudgeRepositoryPort,
		@Inject(NUDGE_INTERACTION_CONFIG)
		private readonly interactionConfig: NudgeInteractionConfigPort,
		private readonly followReader: FollowReader,
	) {}

	async execute(input: GetNudgeThanksPreviewInput): Promise<NudgeThanksPreviewResult> {
		if (!this.interactionConfig.enabled) {
			throw new ApplicationException(ErrorCode.NUDGE_1105);
		}
		const todo = await this.nudgeRepository.findInteractionTodo(input.todoId, input.userId);
		if (!todo) {
			throw new ApplicationException(ErrorCode.TODO_0801);
		}
		if (!todo.completed) {
			throw new ApplicationException(ErrorCode.NUDGE_1110);
		}

		const throughNudgeId = await this.nudgeRepository.findLastReceivedNudgeId(
			input.todoId,
			input.userId,
		);
		if (throughNudgeId === null || todo.visibility !== "PUBLIC") {
			return { todoId: input.todoId, throughNudgeId, recipients: [] };
		}
		const friendIds = await this.followReader.getCurrentMutualFriendIds(input.userId);
		const candidates = await this.nudgeRepository.findThanksCandidates({
			...input,
			throughNudgeId,
			friendIds,
		});

		return {
			todoId: input.todoId,
			throughNudgeId,
			recipients: candidates.map((nudge) => nudge.sender),
		};
	}
}
