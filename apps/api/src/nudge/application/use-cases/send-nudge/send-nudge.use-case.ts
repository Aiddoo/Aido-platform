import { ErrorCode } from "@aido/errors";
import { Inject, Injectable, Logger } from "@nestjs/common";

import { FollowReader } from "@/follow";
import {
	MUTATION_LOCK,
	MutationLockKeys,
	type MutationLockPort,
	UNIT_OF_WORK,
	type UnitOfWorkPort,
} from "@/shared/application/ports";
import { now } from "@/shared/domain/date/utils/core";
import { dayWindowInTimezone } from "@/shared/domain/date/utils/timezone";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";

import { evaluateNudgeCooldown } from "../../../domain/services/nudge-cooldown";
import { NudgeMessage } from "../../../domain/value-objects/nudge-message.vo";
import { NudgeTargetTodo } from "../../../domain/value-objects/nudge-target-todo.vo";
import {
	NUDGE_REPOSITORY,
	type NudgeRepositoryPort,
	type NudgeWithRelations,
} from "../../ports/nudge.repository.port";
import {
	NUDGE_LIMIT_READER,
	type NudgeLimitReaderPort,
} from "../../ports/nudge-limit-reader.port";
import {
	NUDGE_NOTIFIER,
	type NudgeNotifierPort,
} from "../../ports/nudge-notifier.port";

export interface SendNudgeInput {
	senderId: string;
	receiverId: string;
	todoId: number;
	message?: string;
}

/**
 * 콕 찌르기 보내기 use-case.
 *
 * 자기 자신 체크 → 친구 관계 확인 후, 트랜잭션 안에서 대상 할 일 검증(소유·공개·오늘)·일일 한도·
 * 쿨다운(동일 할 일 24시간)을 검사하고 콕 찌르기를 생성한다(TOCTOU 방지). 생성 후 알림을 enqueue한다.
 */
@Injectable()
export class SendNudgeUseCase {
	readonly #logger = new Logger(SendNudgeUseCase.name);

	constructor(
		@Inject(NUDGE_REPOSITORY)
		private readonly nudgeRepository: NudgeRepositoryPort,
		@Inject(NUDGE_NOTIFIER)
		private readonly notifier: NudgeNotifierPort,
		@Inject(NUDGE_LIMIT_READER)
		private readonly limitReader: NudgeLimitReaderPort,
		@Inject(MUTATION_LOCK)
		private readonly mutationLock: MutationLockPort,
		@Inject(UNIT_OF_WORK)
		private readonly uow: UnitOfWorkPort,
		private readonly followReader: FollowReader,
	) {}

	async execute(
		input: SendNudgeInput,
		tz: string = "UTC",
	): Promise<NudgeWithRelations> {
		const { senderId, receiverId, todoId, message } = input;

		if (senderId === receiverId) {
			throw new ApplicationException(ErrorCode.NUDGE_1104);
		}

		const isFriend = await this.followReader.isMutualFriend(
			senderId,
			receiverId,
		);
		if (!isFriend) {
			throw new ApplicationException(ErrorCode.NUDGE_1103, {
				targetUserId: receiverId,
			});
		}

		const nudgeMessage = NudgeMessage.of(message);
		const capturedAt = now();
		const quotaWindow = dayWindowInTimezone(capturedAt, tz);

		const nudge = await this.uow.run(async () => {
			await this.mutationLock.acquire([
				MutationLockKeys.nudgeDaily(senderId, quotaWindow.localDate),
				MutationLockKeys.nudgeCooldown(senderId, todoId),
			]);

			const todoRow = await this.nudgeRepository.findTargetTodo(todoId);
			if (!todoRow) {
				throw new ApplicationException(ErrorCode.TODO_0801, { todoId });
			}

			const target = NudgeTargetTodo.of(todoRow);
			if (!target.isOwnedBy(receiverId)) {
				throw new ApplicationException(ErrorCode.TODO_0801, { todoId });
			}
			if (!target.isPublic()) {
				throw new ApplicationException(ErrorCode.TODO_0801, { todoId });
			}

			if (!target.isActiveOn(quotaWindow.date)) {
				throw new ApplicationException(ErrorCode.NUDGE_1106, { todoId });
			}

			const dailyLimit = await this.limitReader.getDailyLimitInTx(senderId);
			const used = await this.nudgeRepository.countSentSince(
				senderId,
				quotaWindow.startsAt,
				quotaWindow.endsAt,
			);
			if (dailyLimit !== null && used >= dailyLimit) {
				throw new ApplicationException(ErrorCode.NUDGE_1101, {
					limit: dailyLimit,
				});
			}

			const lastNudge = await this.nudgeRepository.findLastNudgeForTodo(
				senderId,
				todoId,
			);
			if (lastNudge) {
				const cooldown = evaluateNudgeCooldown(lastNudge.createdAt);
				if (cooldown.isActive) {
					throw new ApplicationException(ErrorCode.NUDGE_1102, {
						targetUserId: receiverId,
						remainingSeconds: cooldown.remainingSeconds,
					});
				}
			}

			return this.nudgeRepository.createNudge({
				senderId,
				receiverId,
				todoId,
				message: nudgeMessage.raw,
				createdAt: capturedAt,
			});
		});

		this.#logger.log(
			`Nudge sent: senderId=${senderId}, receiverId=${receiverId}, todoId=${todoId}`,
		);

		const senderName = nudge.sender.profile?.name ?? nudge.sender.userTag;
		this.notifier.notifyNudgeSent({
			nudgeId: nudge.id,
			senderId,
			receiverId,
			senderName,
			todoId,
			todoTitle: nudge.todo.title,
			message: nudgeMessage.raw,
		});

		return nudge;
	}
}
