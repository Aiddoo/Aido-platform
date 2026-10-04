import { ErrorCode } from "@aido/errors";
import { Inject, Injectable } from "@nestjs/common";

import { FollowReader } from "#api/follow/index";
import { UNIT_OF_WORK, type UnitOfWorkPort } from "#api/shared/application/ports/index";
import { now } from "#api/shared/domain/date/utils/core";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { Nudge } from "../../../domain/entities/nudge.aggregate.js";
import {
	NUDGE_INTERACTION_CONFIG,
	type NudgeInteractionConfigPort,
} from "../../ports/nudge-interaction-config.port.js";
import { NUDGE_NOTIFIER, type NudgeNotifierPort } from "../../ports/nudge-notifier.port.js";
import { NUDGE_REPOSITORY, type NudgeRepositoryPort } from "../../ports/nudge.repository.port.js";

export interface SendNudgeThanksInput {
	readonly userId: string;
	readonly todoId: number;
	readonly throughNudgeId: number;
}

export interface SendNudgeThanksResult {
	sentCount: number;
}

@Injectable()
export class SendNudgeThanksUseCase {
	constructor(
		@Inject(NUDGE_REPOSITORY)
		private readonly nudgeRepository: NudgeRepositoryPort,
		@Inject(NUDGE_INTERACTION_CONFIG)
		private readonly interactionConfig: NudgeInteractionConfigPort,
		@Inject(NUDGE_NOTIFIER)
		private readonly nudgeNotifier: NudgeNotifierPort,
		@Inject(UNIT_OF_WORK)
		private readonly unitOfWork: UnitOfWorkPort,
		private readonly followReader: FollowReader,
	) {}

	async execute(input: SendNudgeThanksInput): Promise<SendNudgeThanksResult> {
		if (!this.interactionConfig.enabled) {
			throw new ApplicationException(ErrorCode.NUDGE_1105);
		}

		return this.unitOfWork.run(async () => {
			const todo = await this.nudgeRepository.lockInteractionTodo(input.todoId, input.userId);
			if (!todo) {
				throw new ApplicationException(ErrorCode.TODO_0801);
			}
			if (!todo.completed) {
				throw new ApplicationException(ErrorCode.NUDGE_1110);
			}
			if (todo.visibility !== "PUBLIC") {
				throw new ApplicationException(ErrorCode.NUDGE_1109);
			}

			const cutoffNudge = await this.nudgeRepository.findInteractionById(
				input.throughNudgeId,
				input.userId,
			);
			if (
				!cutoffNudge ||
				cutoffNudge.receiverId !== input.userId ||
				cutoffNudge.todoId !== input.todoId
			) {
				throw new ApplicationException(ErrorCode.NUDGE_1105);
			}
			const friendIds = await this.followReader.getCurrentMutualFriendIds(input.userId);
			const candidates = await this.nudgeRepository.findThanksCandidates({ ...input, friendIds });
			const thankedAt = now();
			let sentCount = 0;

			for (const record of candidates) {
				const nudge = Nudge.reconstitute(record);
				if (!nudge.markThanked(thankedAt)) {
					continue;
				}
				await this.nudgeRepository.saveThanks(nudge);
				await this.nudgeNotifier.recordInteraction({
					kind: "thanks",
					nudgeId: nudge.id,
					todoId: todo.id,
					actorId: input.userId,
					recipientId: nudge.senderId,
					actorName: record.receiver.profile?.name ?? record.receiver.userTag,
					todoTitle: todo.title,
				});
				sentCount += 1;
			}

			return { sentCount };
		});
	}
}
